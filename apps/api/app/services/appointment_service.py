"""H4 · Disponibilidad y citas: franjas del calendario, reserva (409) y aviso por tipo.

`test_drive` → avisa al CRM del asesor · `service` → abre orden en el taller (+ nota de cashback,
decisión A). Lo usan `GET /availability`, `POST /appointments` y, en F3, el chat.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Annotated
from uuid import uuid4

from fastapi import Depends

from app.adapters.calendar import SlotDef, SlotsDep, SlotsRepository
from app.adapters.crm import CrmDep, CrmPort
from app.adapters.workshop import WorkshopDep, WorkshopPort
from app.core.clock import ECUADOR_TZ, Clock, ClockDep
from app.core.pii import mask_phone
from app.repositories.memory import AppointmentRepo, AppointmentRepoDep, LeadRepo, LeadRepoDep
from app.schemas.appointment import (
    Appointment,
    AppointmentCreate,
    AppointmentStatus,
    AppointmentType,
    Slot,
)

log = logging.getLogger(__name__)

# Decisión A (reto 1 · fidelización Farmaenlace): una línea en las citas de taller (≤ 200 chars).
LOYALTY_NOTE = (
    "💚 Con SmartClub, tu mantenimiento acumula cashback canjeable en Farmaenlace "
    "(Medicity, Económicas y más)."
)


class LeadNotFoundError(LookupError):
    """El `leadId` no existe (CONTACTO siempre antes de CITA)."""


class SlotNotFoundError(LookupError):
    """La franja no existe en el calendario del tipo pedido."""


class SlotTakenError(RuntimeError):
    """La franja ya está reservada (409)."""


class AppointmentService:
    def __init__(
        self,
        slots: SlotsRepository,
        appointments: AppointmentRepo,
        leads: LeadRepo,
        crm: CrmPort,
        workshop: WorkshopPort,
        clock: Clock,
    ) -> None:
        self._slots = slots
        self._appointments = appointments
        self._leads = leads
        self._crm = crm
        self._workshop = workshop
        self._clock = clock

    def availability(self, appointment_type: AppointmentType, day: date) -> list[Slot]:
        """CA4.1: franjas del día (ordenadas por hora) con `available` según reservas."""
        defs = sorted(self._slots.for_day(appointment_type, day), key=lambda s: s.start)
        return [self._to_slot(s) for s in defs]

    def create(self, data: AppointmentCreate) -> Appointment:
        lead = self._leads.get(data.lead_id)
        if lead is None:
            raise LeadNotFoundError(data.lead_id)
        slot_def = self._slots.get(data.slot_id)
        if slot_def is None or slot_def.type != data.type:
            raise SlotNotFoundError(data.slot_id)
        if not self._appointments.book(slot_def.id):
            raise SlotTakenError(slot_def.id)

        is_service = data.type == AppointmentType.SERVICE
        appointment = Appointment(
            id=str(uuid4()),
            lead_id=lead.id,
            type=data.type,
            slot_id=slot_def.id,
            vehicle=data.vehicle,
            notes=data.notes,
            status=AppointmentStatus.CONFIRMED,
            created_at=self._clock.now().astimezone(ECUADOR_TZ),
            slot=self._to_slot(slot_def, available=False),
            lead_name=lead.name,
            lead_phone_masked=mask_phone(lead.phone),
            loyalty_note=LOYALTY_NOTE if is_service else None,
        )
        # Se persiste ANTES de avisar: una caída del CRM o del taller nunca pierde la cita.
        self._appointments.save(appointment)
        self._notify(appointment, lead)
        log.info(
            "appointment created",
            extra={
                "appointmentId": appointment.id,
                "leadId": lead.id,
                "type": data.type.value,
                "slotId": slot_def.id,
            },
        )
        return appointment

    def list(self, appointment_type: AppointmentType | None = None) -> list[Appointment]:
        return self._appointments.list(appointment_type)

    def _notify(self, appointment: Appointment, lead: object) -> None:
        try:
            if appointment.type == AppointmentType.TEST_DRIVE:
                self._crm.notify_appointment(appointment, lead)  # type: ignore[arg-type]
            else:
                order = self._workshop.create_work_order(appointment, lead)  # type: ignore[arg-type]
                log.info(
                    "work order linked",
                    extra={"appointmentId": appointment.id, "orderNumber": order.number},
                )
        except Exception as exc:  # el aviso es best-effort; la cita ya está guardada
            log.warning(
                "appointment notification failed",
                extra={
                    "appointmentId": appointment.id,
                    "type": appointment.type.value,
                    "error": type(exc).__name__,
                },
            )

    def _to_slot(self, slot_def: SlotDef, *, available: bool | None = None) -> Slot:
        if available is None:
            available = not self._appointments.is_booked(slot_def.id)
        return Slot(
            id=slot_def.id,
            start=slot_def.start,
            end=slot_def.end,
            location=slot_def.location,
            available=available,
        )


def get_appointment_service(
    slots: SlotsDep,
    appointments: AppointmentRepoDep,
    leads: LeadRepoDep,
    crm: CrmDep,
    workshop: WorkshopDep,
    clock: ClockDep,
) -> AppointmentService:
    return AppointmentService(slots, appointments, leads, crm, workshop, clock)


AppointmentServiceDep = Annotated[AppointmentService, Depends(get_appointment_service)]
