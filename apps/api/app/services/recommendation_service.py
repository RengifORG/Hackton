"""H2 · Recomendaciones: parser del perfil + scoring determinista de docs/decision-tree.md.

puntaje = cercanía al presupuesto ×3 + match de `idealFor` con uso/pasajeros(/cargador) ×2
          + 3 si el cliente no puede cargar en casa y el modelo es híbrido enchufable (PHEV).
Siempre devuelve exactamente 3 modelos del catálogo (CA2.1/CA2.3). En F5 el LLM propone ids
por tool use y este mismo servicio los valida; si falla, se usa este scoring.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends

from app.repositories.catalog import CatalogDep, CatalogRepo
from app.schemas.model import Model
from app.schemas.recommendation import Recommendation

log = logging.getLogger(__name__)

TOP_N = 3
MIN_BUDGET_USD = 5_000
BUDGET_WEIGHT = 3.0
IDEAL_FOR_WEIGHT = 2.0
NO_CHARGER_PHEV_BONUS = 3.0
NEAR_BUDGET_THRESHOLD = 0.7
REASON_MAX = 200

USAGE_KW = {
    "ciudad": ("ciudad", "urbano", "trafico", "oficina", "diario"),
    "carretera": (
        "carretera",
        "viaje",
        "viajar",
        "larga distancia",
        "ruta",
        "autopista",
        "provincia",
    ),
    "trabajo": (
        "trabajo",
        "carga",
        "camioneta",
        "pickup",
        "pick-up",
        "finca",
        "transportar",
        "negocio",
        "herramienta",
    ),
}
NO_CHARGER_KW = (
    "sin cargador",
    "no tengo cargador",
    "no puedo cargar",
    "no tengo donde cargar",
    "sin donde cargar",
    "no tengo enchufe",
    "no tengo garaje",
)
CHARGER_KW = (
    "puedo cargar",
    "tengo cargador",
    "cargar en casa",
    "cargador en casa",
    "cargador en el trabajo",
    "tengo garaje",
    "cargo en casa",
)
PHEV_KW = ("hibrida enchufable", "phev", "plug-in")
BUDGET_RE = re.compile(
    r"(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k\b|mil\b|millon)?", re.IGNORECASE
)


@dataclass(frozen=True)
class Profile:
    usage: str | None = None  # ciudad | carretera | trabajo
    passengers: int | None = None
    budget: int | None = None  # USD
    home_charger: bool | None = None


def _norm(text: str) -> str:
    stripped = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    return re.sub(r"\s+", " ", stripped.lower())


def parse_budget(text: str) -> int | None:
    """`30k`, `30 mil`, `$25.000`, `25,000`, `28000` → USD; los números pequeños se ignoran."""
    candidates: list[int] = []
    for number, suffix in BUDGET_RE.findall(_norm(text)):
        if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", number):
            value = float(number.replace(".", "").replace(",", ""))
        else:
            value = float(number.replace(",", "."))
        if suffix:
            value *= 1_000_000 if suffix.startswith("millon") else 1_000
        if value >= MIN_BUDGET_USD:
            candidates.append(int(value))
    if not candidates:
        return None
    return int(sum(candidates) / len(candidates))  # "entre 25k y 35k" → 30k


def parse_usage(text: str) -> str | None:
    norm = _norm(text)
    for usage, words in USAGE_KW.items():
        if any(w in norm for w in words):
            return usage
    return None


def parse_passengers(text: str) -> int | None:
    norm = _norm(text)
    match = re.search(
        r"(?:familia de|somos|para)\s+(\d)\b|(\d)\s*(?:pasajeros|personas|puestos|plazas)", norm
    )
    if match:
        return int(match.group(1) or match.group(2))
    if "familia" in norm:
        return 4
    if "pareja" in norm or "dos personas" in norm:
        return 2
    if re.search(r"\bsolo\b|\byo\b", norm):
        return 1
    return None


def parse_charger(text: str) -> bool | None:
    norm = _norm(text)
    if any(w in norm for w in NO_CHARGER_KW):
        return False
    if any(w in norm for w in CHARGER_KW):
        return True
    return None


def parse_profile(text: str) -> Profile:
    return Profile(
        usage=parse_usage(text),
        passengers=parse_passengers(text),
        budget=parse_budget(text),
        home_charger=parse_charger(text),
    )


def is_phev(model: Model) -> bool:
    haystack = _norm(model.segment + " " + model.name)
    return any(k in haystack for k in PHEV_KW)


def _fmt_money(value: float) -> str:
    return f"USD {value:,.0f}".replace(",", ".")


@dataclass(frozen=True)
class Scored:
    model: Model
    score: float
    reason: str


class RecommendationService:
    def __init__(self, catalog: CatalogRepo) -> None:
        self._catalog = catalog

    def recommend(self, profile_text: str) -> list[Recommendation]:
        """Exactamente 3 modelos del catálogo, ordenados por puntaje (desempate: precio, orden)."""
        profile = parse_profile(profile_text)
        scored = [self._score(model, profile) for model in self._catalog.list()]
        ranked = sorted(
            enumerate(scored), key=lambda pair: (-pair[1].score, pair[1].model.price, pair[0])
        )
        top = [s for _, s in ranked[:TOP_N]]
        log.info(
            "recommendation",
            extra={
                "usage": profile.usage,
                "passengers": profile.passengers,
                "budget": profile.budget,
                "homeCharger": profile.home_charger,
                "modelIds": [s.model.id for s in top],
            },
        )
        return [
            Recommendation(
                model_id=s.model.id, name=s.model.name, price=s.model.price, reason=s.reason
            )
            for s in top
        ]

    def _score(self, model: Model, profile: Profile) -> Scored:
        ideal = [_norm(t) for t in self._catalog.ideal_for(model.id)]
        score = 0.0
        reasons: list[str] = []

        price_note = _fmt_money(model.price)
        if profile.budget:
            proximity = max(0.0, 1 - abs(model.price - profile.budget) / profile.budget)
            score += BUDGET_WEIGHT * proximity
            if proximity >= NEAR_BUDGET_THRESHOLD:
                price_note += " (cerca de tu presupuesto)"
            elif model.price > profile.budget:
                price_note += " (sobre tu presupuesto)"
            else:
                price_note += " (bajo tu presupuesto)"
        reasons.append(price_note)

        matched: list[str] = []
        if profile.usage and any(profile.usage in t for t in ideal):
            matched.append(profile.usage)
        if profile.passengers is not None:
            if profile.passengers >= 5 and any("familia grande" in t for t in ideal):
                matched.append("familia grande")
            elif 3 <= profile.passengers <= 4 and any("familia" in t for t in ideal):
                matched.append("familia")
            elif profile.passengers <= 2 and any(("pareja" in t or "1-2" in t) for t in ideal):
                matched.append("pocos pasajeros")
        if profile.home_charger is False and any("sin cargador" in t for t in ideal):
            matched.append("sin cargador en casa")
        score += IDEAL_FOR_WEIGHT * len(matched)
        if matched:
            reasons.append("ideal para " + ", ".join(matched))

        if profile.home_charger is False and is_phev(model):
            score += NO_CHARGER_PHEV_BONUS
            reasons.append("híbrida enchufable: no depende de un cargador en casa")

        reasons.append(f"autonomía {model.range_km} km")
        return Scored(model, score, " · ".join(reasons)[:REASON_MAX])


def get_recommendation_service(catalog: CatalogDep) -> RecommendationService:
    return RecommendationService(catalog)


RecommendationServiceDep = Annotated[RecommendationService, Depends(get_recommendation_service)]
