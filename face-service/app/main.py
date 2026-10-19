import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.config import settings
from app.api.router import api_router
from app.utils.logger import logger

app = FastAPI(
    title="Facial Verification Microservice",
    description="Dedicated biometric face verification and anti-spoofing service for Geo-Verified Faculty Attendance System.",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Restrict CORS to internal backend services
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_and_audit_middleware(request: Request, call_next):
    """
    Audit logging middleware:
    Logs request paths, status codes, and execution duration.
    Strictly NEVER logs request bodies or biometric image data.
    """
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    # Sanitize logged path to prevent logging tokens
    path = request.url.path
    if path != "/health":
        logger.info(
            "%s %s -> %s (%sms) [Client: %s]",
            request.method,
            path,
            response.status_code,
            duration_ms,
            request.client.host if request.client else "unknown",
        )

    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    """
    Formats schema validation errors consistently without exposing biometric payloads.
    """
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []))
        errors.append({"field": field, "message": err.get("msg")})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "VALIDATION_ERROR",
            "message": "Invalid request parameters provided.",
            "details": errors,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    """
    Safely captures unhandled exceptions without leaking stack traces or internal secrets.
    """
    logger.error("Unhandled error encountered: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "Face verification service encountered an unexpected error.",
        },
    )


# Mount All API Routes
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Face Verification Microservice on %s:%s", settings.HOST, settings.PORT)
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
