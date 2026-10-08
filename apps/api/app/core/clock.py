"""Reloj inyectable en hora de Ecuador (America/Guayaquil).

`afterHours` (H1) y las franjas (H4) dependen de la hora local; en tests se inyecta `FixedClock`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Protocol
from zoneinfo import ZoneInfo

from fastapi import Depends, Request

ECUADOR_TZ = ZoneInfo("America/Guayaquil")


class Clock(Protocol):
    def now(self) -> datetime:
        """Fecha-hora actual con zona horaria America/Guayaquil."""
        ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(tz=ECUADOR_TZ)


class FixedClock:
    """Reloj congelado para tests (p. ej. 19:00 EC → afterHours=True)."""

    def __init__(self, fixed: datetime) -> None:
        self._fixed = fixed if fixed.tzinfo else fixed.replace(tzinfo=ECUADOR_TZ)

    def now(self) -> datetime:
        return self._fixed.astimezone(ECUADOR_TZ)


def get_clock(request: Request) -> Clock:
    """Dependencia FastAPI: el reloj con el que se compuso la app (`create_app(clock=...)`)."""
    return request.app.state.clock


ClockDep = Annotated[Clock, Depends(get_clock)]
