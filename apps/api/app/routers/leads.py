"""POST /leads y GET /leads (H1). Sin lógica de negocio: delega en `LeadService`.

Sin `from __future__ import annotations`: el decorador de slowapi envuelve la función y FastAPI
no podría resolver anotaciones en texto contra el módulo de slowapi.
"""

from fastapi import APIRouter, Request, status

from app.core.ratelimit import RATE_LIMIT, limiter
from app.schemas.lead import Lead, LeadCreate, LeadRead
from app.services.lead_service import LeadServiceDep

router = APIRouter(prefix="/leads", tags=["leads"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=Lead,
    response_model_exclude_none=True,
    operation_id="createLead",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Error de validación"},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes"},
    },
)
@limiter.limit(RATE_LIMIT)
def create_lead(request: Request, payload: LeadCreate, service: LeadServiceDep) -> Lead:
    return service.create(payload)


@router.get(
    "",
    response_model=list[LeadRead],
    response_model_exclude_none=True,
    operation_id="listLeads",
    description=(
        "Solo para mockup de asesor. En prod requeriría auth. Nunca expone el teléfono completo."
    ),
)
def list_leads(service: LeadServiceDep) -> list[LeadRead]:
    return service.list_for_advisor()
