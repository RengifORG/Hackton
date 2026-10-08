"""Base de esquemas: JSON camelCase (`rangeKm`, `sessionId`) con nombres snake_case en Python."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Modelo base: alias camelCase en JSON; acepta también los nombres Python."""

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, serialize_by_alias=True
    )


class StrictInput(CamelModel):
    """Entradas de la API: cualquier campo extra → 422 (CLAUDE.md §4, `extra="forbid"`)."""

    model_config = ConfigDict(extra="forbid")


class Hotspot(StrEnum):
    """Enum `Hotspot` del contrato; el front enfoca la cámara 3D a este punto."""

    WHEELS = "wheels"
    SEATS = "seats"
    SCREEN = "screen"
    BATTERY = "battery"
    TRUNK = "trunk"
    LIGHTS = "lights"
