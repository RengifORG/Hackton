"""POST /appointments y GET /appointments?type (H4 · CA4.2–4.3).

Sin `from __future__ import annotations`: el decorador de slowapi envuelve la función y FastAPI
no podría resolver anotaciones en texto contra el módulo de slowapi.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.ratelimit import RATE_LIMIT, limiter
from app.schemas.appointment import Appointment, AppointmentCreate, AppointmentType
from app.services.appointment_service import (
    AppointmentServiceDep,
    LeadNotFoundError,
    SlotNotFoundError,
    SlotTakenError,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=Appointment,
    response_model_exclude_none=True,
    operation_id="createAppointment",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": "Lead o franja no encontrados"},
        status.HTTP_409_CONFLICT: {"description": "Slot ya ocupado"},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Error de validación"},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes"},
    },
)
@limiter.limit(RATE_LIMIT)
def create_appointment(
    request: Request, payload: AppointmentCreate, service: AppointmentServiceDep
) -> Appointment:
    try:
        return service.create(payload)
    except LeadNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Lead no encontrado") from None
    except SlotNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Franja no encontrada") from None
    except SlotTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="La franja ya está ocupada") from None


@router.get(
    "",
    response_model=list[Appointment],
    response_model_exclude_none=True,
    operation_id="listAppointments",
)
def list_appointments(
    service: AppointmentServiceDep,
    type: Annotated[AppointmentType | None, Query()] = None,  # noqa: A002 - nombre del contrato
) -> list[Appointment]:
    return service.list(type)
