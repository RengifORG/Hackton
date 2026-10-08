"""Calendario de franjas: `SlotsRepository` genera y lee `data/slots.json` (decisión C).

Franjas de 14 días desde hoy, lunes a sábado, 09:00–17:00 cada hora, en hora de Ecuador.
`test_drive` → "Quito Norte" · `service` → "Taller Quito". Ids deterministas: `td-2026-10-09-09`.
Si el archivo no existe o ya no cubre el día de hoy, se regenera (la demo funciona cualquier día).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, Request

from app.core.clock import ECUADOR_TZ, Clock
from app.schemas.appointment import AppointmentType

log = logging.getLogger(__name__)

SLOTS_DAYS = 14
OPEN_HOUR = 9
CLOSE_HOUR = 17  # última franja 16:00–17:00
SUNDAY = 6
LOCATIONS = {AppointmentType.TEST_DRIVE: "Quito Norte", AppointmentType.SERVICE: "Taller Quito"}
ID_PREFIX = {AppointmentType.TEST_DRIVE: "td", AppointmentType.SERVICE: "sv"}


@dataclass(frozen=True)
class SlotDef:
    id: str
    type: AppointmentType
    start: datetime
    end: datetime
    location: str


class SlotsRepository:
    def __init__(self, slots: list[SlotDef], from_day: date, days: int) -> None:
        self._by_id = {s.id: s for s in slots}
        self._from_day = from_day
        self._days = days

    # ---------------------------------------------------------------- generación / carga
    @staticmethod
    def generate(now: datetime) -> dict[str, Any]:
        """Estructura JSON-serializable de `data/slots.json` a partir de la fecha de `now` (EC)."""
        local_now = now.astimezone(ECUADOR_TZ)
        first_day = local_now.date()
        slots: list[dict[str, str]] = []
        for offset in range(SLOTS_DAYS):
            day = first_day + timedelta(days=offset)
            if day.weekday() == SUNDAY:
                continue
            for slot_type in AppointmentType:
                for hour in range(OPEN_HOUR, CLOSE_HOUR):
                    start = datetime.combine(day, time(hour), tzinfo=ECUADOR_TZ)
                    slots.append(
                        {
                            "id": f"{ID_PREFIX[slot_type]}-{day.isoformat()}-{hour:02d}",
                            "type": slot_type.value,
                            "start": start.isoformat(),
                            "end": (start + timedelta(hours=1)).isoformat(),
                            "location": LOCATIONS[slot_type],
                        }
                    )
        return {
            "generatedAt": local_now.isoformat(timespec="seconds"),
            "from": first_day.isoformat(),
            "days": SLOTS_DAYS,
            "slots": slots,
        }

    @classmethod
    def from_data(cls, data: dict[str, Any]) -> SlotsRepository:
        slots = [
            SlotDef(
                id=item["id"],
                type=AppointmentType(item["type"]),
                start=datetime.fromisoformat(item["start"]),
                end=datetime.fromisoformat(item["end"]),
                location=item["location"],
            )
            for item in data["slots"]
        ]
        return cls(slots, date.fromisoformat(data["from"]), int(data["days"]))

    @staticmethod
    def _covers(data: dict[str, Any], today: date) -> bool:
        first_day = date.fromisoformat(data["from"])
        return first_day <= today <= first_day + timedelta(days=int(data["days"]) - 1)

    @classmethod
    def load_or_generate(cls, path: Path, clock: Clock) -> SlotsRepository:
        now = clock.now()
        today = now.astimezone(ECUADOR_TZ).date()
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            if cls._covers(data, today):
                log.info("slots loaded", extra={"path": str(path), "slots": len(data["slots"])})
                return cls.from_data(data)
            log.info("slots file stale, regenerating", extra={"path": str(path)})
        data = cls.generate(now)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        log.info("slots generated", extra={"path": str(path), "slots": len(data["slots"])})
        return cls.from_data(data)

    # ---------------------------------------------------------------- consultas
    def get(self, slot_id: str) -> SlotDef | None:
        return self._by_id.get(slot_id)

    def for_day(self, slot_type: AppointmentType, day: date) -> list[SlotDef]:
        return [
            s
            for s in self._by_id.values()
            if s.type == slot_type and s.start.astimezone(ECUADOR_TZ).date() == day
        ]

    def __len__(self) -> int:
        return len(self._by_id)


def get_slots_repo(request: Request) -> SlotsRepository:
    """Dependencia FastAPI: el calendario se carga/genera en el lifespan."""
    return request.app.state.slots_repo


SlotsDep = Annotated[SlotsRepository, Depends(get_slots_repo)]
