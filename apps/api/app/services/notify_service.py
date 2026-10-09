"""H7a · Confirmaciones salientes por WhatsApp (lead fuera de horario y cita confirmada).

Best-effort: si no hay WhatsApp configurado no hace nada, y un fallo nunca rompe el 201 del
lead o la cita. En logs el teléfono va siempre enmascarado.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends

from app.adapters.whatsapp import WhatsAppDep, WhatsAppPort
from app.core.clock import ECUADOR_TZ
from app.core.pii import mask_phone, to_wa_digits
from app.schemas.appointment import Appointment, AppointmentType
from app.schemas.lead import Lead

log = logging.getLogger(__name__)

TYPE_LABEL = {
    AppointmentType.TEST_DRIVE: "prueba de manejo",
    AppointmentType.SERVICE: "cita de taller",
}


def _first_name(lead: Lead) -> str:
    return lead.name.split()[0] if lead.name.split() else lead.name


def lead_after_hours_text(lead: Lead) -> str:
    return (
        f"Hola {_first_name(lead)}, recibimos tus datos fuera de horario. "
        "Un asesor de BYD Ecuador te contactará desde las 08:00."
    )


def appointment_confirmed_text(appointment: Appointment, lead: Lead) -> str:
    start = appointment.slot.start.astimezone(ECUADOR_TZ)
    text = (
        f"✅ {_first_name(lead)}, tu {TYPE_LABEL[appointment.type]} queda el "
        f"{start:%d/%m %H:%M} en {appointment.slot.location}."
    )
    if appointment.loyalty_note:  # solo citas `service` (decisión A)
        text += f"\n{appointment.loyalty_note}"
    return text


class WhatsAppNotifier:
    def __init__(self, whatsapp: WhatsAppPort | None) -> None:
        self._whatsapp = whatsapp

    def lead_after_hours(self, lead: Lead) -> bool:
        return self._send(lead, lead_after_hours_text(lead), "lead_after_hours")

    def appointment_confirmed(self, appointment: Appointment, lead: Lead) -> bool:
        return self._send(lead, appointment_confirmed_text(appointment, lead), "appointment")

    def _send(self, lead: Lead, body: str, kind: str) -> bool:
        if self._whatsapp is None:
            return False
        try:
            ok = self._whatsapp.send_text(to_wa_digits(lead.phone), body)
        except Exception as exc:  # el adapter no lanza, pero el aviso nunca rompe el flujo
            log.warning("whatsapp notify failed", extra={"kind": kind, "error": type(exc).__name__})
            return False
        log.info(
            "whatsapp notify",
            extra={"kind": kind, "leadId": lead.id, "to": mask_phone(lead.phone), "ok": ok},
        )
        return ok


def get_notifier(whatsapp: WhatsAppDep) -> WhatsAppNotifier:
    return WhatsAppNotifier(whatsapp)


NotifierDep = Annotated[WhatsAppNotifier, Depends(get_notifier)]
