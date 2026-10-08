"""GET /health — liveness."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["meta"])


@router.get("/health", operation_id="health")
def health() -> dict[str, str]:
    return {"status": "ok"}
