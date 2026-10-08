"""Fixtures compartidos: app con settings controlados (sin .env) y cliente de pruebas."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import DATA_DIR, Settings
from app.core.ratelimit import limiter
from app.main import create_app


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
def app(settings: Settings) -> FastAPI:
    limiter.reset()
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # `with` ejecuta el lifespan (carga del catálogo).
    with TestClient(app) as test_client:
        yield test_client
