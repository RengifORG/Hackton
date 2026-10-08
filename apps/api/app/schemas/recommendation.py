"""Esquemas de `POST /recommendations` según docs/openapi.yaml (H2)."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import CamelModel, StrictInput


class RecommendationRequest(StrictInput):
    profile: str = Field(min_length=5, max_length=500)
    session_id: str = Field(default=None)


class Recommendation(CamelModel):
    model_id: str
    name: str
    price: float
    reason: str = Field(max_length=200)


class RecommendationResponse(CamelModel):
    items: list[Recommendation] = Field(min_length=3, max_length=3)
