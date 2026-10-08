"""Repositorio del catálogo: `data/catalog.json` es la única fuente de modelos.

Se valida contra `Model` al cargar (ids únicos, hotspots dentro del enum del contrato) para
fallar en el arranque y no en la demo.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from pydantic import TypeAdapter

from app.schemas.model import Model

log = logging.getLogger(__name__)
_MODEL_LIST = TypeAdapter(list[Model])


class CatalogRepo:
    def __init__(self, models: list[Model], ideal_for: dict[str, list[str]] | None = None) -> None:
        ids = [m.id for m in models]
        if len(set(ids)) != len(ids):
            raise ValueError("catalog.json: ids de modelo duplicados")
        self._by_id: dict[str, Model] = {m.id: m for m in models}
        # `idealFor` no forma parte del contrato `Model`: se guarda aparte para el scoring (H2).
        self._ideal_for: dict[str, list[str]] = ideal_for or {}

    @classmethod
    def from_file(cls, path: Path) -> CatalogRepo:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
        models = _MODEL_LIST.validate_python(raw["models"])
        ideal_for = {item["id"]: list(item.get("idealFor", [])) for item in raw["models"]}
        log.info("catalog loaded", extra={"models": len(models), "path": str(path)})
        return cls(models, ideal_for)

    def ideal_for(self, model_id: str) -> list[str]:
        return self._ideal_for.get(model_id, [])

    def list(self) -> list[Model]:
        return list(self._by_id.values())

    def get(self, model_id: str) -> Model | None:
        return self._by_id.get(model_id)

    def ids(self) -> list[str]:
        return list(self._by_id)

    def __len__(self) -> int:
        return len(self._by_id)


def get_catalog_repo(request: Request) -> CatalogRepo:
    """Dependencia FastAPI: el repo se carga en el lifespan de la app."""
    return request.app.state.catalog_repo


CatalogDep = Annotated[CatalogRepo, Depends(get_catalog_repo)]
