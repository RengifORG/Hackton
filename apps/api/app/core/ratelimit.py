"""Rate limit por IP (slowapi) para las rutas de escritura: /chat, /leads y /appointments.

Las lecturas (GET /leads, GET /appointments) no se limitan: las bandejas /asesor y /taller
las refrescan cada pocos segundos.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

log = logging.getLogger(__name__)

# CLAUDE.md §4 y SPEC CA3.4: 20 solicitudes por minuto por IP.
RATE_LIMIT = "20/minute"
RATE_LIMITED_DETAIL = "Demasiadas solicitudes. Intenta de nuevo en un minuto."

# `headers_enabled=False`: con True, slowapi exige `response: Response` en cada ruta decorada
# y devuelve 500 si falta; el contrato no pide cabeceras X-RateLimit, solo el 429.
limiter = Limiter(key_func=get_remote_address, headers_enabled=False)


def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    """429 con mensaje en español (CLAUDE.md §6) en lugar del texto en inglés de slowapi."""
    log.warning("rate limit exceeded", extra={"path": request.url.path})
    return JSONResponse(
        status_code=429, content={"detail": RATE_LIMITED_DETAIL}, headers={"Retry-After": "60"}
    )


def setup_rate_limiting(app: FastAPI) -> None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
