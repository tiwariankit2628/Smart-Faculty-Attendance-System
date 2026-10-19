import hmac
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from app.config import settings
from app.utils.logger import logger

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """
    Validates inter-service API key header (x-api-key).
    Prevents unauthorized or direct client-side (frontend) access to internal face microservice endpoints.
    Uses constant-time comparison to prevent timing side-channel attacks.
    """
    if not api_key:
        logger.warning("Unauthorized access attempt: Missing x-api-key header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "MISSING_API_KEY",
                "message": "Direct access forbidden. Valid inter-service x-api-key required.",
            },
        )

    if not hmac.compare_digest(api_key, settings.FACE_SERVICE_API_KEY):
        logger.warning("Forbidden access attempt: Invalid x-api-key provided")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INVALID_API_KEY",
                "message": "Access denied. Invalid service credentials.",
            },
        )

    return api_key
