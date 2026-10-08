"""Esquemas del chat (`ChatRequest`, `ChatResponse`) según docs/openapi.yaml (H3)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field

from app.schemas.common import CamelModel, Hotspot, StrictInput


class SuggestedAction(StrEnum):
    """Enum `suggestedActions` del contrato; el front los muestra como chips."""

    RECOMMEND = "recommend"
    LEAVE_CONTACT = "leave_contact"
    BOOK_TEST_DRIVE = "book_test_drive"
    BOOK_SERVICE = "book_service"
    VIEW_3D = "view_3d"


class ChatRequest(StrictInput):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=1000)
    model_id: str = Field(default=None)


class ChatResponse(CamelModel):
    reply: str
    suggested_actions: list[SuggestedAction]
    hotspot: Hotspot | None = None
