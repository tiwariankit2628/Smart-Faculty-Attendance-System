import base64
import io
import cv2
import numpy as np
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.face_detector import FaceDetectionResult, face_detector
from app.services.image_quality import image_quality_validator

client = TestClient(app)
AUTH_HEADERS = {"x-api-key": settings.FACE_SERVICE_API_KEY}


def create_test_image_base64(
    width: int = 200,
    height: int = 200,
    color: tuple = (180, 160, 140),
    add_noise: bool = True,
) -> str:
    """Helper creating a valid in-memory test image with adjustable dimensions & texture."""
    img_arr = np.full((height, width, 3), color, dtype=np.uint8)
    if add_noise:
        noise = np.random.randint(-20, 20, (height, width, 3), dtype=np.int16)
        img_arr = np.clip(img_arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    pil_img = Image.fromarray(img_arr)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="JPEG", quality=90)
    raw_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{raw_b64}"


def test_health_endpoint():
    """Verify GET /health returns 200 OK without requiring authentication."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "face-verification-microservice"
    assert "version" in data


def test_auth_rejection_missing_key():
    """Verify access without x-api-key header returns 401 Unauthorized."""
    payload = {"facultyId": "fac_001", "image": create_test_image_base64()}
    response = client.post("/api/v1/face/verify", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "MISSING_API_KEY"


def test_auth_rejection_invalid_key():
    """Verify access with invalid x-api-key returns 403 Forbidden."""
    payload = {"facultyId": "fac_001", "image": create_test_image_base64()}
    response = client.post(
        "/api/v1/face/verify",
        json=payload,
        headers={"x-api-key": "wrong_invalid_secret_key"},
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "INVALID_API_KEY"


def test_reject_low_resolution_image():
    """Verify images smaller than minimum dimension are rejected."""
    small_image = create_test_image_base64(width=80, height=80)
    payload = {"facultyId": "fac_001", "image": small_image}
    response = client.post("/api/v1/face/enroll", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "LOW_IMAGE_RESOLUTION"


def test_reject_blurry_image():
    """Verify completely flat/uniform blurry images fail the sharpness check."""
    flat_image = create_test_image_base64(width=200, height=200, add_noise=False)
    payload = {"facultyId": "fac_001", "image": flat_image}
    response = client.post("/api/v1/face/enroll", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "IMAGE_TOO_BLURRY"


def test_no_face_detected(monkeypatch):
    """Verify image containing no detectable face is rejected."""
    test_image = create_test_image_base64(width=200, height=200)

    # Mock face_detector to return 0 faces
    monkeypatch.setattr(
        face_detector,
        "detect_face",
        lambda img: FaceDetectionResult(
            detected=False,
            face_count=0,
            error_code="NO_FACE_DETECTED",
            error_message="No face detected in the image.",
        ),
    )

    payload = {"facultyId": "fac_001", "image": test_image}
    response = client.post("/api/v1/face/verify", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False
    assert data["faceDetected"] is False
    assert data["livenessVerified"] is False
    assert data["confidence"] == 0.0


def test_multiple_faces_detected(monkeypatch):
    """Verify image containing multiple faces is rejected (strictly exactly one face)."""
    test_image = create_test_image_base64(width=200, height=200)

    monkeypatch.setattr(
        face_detector,
        "detect_face",
        lambda img: FaceDetectionResult(
            detected=False,
            face_count=2,
            error_code="MULTIPLE_FACES_DETECTED",
            error_message="Multiple faces detected. Exactly one face is required.",
        ),
    )

    payload = {"facultyId": "fac_001", "image": test_image}
    response = client.post("/api/v1/face/verify", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is False
    assert data["faceDetected"] is False
    assert "Multiple faces" in (data.get("reason") or "")


def test_full_enroll_and_verify_flow(monkeypatch):
    """Verify enrollment generates reference token and subsequent verify succeeds."""
    test_image = create_test_image_base64(width=200, height=200)

    # Mock face detection returning exactly 1 valid face ROI
    mock_roi = np.full((160, 160, 3), (160, 150, 140), dtype=np.uint8)
    # Add texture gradient for realistic variance
    cv2.circle(mock_roi, (50, 50), 15, (50, 50, 50), -1)
    cv2.circle(mock_roi, (110, 50), 15, (50, 50, 50), -1)

    monkeypatch.setattr(
        face_detector,
        "detect_face",
        lambda img: FaceDetectionResult(
            detected=True,
            face_count=1,
            bounding_box=(20, 20, 160, 160),
            face_roi=mock_roi,
        ),
    )

    # 1. Enroll Faculty
    enroll_payload = {"facultyId": "LPU-FAC-101", "image": test_image}
    enroll_resp = client.post("/api/v1/face/enroll", json=enroll_payload, headers=AUTH_HEADERS)
    assert enroll_resp.status_code == 200
    enroll_data = enroll_resp.json()
    assert enroll_data["success"] is True
    assert enroll_data["faceDetected"] is True
    assert "faceEmbeddingReference" in enroll_data
    # Security: Ensure raw embedding vector is never exposed
    assert "embedding" not in enroll_data

    ref_token = enroll_data["faceEmbeddingReference"]

    # 2. Verify Faculty Face
    verify_payload = {
        "facultyId": "LPU-FAC-101",
        "faceEmbeddingReference": ref_token,
        "image": test_image,
    }
    verify_resp = client.post("/api/v1/face/verify", json=verify_payload, headers=AUTH_HEADERS)
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()

    # Single-frame verify without challenge frames must FAIL overall verification per Requirement 3
    assert verify_data["verified"] is False
    assert verify_data["identityMatched"] is True
    assert verify_data["faceDetected"] is True
    assert verify_data["livenessVerified"] is False
    assert verify_data["livenessStatus"] == "FAILED"
    assert verify_data["similarity"] >= 0.65
    assert verify_data["distance"] <= 0.85
    # Security check: Never leak biometric arrays
    assert "embedding" not in verify_data


def test_standalone_liveness_endpoint(monkeypatch):
    """Verify POST /api/v1/face/liveness rejects single frame and enforces multi-frame."""
    test_image = create_test_image_base64(width=200, height=200)

    # Single frame should be rejected per Requirement 3
    payload = {"image": test_image}
    resp = client.post("/api/v1/face/liveness", json=payload, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["isLive"] is False
    assert data["livenessVerified"] is False
    assert data["livenessStatus"] == "FAILED"
    assert data["errorCode"] == "INSUFFICIENT_FRAMES_FOR_LIVENESS"


def test_reject_different_person_face(monkeypatch):
    """Verify that attempting to verify with a different person's face strictly FAILS."""
    from app.services.face_embedding import face_embedding_manager

    # Person 1 (enrolled)
    mock_emb_person_1 = np.zeros(128, dtype=np.float32)
    mock_emb_person_1[0] = 1.0

    # Person 2 (different person: orthogonal embedding vector, similarity = 0.0, L2 = 1.414)
    mock_emb_person_2 = np.zeros(128, dtype=np.float32)
    mock_emb_person_2[1] = 1.0

    mock_roi = np.full((160, 160, 3), (160, 150, 140), dtype=np.uint8)
    cv2.circle(mock_roi, (50, 50), 15, (50, 50, 50), -1)
    cv2.circle(mock_roi, (110, 50), 15, (50, 50, 50), -1)
    monkeypatch.setattr(
        face_detector,
        "detect_face",
        lambda img: FaceDetectionResult(
            detected=True,
            face_count=1,
            bounding_box=(20, 20, 160, 160),
            face_roi=mock_roi,
        ),
    )

    # During enrollment: Person 1 is registered
    monkeypatch.setattr(
        face_embedding_manager,
        "generate_embedding",
        lambda *args, **kwargs: mock_emb_person_1,
    )

    test_image = create_test_image_base64()
    enroll_payload = {"facultyId": "LPU-DIFF-TEST", "image": test_image}
    enroll_resp = client.post("/api/v1/face/enroll", json=enroll_payload, headers=AUTH_HEADERS)
    assert enroll_resp.status_code == 200
    ref_token = enroll_resp.json()["faceEmbeddingReference"]

    # During verification: Person 2 presents their face (different biometric profile)
    monkeypatch.setattr(
        face_embedding_manager,
        "generate_embedding",
        lambda *args, **kwargs: mock_emb_person_2,
    )

    verify_payload = {
        "facultyId": "LPU-DIFF-TEST",
        "faceEmbeddingReference": ref_token,
        "image": test_image,
    }
    verify_resp = client.post("/api/v1/face/verify", json=verify_payload, headers=AUTH_HEADERS)
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()

    # MUST FAIL verification!
    assert verify_data["verified"] is False
    assert verify_data["errorCode"] == "FACE_MISMATCH"
    assert "does not match your registered faculty profile" in verify_data["reason"]


def test_candidate_verify_and_activate_flow(monkeypatch):
    """Verify candidate embedding verification, activation into active profile, and rollback pointer preservation."""
    from app.services.face_embedding import face_embedding_manager

    # 1. Enroll initial active profile for faculty
    initial_emb = np.zeros(128, dtype=np.float32)
    initial_emb[0] = 1.0
    initial_ref = face_embedding_manager.enroll_face("FAC_CAN_TEST", initial_emb)

    # Verify initial pointer points to initial enrollment
    active_emb = face_embedding_manager.get_enrolled_embedding("FAC_CAN_TEST")
    assert active_emb is not None
    assert np.allclose(active_emb, initial_emb)

    # 2. Register candidate embedding under candidate_<facultyId>_<timestamp>
    candidate_emb = np.zeros(128, dtype=np.float32)
    candidate_emb[1] = 1.0
    candidate_ref = face_embedding_manager.enroll_face("candidate_FAC_CAN_TEST_999", candidate_emb)

    # Verify candidate reference endpoint
    verify_resp = client.post(
        "/api/v1/face/candidate/verify",
        json={"candidateEmbeddingReference": candidate_ref, "facultyId": "FAC_CAN_TEST"},
        headers=AUTH_HEADERS,
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["valid"] is True

    # 3. Activate candidate embedding
    activate_resp = client.post(
        "/api/v1/face/candidate/activate",
        json={"candidateEmbeddingReference": candidate_ref, "facultyId": "FAC_CAN_TEST"},
        headers=AUTH_HEADERS,
    )
    assert activate_resp.status_code == 200
    new_active_ref = activate_resp.json()["faceEmbeddingReference"]
    assert new_active_ref != initial_ref

    # Verify active profile now uses candidate embedding
    updated_emb = face_embedding_manager.get_enrolled_embedding("FAC_CAN_TEST")
    assert np.allclose(updated_emb, candidate_emb)

    # 4. Rollback simulation: delete new active embedding
    delete_resp = client.delete(f"/api/v1/face/embedding/{new_active_ref}", headers=AUTH_HEADERS)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["deleted"] is True

    # Critical Rollback Guarantee: Verify previous active enrollment pointer was safely restored!
    restored_emb = face_embedding_manager.get_enrolled_embedding("FAC_CAN_TEST")
    assert restored_emb is not None
    assert np.allclose(restored_emb, initial_emb)

    # Cleanup
    face_embedding_manager.delete_embedding(initial_ref)


