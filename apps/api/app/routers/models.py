"""GET /models y GET /models/{modelId} — catálogo público (sin prefijo /api)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status

from app.repositories.catalog import CatalogDep
from app.schemas.model import Model, ModelSummary

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelSummary], operation_id="listModels")
def list_models(repo: CatalogDep) -> list[ModelSummary]:
    return [ModelSummary.model_validate(m.model_dump()) for m in repo.list()]


@router.get(
    "/{modelId}",
    response_model=Model,
    operation_id="getModel",
    responses={status.HTTP_404_NOT_FOUND: {"description": "No encontrado"}},
)
def get_model(model_id: Annotated[str, Path(alias="modelId")], repo: CatalogDep) -> Model:
    model = repo.get(model_id)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")
    return model
