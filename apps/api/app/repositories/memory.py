"""Almacenes en memoria del MVP (interfaz lista para cambiar a DynamoDB).

Thread-safe: FastAPI ejecuta las rutas síncronas en un pool de hilos.
"""

from __future__ import annotations

import threading
from typing import Annotated

from fastapi import Depends, Request

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


def get_lead_repo(request: Request) -> LeadRepo:
    return request.app.state.lead_repo


LeadRepoDep = Annotated[LeadRepo, Depends(get_lead_repo)]
