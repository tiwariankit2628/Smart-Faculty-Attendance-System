from typing import List, Optional
from pydantic import BaseModel, Field


class CheckFaceRequest(BaseModel):
    """
    Request payload for pre-registration face validation.
    """
    image: str = Field(..., min_length=100, description="Base64 encoded face photo")


class CheckFaceResponse(BaseModel):
    """
    Response returned from pre-registration face validation.
    """
    valid: bool = True
    faceDetected: bool = True
    livenessPassed: bool = True
    qualityScore: float = Field(..., ge=0.0, le=1.0)
    message: str = "Face detected clearly and ready for registration."


class EnrollRequest(BaseModel):
    """
    Request payload for faculty face enrollment/registration.
    """
    facultyId: str = Field(..., min_length=1, max_length=128, description="Unique Faculty Identifier")
    image: str = Field(..., min_length=100, description="Base64 encoded face photo (JPEG/PNG/WebP)")


class EnrollResponse(BaseModel):
    """
    Response returned upon successful biometric enrollment.
    Does NOT expose raw embedding vectors.
    """
    success: bool = True
    faceEmbeddingReference: str = Field(..., description="Secure opaque reference identifier")
    facultyId: str
    faceDetected: bool = True
    qualityScore: float = Field(..., ge=0.0, le=1.0)
    message: str = "Faculty face biometrics enrolled successfully."


class VerifyRequest(BaseModel):
    """
    Request payload for attendance face verification with multi-frame liveness support.
    """
    facultyId: str = Field(..., min_length=1, max_length=128, description="Unique Faculty Identifier")
    faceEmbeddingReference: Optional[str] = Field(
        default=None,
        description="Optional pre-existing embedding reference token",
    )
    image: str = Field(..., min_length=100, description="Primary base64 encoded live capture for biometric identity matching")
    frames: Optional[List[str]] = Field(
        default=None,
        description="Optional multi-frame sequence captured across the challenge window for liveness evaluation",
    )
    challengeToken: Optional[str] = Field(
        default=None,
        description="Optional anti-replay challenge nonce",
    )
    challengeType: Optional[str] = Field(
        default=None,
        description="Server-issued challenge type: TURN_LEFT, TURN_RIGHT, LOOK_UP, LOOK_DOWN, BLINK",
    )


class VerifyResponse(BaseModel):
    """
    Structured verification response with independent identity and liveness metrics.
    Fails closed by default.
    """
    verified: bool = Field(default=False, description="Overall verification outcome (identityMatched AND livenessVerified)")
    identityMatched: bool = Field(default=False, description="Explicit biometric identity decision")
    similarity: float = Field(default=0.0, description="Raw SFace Cosine similarity metric [0.0 - 1.0]")
    distance: float = Field(default=2.0, description="Raw SFace L2 Euclidean distance metric")
    faceDetected: bool = Field(default=False, description="Whether exactly one face was detected")
    livenessVerified: bool = Field(default=False, description="Whether multi-frame liveness verification passed")
    livenessStatus: str = Field(default="NOT_CHECKED", description="Liveness status: NOT_STARTED, IN_PROGRESS, PASSED, FAILED, EXPIRED, NOT_CHECKED")
    livenessScore: float = Field(default=0.0, description="Kinematic and passive liveness score")
    challengeType: Optional[str] = Field(default=None, description="The liveness challenge evaluated")
    confidence: float = Field(default=0.0, description="Raw similarity value preserved for backwards compatibility")
    bestFrameIndex: Optional[int] = Field(default=None, description="Index of the highest matching verified frame in the sequence")
    reason: Optional[str] = Field(default=None, description="Detailed failure or success reason")
    errorCode: Optional[str] = Field(default=None, description="Standard error code if rejected")


class LivenessRequest(BaseModel):
    """
    Request payload for standalone liveness verification.
    Accepts multi-frame sequence or single frame.
    """
    frames: Optional[List[str]] = Field(default=None, description="Sequence of live camera frames (at least 2 required)")
    image: Optional[str] = Field(default=None, description="Optional single face capture (rejected for liveness)")
    challengeType: Optional[str] = Field(default=None, description="Expected challenge: TURN_LEFT, TURN_RIGHT, LOOK_UP, LOOK_DOWN, BLINK")
    challengeToken: Optional[str] = Field(default=None, description="Server-issued challenge nonce")


class LivenessResponse(BaseModel):
    """
    Structured response for liveness assessment.
    """
    isLive: bool = False
    livenessVerified: bool = False
    livenessStatus: str = "FAILED"
    faceDetected: bool = False
    livenessScore: float = 0.0
    challengeType: Optional[str] = None
    challengePassed: bool = False
    message: str = ""
    reason: Optional[str] = None
    errorCode: Optional[str] = None


class HealthResponse(BaseModel):
    """
    Health check response model.
    """
    status: str = "healthy"
    service: str = "face-verification-microservice"
    version: str = "1.0.0"
    timestamp: str


class VerifyCandidateRequest(BaseModel):
    candidateEmbeddingReference: str = Field(..., min_length=1)
    facultyId: str = Field(..., min_length=1)


class VerifyCandidateResponse(BaseModel):
    valid: bool
    candidateEmbeddingReference: str
    facultyId: str


class ActivateCandidateRequest(BaseModel):
    candidateEmbeddingReference: str = Field(..., min_length=1)
    facultyId: str = Field(..., min_length=1)


class ActivateCandidateResponse(BaseModel):
    success: bool
    faceEmbeddingReference: str
    facultyId: str

