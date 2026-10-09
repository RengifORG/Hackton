"""H1 · Captación de leads: persistir, marcar `afterHours` (hora Ecuador) y entregar al CRM.

Lo usan `POST /leads` y, en F3, el chat (mismo código: un lead siempre pasa por aquí).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import Depends

from app.adapters.crm import CrmDep, CrmPort
from app.core.clock import ECUADOR_TZ, Clock, ClockDep
from app.core.pii import mask_phone
from app.repositories.memory import LeadRepo, LeadRepoDep
from app.schemas.lead import CrmStatus, Lead, LeadCreate, LeadRead
from app.services.notify_service import NotifierDep, WhatsAppNotifier

log = logging.getLogger(__name__)

# Horario del call center (SPEC: cierra a las 18:00). Fuera de [08:00, 18:00) → afterHours.
OFFICE_OPENS_AT = 8
OFFICE_CLOSES_AT = 18


def is_after_hours(moment: datetime) -> bool:
    """CA1.4: `True` si la hora en Ecuador es anterior a 08:00 o desde las 18:00."""
    local = moment.astimezone(ECUADOR_TZ)
    return local.hour < OFFICE_OPENS_AT or local.hour >= OFFICE_CLOSES_AT


class LeadService:
    def __init__(
        self,
        repo: LeadRepo,
        crm: CrmPort,
        clock: Clock,
        notifier: WhatsAppNotifier | None = None,
    ) -> None:
        self._repo = repo
        self._crm = crm
        self._clock = clock
        self._notifier = notifier

    def create(self, data: LeadCreate) -> Lead:
        now = self._clock.now().astimezone(ECUADOR_TZ)
        lead = Lead.model_validate(
            {
                **data.model_dump(by_alias=False, exclude_none=True),
                "id": str(uuid4()),
                "created_at": now,
                "after_hours": is_after_hours(now),
                "crm_status": CrmStatus.PENDING,
            }
        )
        # Se persiste ANTES del CRM: una caída externa nunca hace perder el lead.
        self._repo.save(lead)
        lead = lead.model_copy(update={"crm_status": self._push_to_crm(lead)})
        self._repo.save(lead)
        if lead.after_hours and self._notifier is not None:
            self._notify_after_hours(lead)  # CA7.1: confirmación saliente, best-effort
        log.info(
            "lead created",
            extra={
                "leadId": lead.id,
                "source": lead.source.value,
                "afterHours": lead.after_hours,
                "crmStatus": lead.crm_status,
            },
        )
        return lead

    def list_for_advisor(self) -> list[LeadRead]:
        """Bandeja /asesor: vista `LeadRead` (teléfono enmascarado, sin email)."""
        return [self.to_read_view(lead) for lead in self._repo.list()]

    @staticmethod
    def to_read_view(lead: Lead) -> LeadRead:
        return LeadRead(
            id=lead.id,
            name=lead.name,
            phone_masked=mask_phone(lead.phone),
            source=lead.source,
            interest=lead.interest,
            recommended_models=lead.recommended_models,
            created_at=lead.created_at,
            after_hours=lead.after_hours,
            crm_status=lead.crm_status,
        )

    def _notify_after_hours(self, lead: Lead) -> None:
        try:
            self._notifier.lead_after_hours(lead)  # type: ignore[union-attr]
        except Exception as exc:  # nunca rompe el 201
            log.warning(
                "whatsapp after-hours failed",
                extra={"leadId": lead.id, "error": type(exc).__name__},
            )

    def _push_to_crm(self, lead: Lead) -> CrmStatus:
        try:
            self._crm.push_lead(lead)
        except Exception as exc:  # cualquier fallo del CRM deja el lead como `failed`
            # Solo el tipo: el mensaje de un error remoto podría contener PII.
            log.warning("crm push failed", extra={"leadId": lead.id, "error": type(exc).__name__})
            return CrmStatus.FAILED
        return CrmStatus.PUSHED


def get_lead_service(
    repo: LeadRepoDep, crm: CrmDep, clock: ClockDep, notifier: NotifierDep
) -> LeadService:
    return LeadService(repo, crm, clock, notifier)


LeadServiceDep = Annotated[LeadService, Depends(get_lead_service)]
