"""F6 · Conformidad con docs/openapi.yaml (schemathesis, generación basada en propiedades).

Cada operación del contrato se ejercita contra la app real (adapters fake, sin LLM, sin red):
sin errores 5xx, respuestas y content-type conformes al YAML. `/webhooks` queda fuera (F7b no
está en el contrato v0.2.0). `status_code_conformance` se excluye hasta que el PR `contract`
declare el 404/429 de POST /appointments y el 422 de GET /availability (ver nota de cierre F6);
los chequeos de métodos no documentados también se excluyen (ver EXCLUDED_CHECKS).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from tempfile import mkdtemp

import pytest
import schemathesis
from hypothesis import HealthCheck, settings
from schemathesis.specs.openapi.checks import (
    allow_header_conformance,
    status_code_conformance,
    unsupported_method,
)
from tests.conftest import OFFICE_HOURS_NOW

from app.adapters.calendar import SlotsRepository
from app.core.clock import FixedClock
from app.core.config import DATA_DIR, REPO_ROOT, Settings
from app.core.ratelimit import limiter
from app.main import create_app
from app.repositories.catalog import CatalogRepo


def _conformance_app():  # type: ignore[no-untyped-def]
    app_settings = Settings(
        _env_file=None,
        catalog_path=DATA_DIR / "catalog.json",
        slots_path=Path(mkdtemp()) / "slots.json",
        use_bedrock=False,
        hubspot_token=None,
    )
    application = create_app(app_settings, clock=FixedClock(OFFICE_HOURS_NOW))
    # Mismo estado que deja el lifespan (catálogo y franjas), sin depender del transporte.
    application.state.catalog_repo = CatalogRepo.from_file(app_settings.catalog_path)
    application.state.slots_repo = SlotsRepository.load_or_generate(
        app_settings.slots_path, application.state.clock
    )
    return application


schema = schemathesis.openapi.from_path(REPO_ROOT / "docs" / "openapi.yaml").exclude(
    path_regex="^/webhooks"
)
schema.app = _conformance_app()


# Métodos no documentados (OPTIONS/PUT…): Starlette responde 405 con un `Allow` parcial cuando
# GET y POST de un path son rutas separadas; no es parte del contrato de cada operación.
EXCLUDED_CHECKS = [status_code_conformance, unsupported_method, allow_header_conformance]


@pytest.fixture
def no_rate_limit() -> Iterator[None]:
    """El 429 es comportamiento probado aparte; aquí no debe cortar la generación."""
    limiter.enabled = False
    try:
        yield
    finally:
        limiter.enabled = True
        limiter.reset()


@schema.parametrize()
@settings(
    max_examples=25,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow],
)
def test_api_conforms_to_the_contract(case: schemathesis.Case, no_rate_limit: None) -> None:
    case.call_and_validate(excluded_checks=EXCLUDED_CHECKS)
