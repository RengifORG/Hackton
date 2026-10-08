"""Reloj inyectable en hora de Ecuador (America/Guayaquil).

`afterHours` (H1) y las franjas (H4) dependen de la hora local; en tests se inyecta `FixedClock`
con `create_app(settings, clock=...)`.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import datetime, timedelta
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
    """Reloj congelado para tests (p. ej. 19:00 EC → afterHours=True). `set` lo mueve."""

    def __init__(self, fixed: datetime) -> None:
        self.set(fixed)

    def set(self, fixed: datetime) -> None:
        self._fixed = fixed if fixed.tzinfo else fixed.replace(tzinfo=ECUADOR_TZ)

    def now(self) -> datetime:
        return self._fixed.astimezone(ECUADOR_TZ)


class DemoClock:
    """Simulación de hora para la demo (`DEMO_NOW`): arranca en esa hora y avanza con el reloj
    real, así la demo (antes de las 18:00) puede mostrar leads `afterHours` con horas distintas."""

    def __init__(self, start: datetime, *, monotonic: Callable[[], float] = time.monotonic) -> None:
        self._start = start if start.tzinfo else start.replace(tzinfo=ECUADOR_TZ)
        self._monotonic = monotonic
        self._t0 = monotonic()

    def now(self) -> datetime:
        elapsed = timedelta(seconds=self._monotonic() - self._t0)
        return (self._start + elapsed).astimezone(ECUADOR_TZ)


def get_clock(request: Request) -> Clock:
    """Dependencia FastAPI: el reloj con el que se compuso la app (`create_app(clock=...)`)."""
    return request.app.state.clock


ClockDep = Annotated[Clock, Depends(get_clock)]
