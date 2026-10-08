"""Almacenes en memoria del MVP (interfaz lista para cambiar a DynamoDB).

Thread-safe: FastAPI ejecuta las rutas síncronas en un pool de hilos.
"""

from __future__ import annotations

import threading
from typing import Annotated

from fastapi import Depends, Request

from app.schemas.appointment import Appointment, AppointmentType
from app.schemas.lead import Lead


class LeadRepo:
    """Leads por id, en orden de creación (la bandeja /asesor los muestra así)."""

    def __init__(self) -> None:
        self._items: dict[str, Lead] = {}
        self._lock = threading.Lock()

    def save(self, lead: Lead) -> None:
        """Inserta o actualiza; una actualización conserva la posición original."""
        with self._lock:
            self._items[lead.id] = lead

    def get(self, lead_id: str) -> Lead | None:
        with self._lock:
            return self._items.get(lead_id)

    def list(self) -> list[Lead]:
        with self._lock:
            return list(self._items.values())

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


class AppointmentRepo:
    """Citas por id en orden de creación y conjunto de franjas reservadas (409 si se repite)."""

    def __init__(self) -> None:
        self._items: dict[str, Appointment] = {}
        self._booked: set[str] = set()
        self._lock = threading.Lock()

    def book(self, slot_id: str) -> bool:
        """Reserva la franja de forma atómica; `False` si ya estaba ocupada."""
        with self._lock:
            if slot_id in self._booked:
                return False
            self._booked.add(slot_id)
            return True

    def is_booked(self, slot_id: str) -> bool:
        with self._lock:
            return slot_id in self._booked

    def save(self, appointment: Appointment) -> None:
        with self._lock:
            self._items[appointment.id] = appointment

    def get(self, appointment_id: str) -> Appointment | None:
        with self._lock:
            return self._items.get(appointment_id)

    def list(self, appointment_type: AppointmentType | None = None) -> list[Appointment]:
        with self._lock:
            items = list(self._items.values())
        if appointment_type is None:
            return items
        return [a for a in items if a.type == appointment_type]

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)


def get_lead_repo(request: Request) -> LeadRepo:
    return request.app.state.lead_repo


def get_appointment_repo(request: Request) -> AppointmentRepo:
    return request.app.state.appointment_repo


LeadRepoDep = Annotated[LeadRepo, Depends(get_lead_repo)]
AppointmentRepoDep = Annotated[AppointmentRepo, Depends(get_appointment_repo)]
