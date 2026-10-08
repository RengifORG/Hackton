"""Esquemas de leads (`LeadCreate`, `Lead`) según docs/openapi.yaml (H1).

La entrada valida exactamente lo que dice el contrato: ni más laxa (CA1.2/CA1.3) ni más
estricta (schemathesis marca como fallo que la API rechace datos válidos según el contrato).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, StrictBool

from app.schemas.common import CamelModel, StrictInput

# `[0-9]` y no `\d`: en Pydantic (regex de Rust) `\d` acepta dígitos Unicode (p. ej. `٠١٢`);
# el patrón del contrato es JSON Schema/ECMA-262, donde `\d` es solo ASCII.
PHONE_PATTERN = r"^(\+593|0)9[0-9]{8}$"
# `format: email` en el contrato. Laxo a propósito: un `@` con texto a ambos lados y sin espacios,
# para no rechazar emails que un validador de formato estándar sí acepta.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+$"


class LeadSource(StrEnum):
    WEB = "web"
    WHATSAPP = "whatsapp"


class CrmStatus(StrEnum):
    PENDING = "pending"
    PUSHED = "pushed"
    FAILED = "failed"


def _require_true(value: bool) -> bool:
    if value is not True:
        raise ValueError("Se requiere consentimiento explícito para tratar los datos (LOPDP)")
    return value


# `const: true` del contrato: solo el booleano JSON `true` (ni `1`, ni `"true"`, ni `false`).
Consent = Annotated[StrictBool, AfterValidator(_require_true)]


class LeadCreate(StrictInput):
    """Cuerpo de `POST /leads`. Campos extra → 422 (CA1.3)."""

    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=PHONE_PATTERN)
    # Opcionales NO anulables: el tipo es `str` (sin `| None`) para que un `null` explícito dé 422,
    # como pide el contrato; el default `None` solo significa "ausente" y no se valida.
    email: str = Field(default=None, pattern=EMAIL_PATTERN)
    source: LeadSource
    interest: str = Field(default=None, max_length=200)
    recommended_models: list[str] = Field(default=None, max_length=3)
    consent: Consent
    session_id: str = Field(default=None)


class Lead(CamelModel):
    """Lead persistido y respuesta de `POST /leads` (contrato: `Lead`, objeto explícito)."""

    id: str
    name: str
    phone: str
    email: str | None = None
    source: LeadSource
    interest: str | None = None
    recommended_models: list[str] | None = None
    consent: Literal[True] = True
    session_id: str | None = None
    created_at: datetime
    after_hours: bool
    crm_status: CrmStatus | None = None


# Patrón `LeadRead.phoneMasked` del contrato v0.2.0.
PHONE_MASKED_PATTERN = r"^09\*{4}[0-9]{4}$"


class LeadRead(CamelModel):
    """Vista de lectura para la bandeja del asesor (`GET /leads`, contrato `LeadRead`).

    Nunca expone el teléfono completo ni el email; `additionalProperties: false` en el contrato,
    así que no se añaden campos fuera de esta lista.
    """

    id: str
    name: str
    phone_masked: str = Field(pattern=PHONE_MASKED_PATTERN)
    source: LeadSource
    interest: str | None = None
    recommended_models: list[str] | None = None
    created_at: datetime
    after_hours: bool
    crm_status: CrmStatus | None = None
