"""POST /recommendations (H2). Sin lógica de negocio: delega en `RecommendationService`."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.recommendation import RecommendationRequest, RecommendationResponse
from app.services.recommendation_service import RecommendationServiceDep

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post(
    "",
    response_model=RecommendationResponse,
    operation_id="recommend",
    responses={status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Error de validación"}},
)
def recommend(
    payload: RecommendationRequest, service: RecommendationServiceDep
) -> RecommendationResponse:
    return RecommendationResponse(items=service.recommend(payload.profile))
