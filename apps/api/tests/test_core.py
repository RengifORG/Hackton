"""F0 · infraestructura: CORS, settings, reloj EC y logging con redacción de PII."""

from __future__ import annotations

import io
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import NamedTuple

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.clock import ECUADOR_TZ, FixedClock, SystemClock
from app.core.config import Settings
from app.core.logging import JsonFormatter, build_handler, configure_logging, redact
from app.core.pii import mask_email, mask_phone
from app.main import create_app


def test_cors_preflight_allows_front_origin(client: TestClient) -> None:
    response = client.options(
        "/models",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_ignores_unknown_origin(client: TestClient) -> None:
    response = client.get("/models", headers={"Origin": "http://evil.example"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_env_is_comma_separated() -> None:
    settings = Settings(
        _env_file=None,
        cors_origins="http://localhost:5173, https://d1234.cloudfront.net ,",
    )
    assert settings.cors_origin_list == [
        "http://localhost:5173",
        "https://d1234.cloudfront.net",
    ]


def test_empty_hubspot_token_counts_as_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    # `.env.example` deja `HUBSPOT_TOKEN=`; debe quedar None, no SecretStr("").
    monkeypatch.setenv("HUBSPOT_TOKEN", "")
    assert Settings(_env_file=None).hubspot_token is None


def test_fixed_clock_is_in_guayaquil_time() -> None:
    clock = FixedClock(datetime(2026, 10, 8, 19, 0))
    now = clock.now()
    assert now.tzinfo == ECUADOR_TZ
    assert now.utcoffset() == timedelta(hours=-5)
    assert (now.hour, now.minute) == (19, 0)


def test_system_clock_is_timezone_aware() -> None:
    assert SystemClock().now().tzinfo == ECUADOR_TZ


def test_create_app_accepts_an_injected_clock(settings: Settings) -> None:
    fixed = FixedClock(datetime(2026, 10, 8, 19, 0))
    app = create_app(settings, clock=fixed)
    assert app.state.clock.now() == fixed.now()
    assert isinstance(create_app(settings).state.clock, SystemClock)


@pytest.mark.parametrize(
    "phone",
    ["0991234567", "+593991234567", "099 123 4567", "099-123-4567", "+593 99 123 4567"],
)
def test_mask_phone_keeps_prefix_and_last_four(phone: str) -> None:
    assert mask_phone(phone) == "09****4567"


@pytest.mark.parametrize(
    ("email", "masked"),
    [
        ("ana.perez@example.com", "a***@example.com"),
        ("x@b.ec", "x***@b.ec"),
        ("sin-arroba", "***"),
        ("@example.com", "***"),
    ],
)
def test_mask_email_keeps_first_char_and_domain(email: str, masked: str) -> None:
    assert mask_email(email) == masked


def test_fixed_clock_can_be_moved() -> None:
    clock = FixedClock(datetime(2026, 10, 8, 10, 0))
    clock.set(datetime(2026, 10, 8, 19, 0))
    assert clock.now().hour == 19


def test_redact_masks_phone_email_and_national_id() -> None:
    text = "lead 0991234567 / +593987654321 ana.perez@example.com cedula 1712345678"
    assert redact(text) == "lead 09****4567 / 09****4321 [email] cedula [id]"


def test_redact_handles_phones_with_separators_and_url_encoding() -> None:
    text = "tel 099 123 4567, 099-123-4567, +593 99 123 4567, phone=%2B593991234567"
    assert redact(text) == "tel 09****4567, 09****4567, 09****4567, phone=09****4567"


def test_redact_leaves_slot_ids_prices_and_timestamps_alone() -> None:
    text = "slot td-2026-10-09-09 precio 23990 ts 2026-10-08T16:16:43"
    assert redact(text) == text


def test_logging_never_writes_raw_pii() -> None:
    stream = io.StringIO()
    logger = logging.getLogger("test.pii")
    logger.propagate = False
    logger.setLevel(logging.INFO)
    logger.handlers = [build_handler(stream)]

    logger.info(
        "nuevo lead %s <%s>", "0991234567", "ana@example.com", extra={"phone": "0998887777"}
    )

    output = stream.getvalue()
    assert "0991234567" not in output
    assert "0998887777" not in output
    assert "ana@example.com" not in output
    assert "09****4567" in output and "09****7777" in output and "[email]" in output
    assert output.startswith("{") and '"level": "INFO"' in output


class _LeadDC:
    """Objeto cualquiera con PII en su repr (como un lead de dominio)."""

    def __repr__(self) -> str:
        return "Lead(phone='0991234567', email='ana@example.com')"


@dataclass
class _LeadData:
    name: str
    phone: str


class _LeadModel(BaseModel):
    phone: str
    email: str


class _Addr(NamedTuple):
    host: str
    port: int


def test_logging_redacts_objects_passed_in_extra_and_args() -> None:
    stream = io.StringIO()
    logger = logging.getLogger("test.pii.objects")
    logger.propagate = False
    logger.setLevel(logging.INFO)
    logger.handlers = [build_handler(stream)]

    logger.info(
        "lead creado %s",
        _LeadDC(),
        extra={
            "lead": _LeadModel(phone="0998887777", email="ana@example.com"),
            "data": _LeadData(name="Ana", phone="0997776666"),
            "err": ValueError("teléfono 0996665555 inválido"),
            "nested": {"items": [_LeadData(name="B", phone="0995554444")]},
            "client": _Addr("127.0.0.1", 5173),
        },
    )

    output = stream.getvalue()
    for raw in ("0991234567", "0998887777", "0997776666", "0996665555", "0995554444"):
        assert raw not in output, raw
    assert "ana@example.com" not in output
    line = json.loads(output)
    assert line["msg"] == "lead creado Lead(phone='09****4567', email='[email]')"
    assert line["err"] == "teléfono 09****5555 inválido"
    assert line["client"] == ["127.0.0.1", 5173]


def test_configure_logging_installs_one_redacting_json_handler_and_routes_uvicorn() -> None:
    stream = io.StringIO()
    configure_logging("INFO", stream=stream)
    configure_logging("INFO", stream=stream)  # idempotente

    root = logging.getLogger()
    json_handlers = [h for h in root.handlers if isinstance(h.formatter, JsonFormatter)]
    assert len(json_handlers) == 1
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        assert logging.getLogger(name).handlers == []
        assert logging.getLogger(name).propagate is True

    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/1.1" %d', "127.0.0.1:1", "GET", "/leads?phone=0991234567", 200
    )
    logging.getLogger("app.leads").info("lead", extra={"email": "ana@example.com"})

    lines = [json.loads(line) for line in stream.getvalue().splitlines()]
    assert lines[0]["logger"] == "uvicorn.access"
    assert "0991234567" not in lines[0]["msg"] and "09****4567" in lines[0]["msg"]
    assert lines[1]["email"] == "[email]"

    configure_logging("INFO")  # restaura stderr para el resto de la suite
