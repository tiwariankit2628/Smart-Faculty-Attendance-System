from datetime import datetime, timezone
from fastapi import APIRouter
from app.models.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Standard microservice health check endpoint.
    Used by container orchestration (Docker/Kubernetes) and load balancers.
    """
    return HealthResponse(
        status="healthy",
        service="face-verification-microservice",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
