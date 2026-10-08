"""Fixtures compartidos: app con settings controlados (sin .env), reloj EC fijo y CRM fake."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.crm import FakeCrm, get_crm
from app.core.clock import ECUADOR_TZ, FixedClock
from app.core.config import DATA_DIR, Settings
from app.core.ratelimit import limiter
from app.main import create_app

# Jueves 2026-10-08 10:00 en Ecuador: dentro del horario de oficina.
OFFICE_HOURS_NOW = datetime(2026, 10, 8, 10, 0, tzinfo=ECUADOR_TZ)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    # `_env_file=None`: los tests no dependen del .env local ni de credenciales.
    # `slots_path` en tmp: ningún test debe escribir el data/slots.json versionado (F2).
    return Settings(
        _env_file=None,
        catalog_path=DATA_DIR / "catalog.json",
        slots_path=tmp_path / "slots.json",
        cors_origins="http://localhost:5173",
        use_bedrock=False,
        hubspot_token=None,
    )


@pytest.fixture
def clock() -> FixedClock:
    """Reloj de la app; los tests lo mueven con `clock.set(...)`."""
    return FixedClock(OFFICE_HOURS_NOW)


@pytest.fixture
def fake_crm() -> FakeCrm:
    return FakeCrm()


@pytest.fixture
def app(settings: Settings, clock: FixedClock, fake_crm: FakeCrm) -> FastAPI:
    limiter.reset()
    application = create_app(settings, clock=clock)
    application.dependency_overrides[get_crm] = lambda: fake_crm
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # `with` ejecuta el lifespan (carga del catálogo).
    with TestClient(app) as test_client:
        yield test_client
