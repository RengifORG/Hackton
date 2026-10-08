"""Fábrica de la aplicación: routers, CORS, rate limit, logging y lifespan (catálogo y franjas).

Arranque: `uv run uvicorn app.main:app --reload`.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.calendar import SlotsRepository
from app.adapters.crm import build_crm
from app.adapters.llm import build_llm
from app.adapters.workshop import build_workshop
from app.core.clock import Clock, DemoClock, SystemClock
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.core.ratelimit import setup_rate_limiting
from app.repositories.catalog import CatalogRepo
from app.repositories.memory import AppointmentRepo, LeadRepo, SessionRepo
from app.routers import appointments, availability, chat, health, leads, models, recommendations

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, clock: Clock | None = None) -> FastAPI:
    """Compone la app. `settings` y `clock` se inyectan en tests (sin .env, hora EC fija)."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.catalog_repo = CatalogRepo.from_file(settings.catalog_path)
        app.state.slots_repo = SlotsRepository.load_or_generate(
            settings.slots_path, app.state.clock
        )
        log.info(
            "startup",
            extra={
                "models": len(app.state.catalog_repo),
                "slots": len(app.state.slots_repo),
                "llm": settings.bedrock_model_id if app.state.llm else "off (determinista)",
            },
        )
        yield
        log.info("shutdown")

    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        description="Agente de leads 24/7 BYD Ecuador. Contrato: docs/openapi.yaml.",
        lifespan=lifespan,
        redoc_url=None,
    )
    app.state.settings = settings
    if clock is None and settings.demo_now is not None:
        clock = DemoClock(settings.demo_now)
        log.warning(
            "demo clock (simulación de hora)", extra={"start": settings.demo_now.isoformat()}
        )
    app.state.clock = clock or SystemClock()
    app.state.crm = build_crm(settings)
    app.state.workshop = build_workshop(settings)
    app.state.llm = build_llm(settings)
    app.state.lead_repo = LeadRepo()
    app.state.appointment_repo = AppointmentRepo()
    app.state.session_repo = SessionRepo()
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
    app.include_router(availability.router)
    app.include_router(appointments.router)
    app.include_router(chat.router)
    app.include_router(recommendations.router)
    return app


app = create_app()
