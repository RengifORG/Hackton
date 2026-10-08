"""Enmascarado de PII para respuestas de lectura y logs (CLAUDE.md §4, prompt T3 §3)."""

from __future__ import annotations

import re

_NON_DIGITS_RE = re.compile(r"\D")
# Celular EC con separadores opcionales: 09XXXXXXXX · +593 9X XXX XXXX · 593-9…
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?593[\s.\-]?|0)9(?:[\s.\-]?\d){8}(?!\d)")
_EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")
# Cédula/RUC: 10 o 13 dígitos seguidos (los presupuestos nunca llegan a 10 cifras).
_ID_RE = re.compile(r"(?<!\d)(?:\d{13}|\d{10})(?!\d)")


def mask_phone(phone: str) -> str:
    """`0991234567`, `+593 99 123 4567` → `09****4567` (patrón `phoneMasked` del contrato)."""
    digits = _NON_DIGITS_RE.sub("", phone.replace("%2B", "+").replace("%2b", "+"))
    if digits.startswith("593"):
        digits = "0" + digits[3:]
    if len(digits) < 6:
        return "****"
    return f"{digits[:2]}****{digits[-4:]}"


def redact_free_text(text: str) -> str:
    """Texto libre del usuario antes de ir a un LLM: teléfono, email y cédula → marcadores."""
    text = _EMAIL_RE.sub("{EMAIL}", text)
    text = _PHONE_RE.sub("{PHONE}", text)
    return _ID_RE.sub("{ID}", text)
