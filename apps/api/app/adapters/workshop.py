"""Taller (ERP propio sin API conocida → simulado): `WorkshopPort` + `FakeWorkshop` en memoria.

CA4.3: una cita `service` crea una orden de trabajo en el taller. En producción este adapter
hablaría con el DMS/ERP del taller; en el MVP es un fake etiquetado como simulado.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated, Protocol

from fastapi import Depends, Request

from app.core.config import Settings
from app.schemas.appointment import Appointment
from app.schemas.lead import Lead

log = logging.getLogger(__name__)


class WorkshopError(RuntimeError):
    """Fallo al crear la orden de trabajo. Nunca incluye PII."""


@dataclass(frozen=True)
class WorkOrder:
    number: str
    appointment_id: str
    lead_name: str
    slot_id: str
    vehicle: str | None


class WorkshopPort(Protocol):
    def create_work_order(self, appointment: Appointment, lead: Lead) -> WorkOrder:
        """Abre una orden de trabajo para la cita y devuelve su número."""
        ...


class FakeWorkshop:
    """Taller simulado: guarda las órdenes en memoria. `fail=True` simula una caída."""

    def __init__(self, *, fail: bool = False) -> None:
        self.orders: list[WorkOrder] = []
        self.fail = fail

    def create_work_order(self, appointment: Appointment, lead: Lead) -> WorkOrder:
        if self.fail:
            raise WorkshopError("FakeWorkshop: fallo simulado")
        order = WorkOrder(
            number=f"WO-{appointment.slot.start:%Y%m%d}-{len(self.orders) + 1:03d}",
            appointment_id=appointment.id,
            lead_name=lead.name,
            slot_id=appointment.slot_id,
            vehicle=appointment.vehicle,
        )
        self.orders.append(order)
        log.info(
            "work order created (simulado)",
            extra={"appointmentId": appointment.id, "orderNumber": order.number},
        )
        return order


def build_workshop(settings: Settings) -> WorkshopPort:
    """El ERP del taller no tiene API conocida (SPEC): siempre `FakeWorkshop`."""
    return FakeWorkshop()


def get_workshop(request: Request) -> WorkshopPort:
    return request.app.state.workshop


WorkshopDep = Annotated[WorkshopPort, Depends(get_workshop)]
