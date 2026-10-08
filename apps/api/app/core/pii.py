"""Enmascarado de PII para respuestas de lectura y logs (CLAUDE.md §4, prompt T3 §3)."""

from __future__ import annotations

import re

_NON_DIGITS_RE = re.compile(r"\D")


def mask_phone(phone: str) -> str:
    """`0991234567`, `+593 99 123 4567` → `09****4567` (formato `leadPhoneMasked` del contrato)."""
    digits = _NON_DIGITS_RE.sub("", phone.replace("%2B", "+").replace("%2b", "+"))
    if digits.startswith("593"):
        digits = "0" + digits[3:]
    if len(digits) < 6:
        return "****"
    return f"{digits[:2]}****{digits[-4:]}"


def mask_email(email: str) -> str:
    """`ana.perez@example.com` → `a***@example.com` (sigue siendo un email con formato válido)."""
    local, separator, domain = email.partition("@")
    if not separator or not local or not domain:
        return "***"
    return f"{local[0]}***@{domain}"
