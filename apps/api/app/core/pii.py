"""Enmascarado de PII para respuestas de lectura y logs (CLAUDE.md §4, prompt T3 §3)."""

from __future__ import annotations

import re

_NON_DIGITS_RE = re.compile(r"\D")


def mask_phone(phone: str) -> str:
    """`0991234567`, `+593 99 123 4567` → `09****4567` (patrón `phoneMasked` del contrato)."""
    digits = _NON_DIGITS_RE.sub("", phone.replace("%2B", "+").replace("%2b", "+"))
    if digits.startswith("593"):
        digits = "0" + digits[3:]
    if len(digits) < 6:
        return "****"
    return f"{digits[:2]}****{digits[-4:]}"
