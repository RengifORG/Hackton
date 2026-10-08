"""Elección de franja conversacional (H3/H4): el cliente responde con día/hora, no con un número
de menú. Reloj: jueves 2026-10-08 10:00 EC → «mañana» = viernes 09/10."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services.slot_parser import SlotRequest, parse_slot_request

TODAY = date(2026, 10, 8)  # jueves
FRI, SAT, MON = date(2026, 10, 9), date(2026, 10, 10), date(2026, 10, 12)


@pytest.mark.parametrize(
    ("norm", "expected"),
    [
        ("a las 9 am tienes", SlotRequest(hour=9)),
        ("manana 10 am", SlotRequest(day=FRI, hour=10)),
        ("manana a las 10 de la manana", SlotRequest(day=FRI, hour=10)),
        ("el sabado a las 3", SlotRequest(day=SAT, hour=15)),
        ("a las 3 de la tarde", SlotRequest(hour=15)),
        ("15:00", SlotRequest(hour=15)),
        ("15h00", SlotRequest(hour=15)),
        ("2 pm", SlotRequest(hour=14)),
        ("10", SlotRequest(hour=10)),
        ("al mediodia", SlotRequest(hour=12)),
        ("12/10 a las 11", SlotRequest(day=MON, hour=11)),
        ("el 12 de octubre a las 11", SlotRequest(day=MON, hour=11)),
        ("pasado manana", SlotRequest(day=SAT)),
        ("el lunes", SlotRequest(day=MON)),
        ("mejor otro dia", SlotRequest(other_day=True)),
        ("no se", SlotRequest()),
    ],
)
def test_parse_slot_request(norm: str, expected: SlotRequest) -> None:
    assert parse_slot_request(norm, TODAY) == expected


# ---------------------------------------------------------------- conversación


def chat(client: TestClient, session_id: str, message: str) -> str:
    response = client.post("/chat", json={"sessionId": session_id, "message": message})
    assert response.status_code == 200, response.text
    return str(response.json()["reply"])


def start_booking(client: TestClient, sid: str, what: str = "prueba de manejo") -> str:
    chat(client, sid, what)
    return chat(client, sid, "Esteban Demo 0991234567 acepto")


def appointments(client: TestClient) -> list[dict[str, Any]]:
    return client.get("/appointments").json()


def take(client: TestClient, slot_id: str, kind: str = "test_drive") -> None:
    other = client.post(
        "/leads",
        json={"name": "Luis Demo", "phone": "0987654321", "source": "web", "consent": True},
    ).json()
    response = client.post(
        "/appointments", json={"leadId": other["id"], "type": kind, "slotId": slot_id}
    )
    assert response.status_code == 201


def test_offer_lists_hours_and_asks_naturally(client: TestClient) -> None:
    reply = start_booking(client, "sess-slot-offer-1")
    assert "tengo libre el viernes 09/10 a las 09:00, 10:00" in reply
    assert "y 16:00" in reply
    assert "¿A qué hora te queda bien?" in reply
    assert "número" not in reply


def test_the_user_example_taken_hour_then_tomorrow_10_am(client: TestClient) -> None:
    sid = "sess-slot-example"
    start_booking(client, sid)
    take(client, "td-2026-10-09-09")  # otro cliente toma la 09:00 mientras tanto

    reply = chat(client, sid, "A las 9 am tienes?")
    assert "A las 09:00 ya está ocupado el viernes 09/10" in reply
    assert "libre a las 10:00, 11:00" in reply
    assert len(appointments(client)) == 1

    reply = chat(client, sid, "mañana 10 am")
    assert "✅ Listo, Esteban" in reply
    assert "viernes 09/10 a las 10:00" in reply
    assert appointments(client)[-1]["slotId"] == "td-2026-10-09-10"


def test_another_day_and_hour_in_one_sentence(client: TestClient) -> None:
    sid = "sess-slot-saturday"
    start_booking(client, sid)
    reply = chat(client, sid, "el sábado a las 3 de la tarde")
    assert "sábado 10/10 a las 15:00" in reply
    assert appointments(client)[-1]["slotId"] == "td-2026-10-10-15"


def test_only_a_day_offers_that_days_hours(client: TestClient) -> None:
    sid = "sess-slot-day-only"
    start_booking(client, sid)
    reply = chat(client, sid, "el lunes")
    assert "El lunes 12/10 tengo libre a las 09:00" in reply
    assert appointments(client) == []
    chat(client, sid, "a las 11")
    assert appointments(client)[-1]["slotId"] == "td-2026-10-12-11"


def test_sunday_is_closed_and_offers_the_next_day(client: TestClient) -> None:
    sid = "sess-slot-sunday"
    start_booking(client, sid)
    reply = chat(client, sid, "el domingo a las 10")
    assert "no atendemos" in reply or "no tengo horarios" in reply
    assert "lunes 12/10" in reply
    assert appointments(client) == []


def test_hour_outside_office_hours_lists_the_free_ones(client: TestClient) -> None:
    sid = "sess-slot-night"
    start_booking(client, sid)
    reply = chat(client, sid, "a las 7 de la noche")
    assert "A las 19:00 no atendemos" in reply
    assert "09:00" in reply
    assert appointments(client) == []


def test_other_day_moves_to_the_next_available_day(client: TestClient) -> None:
    sid = "sess-slot-other"
    start_booking(client, sid)
    reply = chat(client, sid, "mejor otro día")
    assert "sábado 10/10" in reply
    chat(client, sid, "10 am")
    assert appointments(client)[-1]["slotId"] == "td-2026-10-10-10"


def test_beyond_two_weeks_is_rejected_kindly(client: TestClient) -> None:
    sid = "sess-slot-far"
    start_booking(client, sid)
    reply = chat(client, sid, "el 30/11 a las 10")
    assert "dos semanas" in reply
    assert appointments(client) == []


def test_workshop_full_at_10_answers_with_the_free_hours(client: TestClient) -> None:
    sid = "sess-slot-workshop"
    start_booking(client, sid, "necesito mantenimiento")
    take(client, "sv-2026-10-09-10", kind="service")
    reply = chat(client, sid, "a las 10")
    assert "A las 10:00 ya está ocupado" in reply
    assert "Ese día tengo libre a las 09:00, 11:00" in reply
    reply = chat(client, sid, "a las 11")
    assert "Taller Quito" in reply and "SmartClub" in reply
    assert appointments(client)[-1]["slotId"] == "sv-2026-10-09-11"
