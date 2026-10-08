"""WhatsApp saliente (H7a): `WhatsAppPort` + `MetaWhatsApp` (Cloud API) + `FakeWhatsApp` (tests).

Best-effort: `send_text` nunca lanza; devuelve `True`/`False`. Los logs llevan solo el status,
el `error.code` de Meta y un sufijo del message id: nunca el cuerpo, el token ni el teléfono.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Protocol

import httpx
from fastapi import Depends, Request

from app.core.config import Settings

log = logging.getLogger(__name__)

GRAPH_API_URL = "https://graph.facebook.com"
WHATSAPP_TIMEOUT_S = 5.0


class WhatsAppPort(Protocol):
    def send_text(self, to_digits: str, body: str) -> bool:
        """Envía un texto a `to_digits` (p. ej. `593991234567`); `False` si no se pudo."""
        ...


class FakeWhatsApp:
    """Simulado/tests: guarda cada envío en `sent`. `fail=True` simula un rechazo de Meta."""

    def __init__(self, *, fail: bool = False) -> None:
        self.sent: list[tuple[str, str]] = []
        self.fail = fail

    def send_text(self, to_digits: str, body: str) -> bool:
        self.sent.append((to_digits, body))
        return not self.fail


def _tail(value: str, keep: int = 6) -> str:
    return f"…{value[-keep:]}" if value else ""


class MetaWhatsApp:
    """Meta WhatsApp Cloud API · `POST /{version}/{phone_number_id}/messages` (texto)."""

    def __init__(
        self,
        token: str,
        phone_number_id: str,
        version: str = "v25.0",
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self._token = token
        self._url = f"{GRAPH_API_URL}/{version}/{phone_number_id}/messages"
        self._client = client or httpx.Client(timeout=WHATSAPP_TIMEOUT_S)

    def send_text(self, to_digits: str, body: str) -> bool:
        payload = {
            "messaging_product": "whatsapp",
            "to": to_digits,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }
        try:
            response = self._client.post(
                self._url, json=payload, headers={"Authorization": f"Bearer {self._token}"}
            )
        except httpx.HTTPError as exc:
            log.warning("whatsapp send failed", extra={"error": type(exc).__name__})
            return False
        data = self._json(response)
        if response.is_error:
            error = data.get("error") if isinstance(data.get("error"), dict) else {}
            log.warning(
                "whatsapp send rejected",
                extra={"status": response.status_code, "errorCode": error.get("code")},
            )
            return False
        messages = data.get("messages") or [{}]
        message_id = str(messages[0].get("id", "")) if isinstance(messages[0], dict) else ""
        log.info(
            "whatsapp sent",
            extra={"status": response.status_code, "messageId": _tail(message_id)},
        )
        return True

    @staticmethod
    def _json(response: httpx.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}


def build_whatsapp(settings: Settings) -> WhatsAppPort | None:
    """`MetaWhatsApp` solo con WHATSAPP_ENABLED=1, token y phone id; si no, `None` (no envía)."""
    token = settings.whatsapp_token.get_secret_value() if settings.whatsapp_token else ""
    if not (settings.whatsapp_enabled and token and settings.whatsapp_phone_number_id):
        return None
    return MetaWhatsApp(token, settings.whatsapp_phone_number_id, settings.whatsapp_api_version)


def get_whatsapp(request: Request) -> WhatsAppPort | None:
    """Dependencia FastAPI; los tests la reemplazan con `app.dependency_overrides`."""
    return getattr(request.app.state, "whatsapp", None)


WhatsAppDep = Annotated[WhatsAppPort | None, Depends(get_whatsapp)]
