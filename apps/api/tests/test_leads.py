"""F1 · H1 Captar lead (CA1.1–CA1.5) contra docs/openapi.yaml (`LeadCreate`, `Lead`)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.adapters.crm import FakeCrm
from app.core.clock import ECUADOR_TZ, FixedClock

LEAD_REQUIRED = {"id", "createdAt", "afterHours", "name", "phone", "source", "consent"}


def lead_payload(**overrides: Any) -> dict[str, Any]:
    """Lead sintético válido (teléfono ficticio con formato EC, prompt §6)."""
    payload: dict[str, Any] = {
        "name": "Ana Prueba",
        "phone": "0991234567",
        "email": "ana.prueba@example.com",
        "source": "web",
        "interest": "Prueba de manejo del Dolphin",
        "recommendedModels": ["dolphin", "seagull", "yuan-up"],
        "consent": True,
        "sessionId": "sess-0001-abcd",
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------- CA1.1 · 201 + leadId


def test_create_lead_returns_201_with_id_and_contract_fields(client: TestClient) -> None:
    response = client.post("/leads", json=lead_payload())

    assert response.status_code == 201
    body = response.json()
    assert set(body) >= LEAD_REQUIRED
    assert isinstance(body["id"], str) and body["id"]
    assert body["name"] == "Ana Prueba"
    assert body["phone"] == "0991234567"
    assert body["email"] == "ana.prueba@example.com"
    assert body["source"] == "web"
    assert body["interest"] == "Prueba de manejo del Dolphin"
    assert body["recommendedModels"] == ["dolphin", "seagull", "yuan-up"]
    assert body["consent"] is True
    assert body["sessionId"] == "sess-0001-abcd"
    assert body["crmStatus"] == "pushed"
    assert "created_at" not in body and "after_hours" not in body


def test_create_lead_with_only_required_fields_omits_optionals_instead_of_null(
    client: TestClient,
) -> None:
    minimal = {"name": "Luis", "phone": "+593991234567", "source": "whatsapp", "consent": True}

    response = client.post("/leads", json=minimal)

    assert response.status_code == 201
    body = response.json()
    assert body["phone"] == "+593991234567"
    assert body["source"] == "whatsapp"
    # El contrato no declara campos nullable: un opcional ausente no debe salir como null.
    assert None not in body.values()
    assert "email" not in body and "interest" not in body and "sessionId" not in body


def test_each_lead_gets_a_distinct_id(client: TestClient) -> None:
    first = client.post("/leads", json=lead_payload()).json()["id"]
    second = client.post("/leads", json=lead_payload(name="Otra Persona")).json()["id"]
    assert first != second


# ---------------------------------------------------------------- CA1.2 · teléfono EC


@pytest.mark.parametrize(
    "phone",
    [
        "0998765",  # corto (caso del prompt)
        "+5939123",  # internacional corto (caso del prompt)
        "+59399123456",  # internacional con 8 dígitos tras el 9
        "0891234567",  # no es móvil (08…)
        "+593891234567",
        "09912345678",  # 11 dígitos
        "099123456a",
        "099 123 4567",  # separadores no admitidos por el patrón
        " 0991234567",
        "",
        "0９91234567",  # dígito de ancho completo
        "09١٢٣٤٥٦٧٨",  # dígitos arábigo-índicos
    ],
)
def test_invalid_phone_returns_422(client: TestClient, phone: str) -> None:
    response = client.post("/leads", json=lead_payload(phone=phone))
    assert response.status_code == 422


@pytest.mark.parametrize("phone", ["0991234567", "0900000000", "+593991234567"])
def test_valid_ecuador_mobile_phones_are_accepted(client: TestClient, phone: str) -> None:
    assert client.post("/leads", json=lead_payload(phone=phone)).status_code == 201


# ---------------------------------------------------------------- CA1.3 · extra=forbid


@pytest.mark.parametrize(
    "extra",
    [
        {"cedula": "1712345678"},
        {"id": "forzado"},  # el cliente no fija campos del servidor
        {"afterHours": False},
        {"crmStatus": "pushed"},
    ],
)
def test_extra_fields_return_422(client: TestClient, extra: dict[str, Any]) -> None:
    response = client.post("/leads", json=lead_payload(**extra))
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("consent", False),
        ("consent", 1),  # el contrato exige booleano true, no "truthy"
        ("consent", "true"),
        ("consent", None),
        ("name", "A"),
        ("name", "x" * 81),
        ("name", 12345),
        ("source", "email"),
        ("interest", "x" * 201),
        ("recommendedModels", ["dolphin", "seal", "shark", "seagull"]),
        ("recommendedModels", "dolphin"),
        ("email", None),
        ("email", "no-es-un-email"),
        ("sessionId", 123),
    ],
)
def test_invalid_field_values_return_422(client: TestClient, field: str, value: Any) -> None:
    response = client.post("/leads", json=lead_payload(**{field: value}))
    assert response.status_code == 422


@pytest.mark.parametrize("missing", ["name", "phone", "source", "consent"])
def test_missing_required_field_returns_422(client: TestClient, missing: str) -> None:
    payload = lead_payload()
    del payload[missing]
    assert client.post("/leads", json=payload).status_code == 422


def test_rejected_lead_is_not_persisted_nor_pushed(client: TestClient, fake_crm: FakeCrm) -> None:
    client.post("/leads", json=lead_payload(phone="123"))
    assert client.get("/leads").json() == []
    assert fake_crm.calls == []


# ---------------------------------------------------------------- CA1.4 · createdAt + afterHours


@pytest.mark.parametrize(
    ("hour", "minute", "expected"),
    [
        (19, 0, True),  # caso del prompt
        (10, 0, False),  # caso del prompt
        (7, 59, True),
        (8, 0, False),
        (17, 59, False),
        (18, 0, True),
        (23, 30, True),
        (0, 0, True),
    ],
)
def test_after_hours_uses_ecuador_office_hours(
    client: TestClient, clock: FixedClock, hour: int, minute: int, expected: bool
) -> None:
    clock.set(datetime(2026, 10, 8, hour, minute, tzinfo=ECUADOR_TZ))
    body = client.post("/leads", json=lead_payload()).json()
    assert body["afterHours"] is expected


def test_after_hours_converts_utc_server_time_to_ecuador(
    client: TestClient, clock: FixedClock
) -> None:
    # 00:30 UTC del 9/10 = 19:30 del 8/10 en Guayaquil → fuera de horario.
    clock.set(datetime(2026, 10, 9, 0, 30, tzinfo=UTC))
    body = client.post("/leads", json=lead_payload()).json()
    assert body["afterHours"] is True
    assert body["createdAt"] == "2026-10-08T19:30:00-05:00"


def test_created_at_is_the_clock_time_in_ecuador(client: TestClient, clock: FixedClock) -> None:
    clock.set(datetime(2026, 10, 8, 19, 0, tzinfo=ECUADOR_TZ))
    body = client.post("/leads", json=lead_payload()).json()
    assert body["createdAt"] == "2026-10-08T19:00:00-05:00"


# ---------------------------------------------------------------- CA1.5 · CrmAdapter.push_lead


def test_creating_a_lead_pushes_it_once_to_the_crm(client: TestClient, fake_crm: FakeCrm) -> None:
    body = client.post("/leads", json=lead_payload()).json()

    assert len(fake_crm.calls) == 1
    pushed = fake_crm.calls[0]
    assert pushed.id == body["id"]
    # El CRM sí recibe el teléfono completo: es el canal para que el asesor contacte al lead.
    assert pushed.phone == "0991234567"
    assert body["crmStatus"] == "pushed"


def test_crm_failure_keeps_the_lead_with_failed_status(
    client: TestClient, fake_crm: FakeCrm
) -> None:
    fake_crm.fail = True

    response = client.post("/leads", json=lead_payload())

    assert response.status_code == 201
    assert response.json()["crmStatus"] == "failed"
    stored = client.get("/leads").json()
    assert [lead["id"] for lead in stored] == [response.json()["id"]]
    assert stored[0]["crmStatus"] == "failed"


# ---------------------------------------------------------------- GET /leads (bandeja /asesor)


def test_list_leads_starts_empty(client: TestClient) -> None:
    response = client.get("/leads")
    assert response.status_code == 200
    assert response.json() == []


def test_list_leads_returns_created_leads_in_order_with_masked_pii(client: TestClient) -> None:
    first = client.post("/leads", json=lead_payload()).json()
    second = client.post(
        "/leads",
        json=lead_payload(name="Luis Demo", phone="+593987654321", email="luis@example.com"),
    ).json()

    listed = client.get("/leads").json()

    assert [lead["id"] for lead in listed] == [first["id"], second["id"]]
    assert listed[0]["phone"] == "09****4567"
    assert listed[1]["phone"] == "09****4321"
    assert listed[0]["email"] == "a***@example.com"
    assert listed[1]["email"] == "l***@example.com"
    for lead in listed:
        assert set(lead) >= LEAD_REQUIRED
        assert None not in lead.values()
    assert listed[0]["afterHours"] is False
    assert listed[0]["recommendedModels"] == ["dolphin", "seagull", "yuan-up"]


def test_masking_on_read_does_not_alter_the_stored_lead(
    client: TestClient, fake_crm: FakeCrm
) -> None:
    client.post("/leads", json=lead_payload())
    client.get("/leads")
    client.get("/leads")
    assert fake_crm.calls[0].phone == "0991234567"
    assert client.get("/leads").json()[0]["phone"] == "09****4567"


# ---------------------------------------------------------------- seguridad: logs y rate limit


def test_lead_creation_never_sends_pii_to_logs(
    client: TestClient, caplog: pytest.LogCaptureFixture, fake_crm: FakeCrm
) -> None:
    fake_crm.fail = True  # también el camino de error
    with caplog.at_level(logging.DEBUG):
        client.post("/leads", json=lead_payload())
        client.get("/leads")

    assert caplog.records, "se esperaba al menos un log del servicio"
    for record in caplog.records:
        dumped = record.getMessage() + repr(vars(record))
        assert "0991234567" not in dumped
        assert "ana.prueba@example.com" not in dumped
        assert "Ana Prueba" not in dumped


def test_post_leads_is_rate_limited_to_20_per_minute(client: TestClient) -> None:
    statuses = [client.post("/leads", json=lead_payload()).status_code for _ in range(20)]
    assert statuses == [201] * 20

    response = client.post("/leads", json=lead_payload())

    assert response.status_code == 429
    assert response.json() == {"detail": "Demasiadas solicitudes. Intenta de nuevo en un minuto."}


def test_get_leads_is_not_rate_limited_for_advisor_polling(client: TestClient) -> None:
    # /asesor refresca la bandeja cada pocos segundos: la lectura no debe dar 429.
    assert {client.get("/leads").status_code for _ in range(25)} == {200}
