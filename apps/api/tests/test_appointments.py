"""F2 · H4 · CA4.2–CA4.3 — POST /appointments (201/404/409/422) y GET /appointments?type."""

from __future__ import annotations

import logging
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.adapters.crm import FakeCrm
from app.adapters.workshop import FakeWorkshop

FRIDAY = "2026-10-09"
APPOINTMENT_REQUIRED = {"id", "leadId", "type", "slotId", "status", "createdAt", "slot"}
APPOINTMENT_ALLOWED = APPOINTMENT_REQUIRED | {
    "vehicle",
    "notes",
    "leadName",
    "leadPhoneMasked",
    "loyaltyNote",
}
LOYALTY_SNIPPET = "cashback"


def create_lead(client: TestClient, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Ana Prueba",
        "phone": "0991234567",
        "email": "ana.prueba@example.com",
        "source": "web",
        "consent": True,
    }
    payload.update(overrides)
    response = client.post("/leads", json=payload)
    assert response.status_code == 201
    return response.json()


def appointment_payload(lead_id: str, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"leadId": lead_id, "type": "test_drive", "slotId": f"td-{FRIDAY}-10"}
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------- CA4.2 · 201


def test_create_test_drive_returns_201_with_embedded_slot_and_masked_lead(
    client: TestClient,
) -> None:
    lead = create_lead(client)

    response = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], vehicle="BYD Dolphin", notes="Prefiere la mañana"),
    )

    assert response.status_code == 201
    body = response.json()
    assert APPOINTMENT_REQUIRED <= set(body) <= APPOINTMENT_ALLOWED, body
    assert None not in body.values()
    assert body["leadId"] == lead["id"]
    assert body["type"] == "test_drive"
    assert body["slotId"] == f"td-{FRIDAY}-10"
    assert body["vehicle"] == "BYD Dolphin"
    assert body["notes"] == "Prefiere la mañana"
    assert body["status"] == "confirmed"
    assert body["createdAt"] == "2026-10-08T10:00:00-05:00"
    assert body["slot"] == {
        "id": f"td-{FRIDAY}-10",
        "start": f"{FRIDAY}T10:00:00-05:00",
        "end": f"{FRIDAY}T11:00:00-05:00",
        "location": "Quito Norte",
        "available": False,
    }
    assert body["leadName"] == "Ana Prueba"
    assert body["leadPhoneMasked"] == "09****4567"
    assert "loyaltyNote" not in body
    assert "0991234567" not in response.text
    assert "ana.prueba@example.com" not in response.text


def test_create_service_adds_the_farmaenlace_loyalty_note(client: TestClient) -> None:
    lead = create_lead(client, phone="+593987654321")

    body = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-09"),
    ).json()

    assert body["type"] == "service"
    assert body["slot"]["location"] == "Taller Quito"
    assert body["leadPhoneMasked"] == "09****4321"
    assert LOYALTY_SNIPPET in body["loyaltyNote"].lower()
    assert "Farmaenlace" in body["loyaltyNote"]
    assert len(body["loyaltyNote"]) <= 200


def test_each_appointment_gets_a_distinct_id(client: TestClient) -> None:
    lead = create_lead(client)
    first = client.post("/appointments", json=appointment_payload(lead["id"])).json()["id"]
    second = client.post(
        "/appointments", json=appointment_payload(lead["id"], slotId=f"td-{FRIDAY}-11")
    ).json()["id"]
    assert first != second


# ---------------------------------------------------------------- CA4.2 · 409 / 404 / 422


def test_booking_an_occupied_slot_returns_409_and_keeps_the_first(
    client: TestClient, fake_crm: FakeCrm
) -> None:
    lead = create_lead(client)
    other = create_lead(client, name="Luis Demo", phone="0987654321")
    first = client.post("/appointments", json=appointment_payload(lead["id"]))

    second = client.post("/appointments", json=appointment_payload(other["id"]))

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "La franja ya está ocupada"
    listed = client.get("/appointments").json()
    assert [a["id"] for a in listed] == [first.json()["id"]]
    assert len(fake_crm.appointments) == 1


def test_same_hour_is_independent_between_test_drive_and_service(client: TestClient) -> None:
    lead = create_lead(client)
    td = client.post(
        "/appointments", json=appointment_payload(lead["id"], slotId=f"td-{FRIDAY}-10")
    )
    sv = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-10"),
    )
    assert (td.status_code, sv.status_code) == (201, 201)


def test_unknown_lead_returns_404(client: TestClient, fake_crm: FakeCrm) -> None:
    response = client.post("/appointments", json=appointment_payload("lead-que-no-existe"))
    assert response.status_code == 404
    assert response.json()["detail"] == "Lead no encontrado"
    assert client.get("/appointments").json() == []
    assert fake_crm.appointments == []


@pytest.mark.parametrize(
    "slot_id",
    [
        "td-2026-10-09-08",  # antes de las 09:00
        "td-2026-10-09-17",  # después de la última franja
        "td-2026-10-11-10",  # domingo
        "td-2026-10-22-10",  # fuera de los 14 días
        "sv-2026-10-09-10",  # franja del taller para una prueba de manejo
        "franja-inventada",
        "",
    ],
)
def test_unknown_or_mismatched_slot_returns_404(client: TestClient, slot_id: str) -> None:
    lead = create_lead(client)
    response = client.post("/appointments", json=appointment_payload(lead["id"], slotId=slot_id))
    assert response.status_code == 404
    assert response.json()["detail"] == "Franja no encontrada"


@pytest.mark.parametrize(
    "mutation",
    [
        {"cedula": "1712345678"},  # extra → 422 (extra=forbid)
        {"status": "cancelled"},  # campo del servidor
        {"type": "revision"},
        {"vehicle": "x" * 81},
        {"notes": "x" * 301},
        {"leadId": 123},
        {"slotId": None},
    ],
)
def test_invalid_payloads_return_422(client: TestClient, mutation: dict[str, Any]) -> None:
    lead = create_lead(client)
    response = client.post("/appointments", json=appointment_payload(lead["id"], **mutation))
    assert response.status_code == 422


@pytest.mark.parametrize("missing", ["leadId", "type", "slotId"])
def test_missing_required_field_returns_422(client: TestClient, missing: str) -> None:
    lead = create_lead(client)
    payload = appointment_payload(lead["id"])
    del payload[missing]
    assert client.post("/appointments", json=payload).status_code == 422


# ---------------------------------------------------------------- CA4.3 · adapter por tipo


def test_test_drive_notifies_the_crm_and_not_the_workshop(
    client: TestClient, fake_crm: FakeCrm, fake_workshop: FakeWorkshop
) -> None:
    lead = create_lead(client)
    body = client.post("/appointments", json=appointment_payload(lead["id"])).json()

    assert [a.id for a, _ in fake_crm.appointments] == [body["id"]]
    notified_appointment, notified_lead = fake_crm.appointments[0]
    assert notified_lead.id == lead["id"]
    assert notified_lead.phone == "0991234567"  # el CRM sí recibe el teléfono completo
    assert notified_appointment.slot.id == f"td-{FRIDAY}-10"
    assert fake_workshop.orders == []


def test_service_creates_a_work_order_in_the_workshop_and_not_in_the_crm(
    client: TestClient, fake_crm: FakeCrm, fake_workshop: FakeWorkshop
) -> None:
    lead = create_lead(client)
    body = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-14"),
    ).json()

    assert len(fake_workshop.orders) == 1
    order = fake_workshop.orders[0]
    assert order.appointment_id == body["id"]
    assert order.number.startswith("WO-20261009-")
    assert order.lead_name == "Ana Prueba"
    assert fake_crm.appointments == []


def test_adapter_failure_does_not_lose_the_appointment(
    client: TestClient, fake_crm: FakeCrm, fake_workshop: FakeWorkshop
) -> None:
    fake_crm.fail = True
    fake_workshop.fail = True
    lead = create_lead(client)

    td = client.post("/appointments", json=appointment_payload(lead["id"]))
    sv = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-09"),
    )

    assert (td.status_code, sv.status_code) == (201, 201)
    assert len(client.get("/appointments").json()) == 2


# ---------------------------------------------------------------- GET /appointments


def test_list_appointments_starts_empty(client: TestClient) -> None:
    response = client.get("/appointments")
    assert response.status_code == 200
    assert response.json() == []


def test_list_appointments_in_creation_order_and_filtered_by_type(client: TestClient) -> None:
    lead = create_lead(client)
    td = client.post("/appointments", json=appointment_payload(lead["id"])).json()
    sv = client.post(
        "/appointments",
        json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-09"),
    ).json()

    assert [a["id"] for a in client.get("/appointments").json()] == [td["id"], sv["id"]]
    service_only = client.get("/appointments", params={"type": "service"}).json()
    assert [a["id"] for a in service_only] == [sv["id"]]
    assert service_only[0]["loyaltyNote"]
    assert client.get("/appointments", params={"type": "test_drive"}).json()[0]["id"] == td["id"]


def test_list_appointments_rejects_unknown_type(client: TestClient) -> None:
    assert client.get("/appointments", params={"type": "revision"}).status_code == 422


def test_list_appointments_never_exposes_full_phone(client: TestClient) -> None:
    lead = create_lead(client)
    client.post("/appointments", json=appointment_payload(lead["id"]))
    raw = client.get("/appointments").text
    assert "0991234567" not in raw
    assert "09****4567" in raw


# ---------------------------------------------------------------- seguridad


def test_appointment_creation_never_sends_pii_to_logs(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    lead = create_lead(client)
    with caplog.at_level(logging.DEBUG):
        client.post("/appointments", json=appointment_payload(lead["id"]))
        client.post(
            "/appointments",
            json=appointment_payload(lead["id"], type="service", slotId=f"sv-{FRIDAY}-09"),
        )
    assert caplog.records
    for record in caplog.records:
        dumped = record.getMessage() + repr(vars(record))
        assert "0991234567" not in dumped
        assert "Ana Prueba" not in dumped
        assert "ana.prueba@example.com" not in dumped


def test_post_appointments_is_rate_limited_to_20_per_minute(client: TestClient) -> None:
    lead = create_lead(client)
    slot_ids = [f"td-2026-10-09-{h:02d}" for h in range(9, 17)]
    slot_ids += [f"td-2026-10-10-{h:02d}" for h in range(9, 17)]
    slot_ids += [f"td-2026-10-12-{h:02d}" for h in range(9, 13)]
    assert len(slot_ids) == 20

    statuses = [
        client.post("/appointments", json=appointment_payload(lead["id"], slotId=s)).status_code
        for s in slot_ids
    ]
    assert statuses == [201] * 20

    response = client.post(
        "/appointments", json=appointment_payload(lead["id"], slotId="td-2026-10-12-13")
    )
    assert response.status_code == 429


def test_get_appointments_is_not_rate_limited_for_workshop_polling(client: TestClient) -> None:
    assert {client.get("/appointments").status_code for _ in range(25)} == {200}
