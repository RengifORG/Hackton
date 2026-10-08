"""F4 · H2 Recomendaciones (CA2.1, CA2.3, CA2.4) — POST /recommendations determinista."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import DATA_DIR
from app.services.recommendation_service import (
    Profile,
    parse_budget,
    parse_charger,
    parse_passengers,
    parse_profile,
    parse_usage,
)

CATALOG_IDS = ["dolphin", "seagull", "yuan-up", "song-plus", "seal", "shark"]
CATALOG = {
    m["id"]: m for m in json.loads((DATA_DIR / "catalog.json").read_text("utf-8-sig"))["models"]
}


def recommend(client: TestClient, profile: str, **extra: Any) -> list[dict[str, Any]]:
    response = client.post("/recommendations", json={"profile": profile, **extra})
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"items"}
    items = body["items"]
    assert len(items) == 3
    assert len({i["modelId"] for i in items}) == 3
    for item in items:
        assert set(item) == {"modelId", "name", "price", "reason"}
        assert item["modelId"] in CATALOG_IDS
        assert item["name"] == CATALOG[item["modelId"]]["name"]
        assert item["price"] == CATALOG[item["modelId"]]["price"]
        assert 1 <= len(item["reason"]) <= 200
    return items


# ---------------------------------------------------------------- CA2.1 / CA2.3 / CA2.4


def test_family_city_30k_puts_the_closest_price_first(client: TestClient) -> None:
    items = recommend(client, "familia de 4, ciudad, presupuesto 30k")
    assert [i["modelId"] for i in items] == ["yuan-up", "dolphin", "song-plus"]
    assert "presupuesto" in items[0]["reason"]
    assert "familia" in items[0]["reason"] and "ciudad" in items[0]["reason"]


def test_no_home_charger_prioritizes_the_plug_in_hybrid(client: TestClient) -> None:
    items = recommend(
        client, "uso en carretera y trabajo, no tengo cargador en casa, presupuesto 50k"
    )
    assert items[0]["modelId"] == "shark"
    assert "cargador" in items[0]["reason"]


def test_no_charger_without_budget_still_surfaces_the_phev(client: TestClient) -> None:
    items = recommend(client, "vivo en un departamento sin cargador")
    assert items[0]["modelId"] == "shark"


def test_budget_drives_the_order_when_nothing_else_is_known(client: TestClient) -> None:
    assert [i["modelId"] for i in recommend(client, "presupuesto de 19 mil dólares")][
        0
    ] == "seagull"
    assert [i["modelId"] for i in recommend(client, "tengo unos 45.000 dólares")][0] == "seal"


def test_highway_executive_profile(client: TestClient) -> None:
    items = recommend(client, "viajo mucho por carretera, solo yo, presupuesto 45k")
    assert items[0]["modelId"] == "seal"


@pytest.mark.parametrize(
    "profile",
    [
        "asdfgh qwerty",
        "quiero un tesla model 3 barato",
        "x" * 500,
        "12345",
        "familia, carretera, trabajo, ciudad, sin cargador, 1 millón",
    ],
)
def test_always_three_catalog_models_for_any_profile(client: TestClient, profile: str) -> None:
    recommend(client, profile)


def test_same_profile_gives_the_same_answer(client: TestClient) -> None:
    profile = "pareja, ciudad, 25k, cargo en casa"
    assert recommend(client, profile) == recommend(client, profile)


def test_session_id_is_accepted(client: TestClient) -> None:
    recommend(client, "familia de 4, ciudad, 30k", sessionId="sess-reco-0001")


@pytest.mark.parametrize(
    "payload",
    [
        {"profile": "1234"},  # < 5
        {"profile": "x" * 501},
        {"profile": "familia de 4, ciudad", "extra": True},
        {"sessionId": "sess-reco-0001"},
        {"profile": 12345},
        {"profile": None},
    ],
)
def test_invalid_request_returns_422(client: TestClient, payload: dict[str, Any]) -> None:
    assert client.post("/recommendations", json=payload).status_code == 422


# ---------------------------------------------------------------- parser del perfil (decision-tree)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("presupuesto 30k", 30000),
        ("30 mil", 30000),
        ("$25.000", 25000),
        ("25,000 dólares", 25000),
        ("unos 28000", 28000),
        ("entre 25k y 35k", 30000),
        ("familia de 4, ciudad", None),
        ("2 personas", None),
    ],
)
def test_parse_budget(text: str, expected: int | None) -> None:
    assert parse_budget(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("uso en ciudad", "ciudad"),
        ("viajo por carretera", "carretera"),
        ("para trabajo y carga", "trabajo"),
        ("camioneta para la finca", "trabajo"),
        ("no sé", None),
    ],
)
def test_parse_usage(text: str, expected: str | None) -> None:
    assert parse_usage(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("familia de 4", 4),
        ("somos 5", 5),
        ("2 personas", 2),
        ("pareja", 2),
        ("solo yo", 1),
        ("familia", 4),
        ("ciudad, 30k", None),
    ],
)
def test_parse_passengers(text: str, expected: int | None) -> None:
    assert parse_passengers(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("no tengo cargador en casa", False),
        ("sin cargador", False),
        ("no puedo cargar", False),
        ("puedo cargar en casa", True),
        ("tengo cargador en el trabajo", True),
        ("ciudad, 30k", None),
    ],
)
def test_parse_charger(text: str, expected: bool | None) -> None:
    assert parse_charger(text) == expected


def test_parse_profile_combines_everything() -> None:
    assert parse_profile(
        "familia de 4, ciudad, presupuesto 30k, sí puedo cargar en casa"
    ) == Profile(usage="ciudad", passengers=4, budget=30000, home_charger=True)
