from fastapi import APIRouter, Depends
from app.models.schemas import LivenessRequest, LivenessResponse
from app.services.face_service import face_service
from app.utils.security import verify_api_key

router = APIRouter(prefix="/api/v1/face", tags=["Liveness"])


@router.post("/liveness", response_model=LivenessResponse, dependencies=[Depends(verify_api_key)])
async def evaluate_liveness(payload: LivenessRequest):
    """
    Dedicated anti-spoofing and liveness evaluation endpoint.
    - Evaluates 2D FFT frequency spectrum for screen display / Moire artifacts
    - Evaluates local gradient depth entropy against 2D printouts
    - Checks chromatic skin reflection locus in YCrCb space
    """
    return face_service.check_liveness(
        image_b64=payload.image,
        frames=payload.frames,
        challenge_token=payload.challengeToken,
        challenge_type=payload.challengeType,
    )
