"""F2 · H4 · CA4.1 — GET /availability?type&date desde data/slots.json (generado por la API)."""

from __future__ import annotations

import json
from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.adapters.calendar import SLOTS_DAYS, SlotsRepository
from app.core.clock import ECUADOR_TZ, FixedClock
from app.core.config import Settings
from app.main import create_app

# conftest: el reloj fijo es el jueves 2026-10-08 10:00 (America/Guayaquil).
FRIDAY = "2026-10-09"
SATURDAY = "2026-10-10"
SUNDAY = "2026-10-11"
LAST_DAY = "2026-10-21"  # hoy + 13 → último de los 14 días
AFTER_WINDOW = "2026-10-22"
HOURS = list(range(9, 17))  # 09:00–17:00 cada hora → 8 franjas por día


def test_test_drive_slots_for_a_working_day(client: TestClient) -> None:
    response = client.get("/availability", params={"type": "test_drive", "date": FRIDAY})

    assert response.status_code == 200
    slots = response.json()
    assert [s["id"] for s in slots] == [f"td-{FRIDAY}-{h:02d}" for h in HOURS]
    assert slots[0]["start"] == f"{FRIDAY}T09:00:00-05:00"
    assert slots[0]["end"] == f"{FRIDAY}T10:00:00-05:00"
    assert slots[-1]["start"] == f"{FRIDAY}T16:00:00-05:00"
    assert slots[-1]["end"] == f"{FRIDAY}T17:00:00-05:00"
    for slot in slots:
        assert set(slot) == {"id", "start", "end", "location", "available"}
        assert slot["location"] == "Quito Norte"
        assert slot["available"] is True


def test_service_slots_use_the_workshop_location_and_sv_ids(client: TestClient) -> None:
    slots = client.get("/availability", params={"type": "service", "date": FRIDAY}).json()
    assert [s["id"] for s in slots] == [f"sv-{FRIDAY}-{h:02d}" for h in HOURS]
    assert {s["location"] for s in slots} == {"Taller Quito"}


@pytest.mark.parametrize("day", [SATURDAY, LAST_DAY])
def test_saturday_and_last_day_of_the_window_have_slots(client: TestClient, day: str) -> None:
    assert len(client.get("/availability", params={"type": "service", "date": day}).json()) == 8


@pytest.mark.parametrize("day", [SUNDAY, AFTER_WINDOW, "2026-10-07"])
def test_sunday_past_and_outside_window_return_empty(client: TestClient, day: str) -> None:
    response = client.get("/availability", params={"type": "test_drive", "date": day})
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    "params",
    [
        {"date": FRIDAY},  # falta type
        {"type": "test_drive"},  # falta date
        {"type": "revision", "date": FRIDAY},  # fuera del enum
        {"type": "test_drive", "date": "09/10/2026"},  # formato inválido
        {"type": "test_drive", "date": "2026-13-01"},
        {"type": "test_drive", "date": ""},
    ],
)
def test_missing_or_invalid_params_return_422(client: TestClient, params: dict[str, str]) -> None:
    assert client.get("/availability", params=params).status_code == 422


def test_booked_slot_is_reported_as_unavailable(client: TestClient) -> None:
    lead = client.post(
        "/leads",
        json={"name": "Ana Prueba", "phone": "0991234567", "source": "web", "consent": True},
    ).json()
    booking = client.post(
        "/appointments",
        json={"leadId": lead["id"], "type": "test_drive", "slotId": f"td-{FRIDAY}-10"},
    )
    assert booking.status_code == 201

    slots = client.get("/availability", params={"type": "test_drive", "date": FRIDAY}).json()
    by_id = {s["id"]: s["available"] for s in slots}
    assert by_id[f"td-{FRIDAY}-10"] is False
    assert by_id[f"td-{FRIDAY}-09"] is True
    # La agenda del taller no se ve afectada por una prueba de manejo.
    service = client.get("/availability", params={"type": "service", "date": FRIDAY}).json()
    assert all(s["available"] for s in service)


# ---------------------------------------------------------------- data/slots.json (decisión C)


def test_startup_generates_slots_json_when_missing(settings: Settings, client: TestClient) -> None:
    path = settings.slots_path
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["from"] == "2026-10-08"
    assert data["days"] == SLOTS_DAYS == 14
    slots = data["slots"]
    # 14 días desde hoy (jue 8 → mié 21): 12 días hábiles (lun–sáb) × 8 horas × 2 tipos
    assert len(slots) == 12 * 8 * 2
    assert slots[0] == {
        "id": "td-2026-10-08-09",
        "type": "test_drive",
        "start": "2026-10-08T09:00:00-05:00",
        "end": "2026-10-08T10:00:00-05:00",
        "location": "Quito Norte",
    }
    assert {s["type"] for s in slots} == {"test_drive", "service"}
    assert not any(s["id"].endswith("2026-10-11-09") for s in slots)  # domingo


def test_existing_slots_json_that_covers_today_is_reused(settings: Settings) -> None:
    clock = FixedClock(datetime(2026, 10, 8, 10, 0, tzinfo=ECUADOR_TZ))
    with TestClient(create_app(settings, clock=clock)):
        pass
    first_write = settings.slots_path.read_bytes()

    # Segundo arranque, mismo día: se reutiliza el archivo tal cual (no se reescribe).
    with TestClient(create_app(settings, clock=clock)) as client:
        assert (
            len(client.get("/availability", params={"type": "service", "date": FRIDAY}).json()) == 8
        )
    assert settings.slots_path.read_bytes() == first_write


def test_stale_slots_json_is_regenerated_from_today(settings: Settings) -> None:
    stale = SlotsRepository.generate(datetime(2026, 9, 1, 10, 0, tzinfo=ECUADOR_TZ))
    settings.slots_path.write_text(json.dumps(stale), encoding="utf-8")

    clock = FixedClock(datetime(2026, 10, 8, 10, 0, tzinfo=ECUADOR_TZ))
    app: FastAPI = create_app(settings, clock=clock)
    with TestClient(app) as client:
        assert (
            len(client.get("/availability", params={"type": "service", "date": FRIDAY}).json()) == 8
        )
    data = json.loads(settings.slots_path.read_text(encoding="utf-8"))
    assert data["from"] == "2026-10-08"


def test_generated_slots_only_on_monday_to_saturday() -> None:
    data = SlotsRepository.generate(datetime(2026, 10, 8, 10, 0, tzinfo=ECUADOR_TZ))
    weekdays = {datetime.fromisoformat(s["start"]).weekday() for s in data["slots"]}
    assert weekdays == {0, 1, 2, 3, 4, 5}
