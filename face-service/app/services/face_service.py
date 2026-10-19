from typing import Dict, List, Optional, Tuple
import numpy as np
from fastapi import HTTPException, status
from app.utils.image_processing import decode_image_to_cv2
from app.services.image_quality import image_quality_validator
from app.services.face_detector import face_detector
from app.services.liveness_detector import liveness_detector
from app.services.face_embedding import face_embedding_manager
from app.models.schemas import EnrollResponse, VerifyResponse, LivenessResponse, CheckFaceResponse
from app.utils.logger import logger
from app.config import settings


class FaceService:
    """
    Orchestrates the complete facial verification pipeline:
    1. In-memory image decoding & format validation
    2. Physical image quality validation (sharpness, exposure, resolution)
    3. Exactly-one-face detection & bounding box extraction
    4. Anti-spoofing liveness verification
    5. Biometric embedding generation & cosine similarity matching
    """

    def check_face(self, image_b64: str) -> CheckFaceResponse:
        """
        Pre-registration face validation check without storing any data.
        Validates quality, enforces exactly one face, and checks liveness.
        """
        img_bgr = decode_image_to_cv2(image_b64)

        # 1. Quality validation
        quality = image_quality_validator.validate(img_bgr)
        if not quality.is_valid:
            logger.warning("Check face quality validation failed: %s", quality.error_code)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": quality.error_code, "message": quality.error_message},
            )

        # 2. Exactly-one-face check
        face_result = face_detector.detect_face(img_bgr)
        if not face_result.detected or face_result.face_roi is None:
            logger.warning("Check face detection failed: %s", face_result.error_code)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": face_result.error_code, "message": face_result.error_message},
            )

        # 3. Liveness check
        liveness_result = liveness_detector.analyze(face_result.face_roi)
        if not liveness_result.is_live:
            logger.warning("Check face liveness failed: %s", liveness_result.reason)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "LIVENESS_FAILED",
                    "message": liveness_result.reason or "Liveness verification failed.",
                },
            )

        return CheckFaceResponse(
            valid=True,
            faceDetected=True,
            livenessPassed=True,
            qualityScore=quality.quality_score,
            message="Face detected clearly and ready for registration.",
        )

    def enroll(self, faculty_id: str, image_b64: str) -> EnrollResponse:
        logger.info("Initiating biometric enrollment for faculty: %s", faculty_id)

        # 1. Decode image into memory
        img_bgr = decode_image_to_cv2(image_b64)

        # 2. Quality validation
        quality = image_quality_validator.validate(img_bgr)
        if not quality.is_valid:
            logger.warning("Enrollment quality validation failed for %s: %s", faculty_id, quality.error_code)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": quality.error_code, "message": quality.error_message},
            )

        # 3. Face Detection & Exactly-One-Face Check
        face_result = face_detector.detect_face(img_bgr)
        if not face_result.detected or face_result.face_roi is None:
            logger.warning("Enrollment face detection failed for %s: %s", faculty_id, face_result.error_code)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": face_result.error_code, "message": face_result.error_message},
            )

        # 4. Anti-Spoof Liveness Check
        liveness_result = liveness_detector.analyze(face_result.face_roi)
        if not liveness_result.is_live:
            logger.warning("Enrollment liveness verification failed for %s: %s", faculty_id, liveness_result.reason)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "LIVENESS_FAILED",
                    "message": liveness_result.reason or "Liveness verification failed during enrollment.",
                },
            )

        # 5. Generate and store normalized deep biometric embedding
        embedding = face_embedding_manager.generate_embedding(
            face_result.face_roi,
            img_bgr=img_bgr,
            face_raw=face_result.face_raw,
        )
        reference_id = face_embedding_manager.enroll_face(faculty_id, embedding)

        logger.info("Successfully completed face enrollment for faculty: %s", faculty_id)
        return EnrollResponse(
            success=True,
            faceEmbeddingReference=reference_id,
            facultyId=faculty_id,
            faceDetected=True,
            qualityScore=quality.quality_score,
            message="Faculty face biometrics enrolled successfully.",
        )

    def verify(
        self,
        faculty_id: str,
        face_embedding_reference: Optional[str],
        image_b64: str,
        challenge_token: Optional[str] = None,
        challenge_type: Optional[str] = None,
        frames: Optional[List[str]] = None,
    ) -> VerifyResponse:
        logger.info(
            "Initiating verification for faculty: %s (reference: %s, challenge: %s, frames_count: %d)",
            faculty_id,
            face_embedding_reference,
            challenge_type or "NONE",
            len(frames) if frames else 0,
        )

        # 1. Decode primary image into memory
        try:
            img_bgr = decode_image_to_cv2(image_b64)
        except HTTPException as exc:
            return VerifyResponse(
                verified=False,
                identityMatched=False,
                similarity=0.0,
                distance=2.0,
                faceDetected=False,
                livenessVerified=False,
                livenessStatus="FAILED",
                confidence=0.0,
                errorCode="INVALID_IMAGE",
                reason=exc.detail.get("message", "Invalid image payload") if isinstance(exc.detail, dict) else str(exc.detail),
            )

        # 2. Quality validation
        quality = image_quality_validator.validate(img_bgr)
        if not quality.is_valid:
            return VerifyResponse(
                verified=False,
                identityMatched=False,
                similarity=0.0,
                distance=2.0,
                faceDetected=False,
                livenessVerified=False,
                livenessStatus="FAILED",
                confidence=0.0,
                errorCode=quality.error_code or "IMAGE_TOO_POOR",
                reason=quality.error_message or "Face image is not clear enough. Please improve lighting and try again.",
            )

        # 3. Face Detection & Exactly-One-Face Check on primary image
        face_result = face_detector.detect_face(img_bgr)
        if not face_result.detected or face_result.face_roi is None:
            return VerifyResponse(
                verified=False,
                identityMatched=False,
                similarity=0.0,
                distance=2.0,
                faceDetected=False,
                livenessVerified=False,
                livenessStatus="FAILED",
                confidence=0.0,
                errorCode=face_result.error_code or "NO_FACE_DETECTED",
                reason=face_result.error_message or "No face detected. Please position your face clearly in the camera.",
            )

        # 4. Biometric Matching against Enrolled Reference of authenticated faculty
        # CRITICAL: Reference embedding is NEVER modified or overwritten during verification
        enrolled_embedding = face_embedding_manager.get_enrolled_embedding(
            faculty_id, face_embedding_reference
        )

        if enrolled_embedding is None:
            logger.warning("No registered biometric face profile found for faculty %s", faculty_id)
            return VerifyResponse(
                verified=False,
                identityMatched=False,
                similarity=0.0,
                distance=2.0,
                faceDetected=True,
                livenessVerified=False,
                livenessStatus="FAILED",
                confidence=0.0,
                errorCode="FACE_NOT_REGISTERED",
                reason="Face verification failed. The detected face does not match your registered faculty profile.",
            )

        # 5. Multi-Frame Identity & Liveness Evaluation across Challenge Window
        liveness_verified = False
        liveness_status = "FAILED"
        liveness_score = 0.0
        live_res = None
        live_err = None
        live_reason = None

        if frames and len(frames) >= 2:
            decoded_frames = []
            for f_b64 in frames:
                try:
                    decoded_frames.append(decode_image_to_cv2(f_b64))
                except Exception:
                    pass

            # A. Phase 3 & 7 Multi-frame kinematic liveness verification
            live_res = liveness_detector.verify_challenge(
                decoded_frames,
                challenge_type=challenge_type,
                challenge_token=challenge_token,
            )
            liveness_verified = live_res.liveness_verified
            liveness_status = live_res.status
            liveness_score = live_res.liveness_score
            live_err = live_res.error_code
            live_reason = live_res.reason

            all_candidate_frames = decoded_frames if decoded_frames else [img_bgr]
            is_identity_match, similarity, l2_distance, id_stats = self._evaluate_multi_frame_identity(
                all_candidate_frames, enrolled_embedding
            )
        else:
            # Single image or missing frames -> Fail closed on liveness (never allow single static capture)
            candidate_embedding = face_embedding_manager.generate_embedding(
                face_result.face_roi,
                img_bgr=img_bgr,
                face_raw=face_result.face_raw,
            )
            is_identity_match, similarity, l2_distance = face_embedding_manager.compare_embeddings(
                candidate_embedding, enrolled_embedding
            )
            liveness_verified = False
            liveness_status = "FAILED"
            live_err = "SINGLE_FRAME_LIVENESS_REJECTED"
            live_reason = "A single static image cannot be used for liveness verification. Multi-frame challenge verification is required."

        # 6. Overall Verification: strictly requires BOTH identityMatched AND livenessVerified
        overall_verified = bool(is_identity_match and liveness_verified)

        # 7. Structured audit decision log
        logger.info(
            "Biometric Verification Decision:\n"
            "  Faculty: %s\n"
            "  Reference ID: %s\n"
            "  Similarity (median): %.4f (threshold: %.2f)\n"
            "  L2 distance (median): %.4f (threshold: %.2f)\n"
            "  Identity match: %s\n"
            "  Liveness challenge: %s\n"
            "  Liveness status: %s (score: %.3f)\n"
            "  Overall verification: %s",
            faculty_id,
            face_embedding_reference or "N/A",
            similarity,
            settings.SIMILARITY_THRESHOLD,
            l2_distance,
            settings.L2_DISTANCE_THRESHOLD,
            "PASSED" if is_identity_match else "FAILED",
            challenge_type or "NONE",
            liveness_status,
            liveness_score,
            "PASSED" if overall_verified else "FAILED",
        )

        # 9. Fail closed if either check fails
        if not overall_verified:
            err_code = "FACE_MISMATCH" if not is_identity_match else (live_err or "LIVENESS_CHALLENGE_FAILED")
            fail_reason = (
                "Face verification failed. The detected face does not match your registered faculty profile."
                if not is_identity_match
                else (live_reason or "Liveness verification failed.")
            )

            return VerifyResponse(
                verified=False,
                identityMatched=is_identity_match,
                similarity=similarity,
                distance=l2_distance,
                faceDetected=True,
                livenessVerified=liveness_verified,
                livenessStatus=liveness_status,
                livenessScore=liveness_score,
                challengeType=challenge_type,
                confidence=similarity,
                errorCode=err_code,
                reason=fail_reason,
            )

        best_frame = id_stats.get("best_frame_index", 0) if (frames and len(frames) >= 2) else 0

        # 10. Success: Both identity and liveness verified
        return VerifyResponse(
            verified=True,
            identityMatched=True,
            similarity=similarity,
            distance=l2_distance,
            faceDetected=True,
            livenessVerified=True,
            livenessStatus="PASSED",
            livenessScore=liveness_score,
            challengeType=challenge_type,
            confidence=similarity,
            bestFrameIndex=best_frame,
            reason="Both facial identity and live challenge verified successfully.",
        )

    def _evaluate_multi_frame_identity(
        self,
        frames_bgr: List[np.ndarray],
        enrolled_embedding: np.ndarray,
    ) -> Tuple[bool, float, float, Dict]:
        """
        Phase 7 Strengthened Multi-Frame Identity Decision:
        - Evaluates facial identity across all usable frames in the capture sequence.
        - Rejects unusable frames (blur, extreme lighting, 0 faces, or multiple faces) without false penalty.
        - Calculates per-frame compliance against BOTH calibrated thresholds:
            similarity >= SIMILARITY_THRESHOLD (0.65)
            distance <= L2_DISTANCE_THRESHOLD (0.85)
        - Requires a strong consensus: at least 60% of valid frames must independently pass BOTH thresholds.
        - Also requires aggregate consistency: median similarity >= 0.65 and median distance <= 0.85.
        - Prevents a single lucky frame from allowing an impostor to verify.
        """
        frame_results = []

        for idx, frame in enumerate(frames_bgr):
            if frame is None or frame.size == 0:
                continue

            # Quality gate: filter severely blurred or poorly lit frames
            q = image_quality_validator.validate(frame)
            if not q.is_valid:
                logger.debug("Frame %d skipped in identity evaluation: quality invalid (%s)", idx, q.error_code)
                continue

            # Detect face in frame
            det = face_detector.detect_face(frame)
            if not det.detected or det.face_roi is None or det.face_count != 1:
                logger.debug("Frame %d skipped in identity evaluation: face count != 1", idx)
                continue

            # Generate SFace embedding with landmark alignment
            emb = face_embedding_manager.generate_embedding(
                det.face_roi,
                img_bgr=frame,
                face_raw=det.face_raw,
            )
            if emb is None:
                continue

            is_match, sim, l2 = face_embedding_manager.compare_embeddings(emb, enrolled_embedding)
            frame_results.append({
                "index": idx,
                "match": is_match,
                "similarity": sim,
                "distance": l2,
            })

        total_valid = len(frame_results)
        if total_valid == 0:
            logger.warning("No usable frames available for multi-frame identity evaluation")
            return False, 0.0, 2.0, {"total_valid": 0, "passing_count": 0, "consensus_ratio": 0.0}

        passing_frames = [r for r in frame_results if r["match"]]
        passing_count = len(passing_frames)
        consensus_ratio = passing_count / total_valid

        similarities = [r["similarity"] for r in frame_results]
        distances = [r["distance"] for r in frame_results]

        median_sim = float(np.median(similarities))
        median_dist = float(np.median(distances))
        avg_sim = float(np.mean(similarities))
        avg_dist = float(np.mean(distances))

        # Consensus Rule: At least 60% of valid frames must independently pass BOTH thresholds
        CONSENSUS_THRESHOLD = 0.60
        consensus_satisfied = bool(consensus_ratio >= CONSENSUS_THRESHOLD)

        # Aggregate Consistency: Median metrics must independently satisfy calibrated thresholds
        median_satisfied = bool(
            median_sim >= settings.SIMILARITY_THRESHOLD and
            median_dist <= settings.L2_DISTANCE_THRESHOLD
        )

        identity_matched = bool(consensus_satisfied and median_satisfied)

        best_frame_idx = max(passing_frames, key=lambda r: r["similarity"])["index"] if passing_frames else (frame_results[0]["index"] if frame_results else 0)

        stats = {
            "total_valid": total_valid,
            "passing_count": passing_count,
            "best_frame_index": best_frame_idx,
            "consensus_ratio": round(consensus_ratio, 3),
            "consensus_satisfied": consensus_satisfied,
            "median_similarity": round(median_sim, 4),
            "median_distance": round(median_dist, 4),
            "avg_similarity": round(avg_sim, 4),
            "avg_distance": round(avg_dist, 4),
            "median_satisfied": median_satisfied,
        }

        logger.info(
            "Multi-Frame Identity Decision: valid_frames=%d, passing=%d (consensus=%.1f%%, req=%.1f%%), median_sim=%.4f (req=%.2f), median_l2=%.4f (req=%.2f) -> %s",
            total_valid,
            passing_count,
            consensus_ratio * 100.0,
            CONSENSUS_THRESHOLD * 100.0,
            median_sim,
            settings.SIMILARITY_THRESHOLD,
            median_dist,
            settings.L2_DISTANCE_THRESHOLD,
            "MATCHED" if identity_matched else "REJECTED",
        )

        return identity_matched, round(median_sim, 4), round(median_dist, 4), stats

    def check_liveness(
        self,
        image_b64: Optional[str] = None,
        frames: Optional[List[str]] = None,
        challenge_token: Optional[str] = None,
        challenge_type: Optional[str] = None,
    ) -> LivenessResponse:
        """
        Standalone liveness assessment endpoint.
        Requires multi-frame sequence to verify challenge. Single frame is rejected.
        """
        if frames and len(frames) >= 2:
            decoded_frames = []
            for f in frames:
                try:
                    decoded_frames.append(decode_image_to_cv2(f))
                except Exception:
                    pass

            ch_res = liveness_detector.verify_challenge(
                decoded_frames,
                challenge_type=challenge_type,
                challenge_token=challenge_token,
            )
            return LivenessResponse(
                isLive=ch_res.is_live,
                livenessVerified=ch_res.liveness_verified,
                livenessStatus=ch_res.status,
                faceDetected=ch_res.face_detected,
                livenessScore=ch_res.liveness_score,
                challengeType=ch_res.challenge_type,
                challengePassed=ch_res.challenge_passed,
                errorCode=ch_res.error_code,
                reason=ch_res.reason,
                message=ch_res.reason or ("Liveness confirmed." if ch_res.is_live else "Liveness failed."),
            )

        # Single frame is rejected per Requirement 3
        return LivenessResponse(
            isLive=False,
            livenessVerified=False,
            livenessStatus="FAILED",
            faceDetected=False,
            livenessScore=0.0,
            challengeType=challenge_type,
            challengePassed=False,
            errorCode="INSUFFICIENT_FRAMES_FOR_LIVENESS",
            reason="A single static image cannot be used for liveness verification. Multi-frame challenge verification is required.",
            message="A single static image cannot be used for liveness verification. Multi-frame challenge verification is required.",
        )


face_service = FaceService()
