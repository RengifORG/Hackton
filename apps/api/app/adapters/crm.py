"""CRM de asesores (HubSpot): `CrmPort` + `HubSpotCrm` (real) + `FakeCrm` (simulado/tests).

CA1.5: al crear un lead se invoca `push_lead`. Sin `HUBSPOT_TOKEN` la app usa `FakeCrm`
(en memoria) y lo declara como simulado en el README.
"""

from __future__ import annotations

import logging
from typing import Annotated, Protocol

import httpx
from fastapi import Depends, Request

from app.core.config import Settings
from app.schemas.lead import Lead

log = logging.getLogger(__name__)

HUBSPOT_API_URL = "https://api.hubapi.com"
HUBSPOT_TIMEOUT_S = 5.0


class CrmError(RuntimeError):
    """Fallo al entregar un lead al CRM. El mensaje nunca incluye PII ni el cuerpo remoto."""


class CrmPort(Protocol):
    def push_lead(self, lead: Lead) -> str:
        """Crea el contacto en el CRM y devuelve su id externo; lanza `CrmError` si falla."""
        ...


class FakeCrm:
    """CRM simulado en memoria: guarda cada lead recibido. `fail=True` simula una caída."""

    def __init__(self, *, fail: bool = False) -> None:
        self.calls: list[Lead] = []
        self.fail = fail

    def push_lead(self, lead: Lead) -> str:
        self.calls.append(lead)
        if self.fail:
            raise CrmError("FakeCrm: fallo simulado")
        external_id = f"fake-crm-{len(self.calls)}"
        log.info("crm contact created (simulado)", extra={"leadId": lead.id, "crmId": external_id})
        return external_id


class HubSpotCrm:
    """HubSpot CRM v3 · Contacts API (`POST /crm/v3/objects/contacts`) con token privado."""

    def __init__(self, token: str, *, client: httpx.Client | None = None) -> None:
        self._token = token
        self._client = client or httpx.Client(base_url=HUBSPOT_API_URL, timeout=HUBSPOT_TIMEOUT_S)

    def push_lead(self, lead: Lead) -> str:
        properties = {"firstname": lead.name, "phone": lead.phone, "lifecyclestage": "lead"}
        if lead.email:
            properties["email"] = lead.email
        response = self._client.post(
            "/crm/v3/objects/contacts",
            json={"properties": properties},
            headers={"Authorization": f"Bearer {self._token}"},
        )
        if response.is_error:
            # Sin cuerpo remoto: HubSpot puede repetir el teléfono o el email en el error.
            raise CrmError(f"HubSpot respondió {response.status_code}")
        external_id = str(response.json().get("id", ""))
        log.info("crm contact created", extra={"leadId": lead.id, "crmId": external_id})
        return external_id


def build_crm(settings: Settings) -> CrmPort:
    """`HubSpotCrm` si hay `HUBSPOT_TOKEN`; si no, `FakeCrm` (simulado)."""
    token = settings.hubspot_token.get_secret_value() if settings.hubspot_token else ""
    return HubSpotCrm(token) if token else FakeCrm()


def get_crm(request: Request) -> CrmPort:
    """Dependencia FastAPI; los tests la reemplazan con `app.dependency_overrides`."""
    return request.app.state.crm


CrmDep = Annotated[CrmPort, Depends(get_crm)]
