"""Rate limit por IP (slowapi). Lo aplican las rutas /chat, /leads y /appointments (F1–F3)."""

from __future__ import annotations

from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# `headers_enabled=False`: con True, slowapi exige `response: Response` en cada ruta decorada
# y devuelve 500 si falta; el contrato no pide cabeceras X-RateLimit, solo el 429.
limiter = Limiter(key_func=get_remote_address, headers_enabled=False)


def setup_rate_limiting(app: FastAPI) -> None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
