"""F7a · H7a confirmaciones salientes por WhatsApp Cloud API (CA7.1 lead fuera de horario,
CA7.2 cita confirmada). Ningún test toca la red: `FakeWhatsApp` o `httpx.MockTransport`."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.whatsapp import FakeWhatsApp, MetaWhatsApp, build_whatsapp, get_whatsapp
from app.core.clock import ECUADOR_TZ, FixedClock
from app.core.config import Settings
from app.core.pii import to_wa_digits

PHONE = "0991234567"
WA = "593991234567"
FRIDAY = "2026-10-09"
LEAD = {"name": "Ana Prueba", "phone": PHONE, "source": "web", "consent": True}


@pytest.fixture
def fake_wa(app: FastAPI) -> FakeWhatsApp:
    fake = FakeWhatsApp()
    app.dependency_overrides[get_whatsapp] = lambda: fake
    return fake


def create_lead(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post("/leads", json={**LEAD, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def book(client: TestClient, lead_id: str, kind: str, slot_id: str) -> dict[str, Any]:
    response = client.post(
        "/appointments", json={"leadId": lead_id, "type": kind, "slotId": slot_id}
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------- to_wa_digits


@pytest.mark.parametrize(
    ("phone", "expected"),
    [("0991234567", WA), ("+593991234567", WA), ("+593 99 123 4567", WA), ("593991234567", WA)],
)
def test_to_wa_digits(phone: str, expected: str) -> None:
    assert to_wa_digits(phone) == expected


# ---------------------------------------------------------------- CA7.1 · lead fuera de horario


def test_after_hours_lead_gets_one_whatsapp(
    client: TestClient, clock: FixedClock, fake_wa: FakeWhatsApp
) -> None:
    clock.set(datetime(2026, 10, 8, 19, 0, tzinfo=ECUADOR_TZ))
    assert create_lead(client)["afterHours"] is True
    assert fake_wa.sent == [
        (
            WA,
            "Hola Ana, recibimos tus datos fuera de horario. "
            "Un asesor de BYD Ecuador te contactará desde las 08:00.",
        )
    ]


def test_office_hours_lead_sends_nothing(client: TestClient, fake_wa: FakeWhatsApp) -> None:
    assert create_lead(client)["afterHours"] is False
    assert fake_wa.sent == []


def test_after_hours_lead_from_the_chat_also_notifies(
    client: TestClient, clock: FixedClock, fake_wa: FakeWhatsApp
) -> None:
    clock.set(datetime(2026, 10, 8, 21, 0, tzinfo=ECUADOR_TZ))
    for message in ("hola", "quiero dejar mis datos", f"Soy Ana Prueba {PHONE}", "sí"):
        assert (
            client.post("/chat", json={"sessionId": "sess-wa-0001", "message": message}).status_code
            == 200
        )
    assert len(client.get("/leads").json()) == 1
    assert [to for to, _ in fake_wa.sent] == [WA]


# ---------------------------------------------------------------- CA7.2 · cita confirmada


def test_test_drive_appointment_sends_the_confirmation(
    client: TestClient, fake_wa: FakeWhatsApp
) -> None:
    lead = create_lead(client)
    book(client, lead["id"], "test_drive", f"td-{FRIDAY}-10")
    assert fake_wa.sent == [
        (WA, "✅ Ana, tu prueba de manejo queda el 09/10 10:00 en Quito Norte.")
    ]


def test_service_appointment_includes_the_smartclub_line(
    client: TestClient, fake_wa: FakeWhatsApp
) -> None:
    lead = create_lead(client)
    book(client, lead["id"], "service", f"sv-{FRIDAY}-09")
    (to, body) = fake_wa.sent[-1]
    assert to == WA
    assert body.startswith("✅ Ana, tu cita de taller queda el 09/10 09:00 en Taller Quito.")
    assert "SmartClub" in body


def test_whatsapp_failure_never_breaks_the_201(client: TestClient, app: FastAPI) -> None:
    app.dependency_overrides[get_whatsapp] = lambda: FakeWhatsApp(fail=True)
    lead = create_lead(client)
    book(client, lead["id"], "test_drive", f"td-{FRIDAY}-11")


def test_whatsapp_exception_never_breaks_the_201(
    client: TestClient, app: FastAPI, clock: FixedClock
) -> None:
    class Exploding:
        def send_text(self, to_digits: str, body: str) -> bool:
            raise RuntimeError("boom")

    app.dependency_overrides[get_whatsapp] = lambda: Exploding()
    clock.set(datetime(2026, 10, 8, 19, 0, tzinfo=ECUADOR_TZ))
    lead = create_lead(client)
    book(client, lead["id"], "test_drive", f"td-{FRIDAY}-12")


def test_without_whatsapp_configured_nothing_is_sent(client: TestClient) -> None:
    # Fixture `settings`: WHATSAPP_ENABLED por defecto 0 → app.state.whatsapp es None.
    lead = create_lead(client)
    book(client, lead["id"], "test_drive", f"td-{FRIDAY}-13")


# ---------------------------------------------------------------- MetaWhatsApp (Cloud API)


def meta(handler: Any) -> MetaWhatsApp:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return MetaWhatsApp("tok-test", "123456", "v25.0", client=client)


def test_meta_request_shape() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"messages": [{"id": "wamid.ABCDEF123456"}]})

    assert meta(handler).send_text(WA, "hola") is True
    request = seen[0]
    assert request.method == "POST"
    assert str(request.url) == "https://graph.facebook.com/v25.0/123456/messages"
    assert request.headers["Authorization"] == "Bearer tok-test"
    assert json.loads(request.content) == {
        "messaging_product": "whatsapp",
        "to": WA,
        "type": "text",
        "text": {"preview_url": False, "body": "hola"},
    }


def test_meta_error_returns_false_and_logs_only_status_and_code(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = {"error": {"code": 131030, "message": f"Recipient {WA} not in allowed list"}}
        return httpx.Response(400, json=body)

    with caplog.at_level(logging.INFO):
        assert meta(handler).send_text(WA, "hola") is False
    record = next(r for r in caplog.records if r.getMessage() == "whatsapp send rejected")
    assert (record.status, record.errorCode) == (400, 131030)  # type: ignore[attr-defined]
    assert WA not in caplog.text and PHONE not in caplog.text and "tok-test" not in caplog.text


def test_meta_network_error_returns_false() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin red", request=request)

    assert meta(handler).send_text(WA, "hola") is False


def test_notifier_logs_never_contain_the_full_phone(
    client: TestClient, clock: FixedClock, fake_wa: FakeWhatsApp, caplog: pytest.LogCaptureFixture
) -> None:
    clock.set(datetime(2026, 10, 8, 19, 0, tzinfo=ECUADOR_TZ))
    with caplog.at_level(logging.INFO):
        lead = create_lead(client)
        book(client, lead["id"], "test_drive", f"td-{FRIDAY}-14")
    assert len(fake_wa.sent) == 2
    assert PHONE not in caplog.text and WA not in caplog.text
    notified = [r for r in caplog.records if r.getMessage() == "whatsapp notify"]
    assert [r.to for r in notified] == ["09****4567", "09****4567"]  # type: ignore[attr-defined]
    for record in caplog.records:
        assert PHONE not in str(record.__dict__) and WA not in str(record.__dict__)


def test_build_whatsapp_only_when_fully_configured() -> None:
    assert build_whatsapp(Settings(_env_file=None)) is None
    assert (
        build_whatsapp(Settings(_env_file=None, whatsapp_enabled=True, whatsapp_token="t")) is None
    )
    assert (
        build_whatsapp(Settings(_env_file=None, whatsapp_token="t", whatsapp_phone_number_id="1"))
        is None
    )
    built = build_whatsapp(
        Settings(
            _env_file=None, whatsapp_enabled=True, whatsapp_token="t", whatsapp_phone_number_id="1"
        )
    )
    assert isinstance(built, MetaWhatsApp)
