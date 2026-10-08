"""Elección de franja en lenguaje natural (H3/H4).

Ejemplos: «mañana 10 am», «el sábado a las 3», «12/10 11:00», «a las 9 de la mañana».

Determinista (regex): la cita solo se crea con una franja real del calendario que el servicio
valida; nada de esto pasa por el LLM. Recibe el texto ya normalizado (minúsculas, sin acentos).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

WEEKDAYS = {
    "lunes": 0,
    "martes": 1,
    "miercoles": 2,
    "jueves": 3,
    "viernes": 4,
    "sabado": 5,
    "domingo": 6,
}
MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}
# Sin am/pm, "a las 3" en horario de taller/concesionario (09–17) es de la tarde.
AFTERNOON_IF_BARE = range(1, 8)

_AM_RE = re.compile(r"\b(de|en|por) la manana\b")
_PM_RE = re.compile(r"\b(de|en|por) la (tarde|noche)\b")
_DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/\d{2,4})?\b")
_DATE_WORDS_RE = re.compile(r"\b(\d{1,2}) de (" + "|".join(MONTHS) + r")\b")
_HOUR_MIN_RE = re.compile(r"\b(\d{1,2})(?::|h|\.)(\d{2})\b")
_HOUR_SUFFIX_RE = re.compile(r"\b(\d{1,2})\s*(a\s?m|p\s?m|hrs?|horas|h)\b")
_HOUR_BARE_RE = re.compile(r"\b(\d{1,2})\b")
_OTHER_DAY_RE = re.compile(r"\b(otro dia|otra fecha|otro dia mejor|mas adelante)\b")


@dataclass(frozen=True)
class SlotRequest:
    day: date | None = None
    hour: int | None = None
    minute: int = 0
    other_day: bool = False

    @property
    def empty(self) -> bool:
        return self.day is None and self.hour is None and not self.other_day


def _next_weekday(today: date, weekday: int) -> date:
    ahead = (weekday - today.weekday()) % 7
    return today + timedelta(days=ahead or 7)


def _safe_date(year: int, month: int, day: int, today: date) -> date | None:
    try:
        candidate = date(year, month, day)
    except ValueError:
        return None
    return candidate if candidate >= today else _safe_date(year + 1, month, day, date.min)


def parse_slot_request(norm: str, today: date) -> SlotRequest:
    text = f" {norm.replace('.', ' ').replace(',', ' ')} "  # «a.m.» → «a m»; fechas usan «/»
    am = bool(_AM_RE.search(text))
    pm = bool(_PM_RE.search(text))
    text = _PM_RE.sub(" ", _AM_RE.sub(" ", text))

    day: date | None = None
    if (match := _DATE_RE.search(text)) is not None:
        day = _safe_date(today.year, int(match.group(2)), int(match.group(1)), today)
        text = text.replace(match.group(0), " ")
    elif (match := _DATE_WORDS_RE.search(text)) is not None:
        day = _safe_date(today.year, MONTHS[match.group(2)], int(match.group(1)), today)
        text = text.replace(match.group(0), " ")
    elif re.search(r"\bpasado manana\b", text):
        day = today + timedelta(days=2)
    elif re.search(r"\bmanana\b", text):
        day = today + timedelta(days=1)
    elif re.search(r"\bhoy\b", text):
        day = today
    else:
        for name, weekday in WEEKDAYS.items():
            if re.search(rf"\b{name}\b", text):
                day = _next_weekday(today, weekday)
                break

    hour: int | None = None
    minute = 0
    explicit = False
    if "mediodia" in text:
        hour, explicit = 12, True
    elif (match := _HOUR_MIN_RE.search(text)) is not None:
        hour, minute, explicit = int(match.group(1)), int(match.group(2)), True
    elif (match := _HOUR_SUFFIX_RE.search(text)) is not None:
        hour = int(match.group(1))
        suffix = match.group(2).replace(" ", "")
        am, pm = am or suffix == "am", pm or suffix == "pm"
        explicit = suffix in {"hrs", "hr", "horas", "h"}
    elif (match := _HOUR_BARE_RE.search(text)) is not None:
        hour = int(match.group(1))

    if hour is not None:
        if pm and hour < 12:
            hour += 12
        elif am and hour == 12:
            hour = 0
        elif not (am or pm or explicit) and hour in AFTERNOON_IF_BARE:
            hour += 12
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            hour, minute = None, 0

    return SlotRequest(
        day=day, hour=hour, minute=minute, other_day=bool(_OTHER_DAY_RE.search(text))
    )
