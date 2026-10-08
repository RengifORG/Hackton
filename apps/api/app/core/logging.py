"""Logging estructurado (JSON por línea) con redacción de PII.

Regla CLAUDE.md §4: teléfono, email y cédula nunca llegan a los logs. El filtro redacta
mensaje, argumentos y campos `extra=` (incluidos objetos: Pydantic, dataclass, excepciones);
el formatter vuelve a redactar el texto final y todo lo que `json.dumps` tenga que convertir.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

# Teléfono EC local (09…) o internacional (+5939… / %2B5939…), tolerando espacios, puntos o
# guiones entre dígitos; email; cédula (10 dígitos seguidos).
_PHONE_RE = re.compile(r"(?<![\d+])(?:\+593|%2B593|0)[ .-]?9(?:[ .-]?\d){8}(?!\d)")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_NATIONAL_ID_RE = re.compile(r"(?<!\d)\d{10}(?!\d)")
_NON_DIGITS_RE = re.compile(r"\D")

_HANDLER_MARK = "_byd_json_handler"
# Atributos propios de LogRecord (no son campos `extra=`); `color_message` lo añade uvicorn.
_STANDARD_ATTRS = frozenset(
    set(vars(logging.LogRecord("x", logging.INFO, "x", 0, "x", None, None)))
    | {"message", "asctime", "color_message"}
)


def mask_phone(phone: str) -> str:
    """`0991234567`, `+593 99 123 4567` → `09****4567` (formato `leadPhoneMasked` del contrato)."""
    digits = _NON_DIGITS_RE.sub("", phone.replace("%2B", "+").replace("%2b", "+"))
    if digits.startswith("593"):
        digits = "0" + digits[3:]
    if len(digits) < 6:
        return "****"
    return f"{digits[:2]}****{digits[-4:]}"


def redact(text: str) -> str:
    """Enmascara teléfonos, emails y cédulas dentro de un texto libre."""
    text = _PHONE_RE.sub(lambda m: mask_phone(m.group(0)), text)
    text = _EMAIL_RE.sub("[email]", text)
    return _NATIONAL_ID_RE.sub("[id]", text)


def _redact_value(value: Any) -> Any:
    """Redacta recursivamente; cualquier objeto no primitivo se redacta sobre su `str()`."""
    if isinstance(value, str):
        return redact(value)
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, dict):
        return {k: _redact_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_value(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_redact_value(v) for v in value)
    return redact(str(value))


class PiiRedactionFilter(logging.Filter):
    """Redacta `msg`, `args` y campos extra antes de que cualquier handler los escriba.

    Nunca lanza: un fallo en la redacción no debe tumbar el código de negocio que loguea
    (el formatter aplica una segunda redacción sobre el texto final).
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                record.msg = redact(record.msg)
            if record.args:
                record.args = (
                    _redact_value(record.args)
                    if isinstance(record.args, dict)
                    else tuple(_redact_value(a) for a in record.args)
                )
            for key, value in list(vars(record).items()):
                if key not in _STANDARD_ATTRS:
                    setattr(record, key, _redact_value(value))
        except Exception:  # noqa: BLE001 - la redacción es best-effort, el formatter cubre
            record.args = ()
        return True


class JsonFormatter(logging.Formatter):
    """Una línea JSON por evento; los campos `extra=` se añaden al objeto."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
        }
        for key, value in vars(record).items():
            if key not in _STANDARD_ATTRS and key not in payload:
                payload[key] = _redact_value(value)
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False, default=lambda o: redact(str(o)))


def build_handler(stream: Any = None) -> logging.Handler:
    handler = logging.StreamHandler(stream or sys.stderr)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(PiiRedactionFilter())
    setattr(handler, _HANDLER_MARK, True)
    return handler


def configure_logging(level: str = "INFO", stream: Any = None) -> None:
    """Configura el logger raíz (idempotente) y enruta uvicorn por el mismo handler."""
    root = logging.getLogger()
    root.handlers = [h for h in root.handlers if not getattr(h, _HANDLER_MARK, False)]
    root.addHandler(build_handler(stream))
    root.setLevel(level.upper())
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True
