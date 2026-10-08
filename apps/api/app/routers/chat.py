"""POST /chat (H3). Sin lógica de negocio: delega en `ChatService`.

Sin `from __future__ import annotations`: el decorador de slowapi envuelve la función y FastAPI
no podría resolver anotaciones en texto contra el módulo de slowapi.
"""

from fastapi import APIRouter, Request, status

from app.core.ratelimit import RATE_LIMIT, limiter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatServiceDep

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "",
    response_model=ChatResponse,
    response_model_exclude_none=True,
    operation_id="chat",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Error de validación"},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes"},
    },
)
@limiter.limit(RATE_LIMIT)
def chat(request: Request, payload: ChatRequest, service: ChatServiceDep) -> ChatResponse:
    return service.handle(payload)
