from fastapi import APIRouter
from app.api.endpoints.health import router as health_router
from app.api.endpoints.enroll import router as enroll_router
from app.api.endpoints.verify import router as verify_router
from app.api.endpoints.liveness import router as liveness_router

api_router = APIRouter()

# Top-level health check (GET /health)
api_router.include_router(health_router)

# Biometric face endpoints
api_router.include_router(enroll_router)
api_router.include_router(verify_router)
api_router.include_router(liveness_router)
