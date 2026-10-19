from fastapi import APIRouter, Depends
from app.models.schemas import VerifyRequest, VerifyResponse
from app.services.face_service import face_service
from app.utils.security import verify_api_key

router = APIRouter(prefix="/api/v1/face", tags=["Verification"])


@router.post("/verify", response_model=VerifyResponse, dependencies=[Depends(verify_api_key)])
async def verify_faculty_face(payload: VerifyRequest):
    """
    Verifies live biometric capture against enrolled reference embedding.
    - Decodes image safely in memory
    - Validates image dimensions, blur, and lighting
    - Enforces strictly exactly one face
    - Verifies anti-spoof liveness (frequency analysis, gradient entropy, color gamut)
    - Computes cosine similarity between live face and stored enrolled vector
    - Returns structured verification response:
      {
        "verified": bool,
        "faceDetected": bool,
        "livenessVerified": bool,
        "confidence": float
      }
    """
    return face_service.verify(
        faculty_id=payload.facultyId,
        face_embedding_reference=payload.faceEmbeddingReference,
        image_b64=payload.image,
        challenge_token=payload.challengeToken,
        challenge_type=payload.challengeType,
        frames=payload.frames,
    )
