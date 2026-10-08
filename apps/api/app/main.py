"""Fábrica de la aplicación: routers, CORS, rate limit, logging y lifespan (carga el catálogo).

Arranque: `uv run uvicorn app.main:app --reload`.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.crm import build_crm
from app.core.clock import Clock, SystemClock
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.core.ratelimit import setup_rate_limiting
from app.repositories.catalog import CatalogRepo
from app.repositories.memory import LeadRepo
from app.routers import health, leads, models

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    """Compone la app. `settings` y `clock` se inyectan en tests (sin .env, hora EC fija)."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.catalog_repo = CatalogRepo.from_file(settings.catalog_path)
        log.info("startup", extra={"models": len(app.state.catalog_repo)})
        yield
        log.info("shutdown")

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Agente de leads 24/7 BYD Ecuador. Contrato: docs/openapi.yaml.",
        lifespan=lifespan,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.clock = clock or SystemClock()
    app.state.crm = build_crm(settings)
    app.state.lead_repo = LeadRepo()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    setup_rate_limiting(app)
    app.include_router(health.router)
    app.include_router(models.router)
    app.include_router(leads.router)
    return app


app = create_app()
