"""GET /availability?type&date (H4 · CA4.1). Sin lógica de negocio: delega en el service."""

from __future__ import annotations

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas.appointment import AppointmentType, Slot
from app.services.appointment_service import AppointmentServiceDep

router = APIRouter(tags=["appointments"])


@router.get("/availability", response_model=list[Slot], operation_id="availability")
def availability(
    type: Annotated[AppointmentType, Query()],  # noqa: A002 - nombre fijado por el contrato
    date: Annotated[dt.date, Query()],
    service: AppointmentServiceDep,
) -> list[Slot]:
    return service.availability(type, date)
