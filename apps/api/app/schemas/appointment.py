"""Esquemas de franjas y citas (`Slot`, `AppointmentCreate`, `Appointment`) · contrato v0.2.0."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.schemas.common import CamelModel, StrictInput
from app.schemas.lead import PHONE_MASKED_PATTERN


class AppointmentType(StrEnum):
    TEST_DRIVE = "test_drive"
    SERVICE = "service"


class AppointmentStatus(StrEnum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class Slot(CamelModel):
    id: str
    start: datetime
    end: datetime
    location: str
    available: bool


class AppointmentCreate(StrictInput):
    """Cuerpo de `POST /appointments`. Campos extra → 422."""

    lead_id: str
    type: AppointmentType
    slot_id: str
    vehicle: str = Field(default=None, max_length=80)
    notes: str = Field(default=None, max_length=300)


class Appointment(CamelModel):
    """Cita confirmada (objeto explícito del contrato; `loyaltyNote` = decisión A en `service`)."""

    id: str
    lead_id: str
    type: AppointmentType
    slot_id: str
    vehicle: str | None = None
    notes: str | None = None
    status: AppointmentStatus
    created_at: datetime
    slot: Slot
    lead_name: str | None = None
    lead_phone_masked: str | None = Field(default=None, pattern=PHONE_MASKED_PATTERN)
    loyalty_note: str | None = Field(default=None, max_length=200)
