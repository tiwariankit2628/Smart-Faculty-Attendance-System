from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import (
    EnrollRequest,
    EnrollResponse,
    CheckFaceRequest,
    CheckFaceResponse,
    VerifyCandidateRequest,
    VerifyCandidateResponse,
    ActivateCandidateRequest,
    ActivateCandidateResponse,
)
from app.services.face_service import face_service
from app.services.face_embedding import face_embedding_manager
from app.utils.security import verify_api_key

router = APIRouter(prefix="/api/v1/face", tags=["Enrollment"])


@router.post("/check", response_model=CheckFaceResponse, dependencies=[Depends(verify_api_key)])
async def check_candidate_face(payload: CheckFaceRequest):
    """
    Validates face quality, exactly-one-face presence, and liveness before final registration.
    """
    return face_service.check_face(image_b64=payload.image)


@router.post("/enroll", response_model=EnrollResponse, dependencies=[Depends(verify_api_key)])
@router.post("/register", response_model=EnrollResponse, dependencies=[Depends(verify_api_key)], include_in_schema=False)
async def enroll_faculty_face(payload: EnrollRequest):
    """
    Enrolls a faculty member's biometric face representation.
    - Validates image quality, blur, and lighting
    - Enforces strictly exactly one face
    - Confirms anti-spoof liveness
    - Generates 128-d normalized embedding stored internally
    - Returns an opaque reference ID without exposing biometric vector
    """
    return face_service.enroll(
        faculty_id=payload.facultyId,
        image_b64=payload.image,
    )


@router.post("/candidate/verify", response_model=VerifyCandidateResponse, dependencies=[Depends(verify_api_key)])
async def verify_candidate_embedding_endpoint(payload: VerifyCandidateRequest):
    """
    Validates that a candidate embedding reference exists and belongs to the specified faculty.
    """
    is_valid = face_embedding_manager.verify_candidate_embedding(
        candidate_reference=payload.candidateEmbeddingReference,
        faculty_id=payload.facultyId,
    )
    return VerifyCandidateResponse(
        valid=is_valid,
        candidateEmbeddingReference=payload.candidateEmbeddingReference,
        facultyId=payload.facultyId,
    )


@router.post("/candidate/activate", response_model=ActivateCandidateResponse, dependencies=[Depends(verify_api_key)])
async def activate_candidate_embedding_endpoint(payload: ActivateCandidateRequest):
    """
    Atomically activates candidate embedding into active faculty profile.
    """
    new_reference = face_embedding_manager.activate_candidate_embedding(
        candidate_reference=payload.candidateEmbeddingReference,
        faculty_id=payload.facultyId,
    )
    if not new_reference:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "CANDIDATE_ACTIVATION_FAILED",
                "message": "Candidate embedding verification failed or was not found in storage.",
            },
        )
    return ActivateCandidateResponse(
        success=True,
        faceEmbeddingReference=new_reference,
        facultyId=payload.facultyId,
    )


@router.delete("/embedding/{reference_id}", dependencies=[Depends(verify_api_key)])
async def delete_embedding_endpoint(reference_id: str):
    """
    Safely purges an embedding from store.
    """
    deleted = face_embedding_manager.delete_embedding(reference_id)
    return {"success": True, "deleted": deleted, "referenceId": reference_id}

