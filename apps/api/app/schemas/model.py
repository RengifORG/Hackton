"""Esquemas del catálogo (`ModelSummary`, `Model`) según docs/openapi.yaml."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import Field

from app.schemas.common import CamelModel, Hotspot


class HotspotPoint(CamelModel):
    id: Hotspot
    label: str
    position: Annotated[list[float], Field(min_length=3, max_length=3)]


class ModelSummary(CamelModel):
    id: str
    name: str
    price: float
    segment: str
    range_km: int
    thumbnail: str
    # `to_camel("has3d")` daría `has3D`; el contrato dice `has3d`.
    has3d: bool = Field(default=False, alias="has3d")


class Model(ModelSummary):
    specs: dict[str, Any] = Field(default_factory=dict)
    hotspots: list[HotspotPoint] = Field(default_factory=list)
