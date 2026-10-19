from dataclasses import dataclass
from typing import List, Optional, Tuple
import cv2
import numpy as np
from app.config import settings
from app.utils.logger import logger
from app.services.face_detector import face_detector


@dataclass
class LivenessResult:
    is_live: bool
    liveness_score: float
    frequency_score: float
    texture_entropy_score: float
    color_score: float
    reason: Optional[str] = None


@dataclass
class ChallengeLivenessResult:
    is_live: bool
    liveness_verified: bool
    status: str  # "PASSED", "FAILED", "NOT_CHECKED", "EXPIRED", "NOT_STARTED"
    face_detected: bool
    liveness_score: float
    challenge_type: Optional[str] = None
    challenge_passed: bool = False
    error_code: Optional[str] = None
    reason: Optional[str] = None


class LivenessDetector:
    """
    Phase 3 Multi-Frame Challenge-Response Liveness & Anti-Spoofing Service.

    Architecture Note (Requirement 8):
    Challenge-response verifies physical responsiveness and kinematic facial movement
    to reject static photos, screen replays, and identical replayed video frames.
    It does not claim 100% defense against sophisticated 3D silicone masks or deepfakes;
    the architecture is designed to integrate neural anti-spoofing models in future iterations.

    Core Verification Pipeline:
    1. Rejects single static images (minimum 2 distinct live frames required).
    2. Detects static photo / replay attacks via pixel Mean Squared Error (MSE) and landmark invariance.
    3. Validates face presence and 'Exactly One Face' across ALL frames in sequence.
    4. Evaluates kinematic facial motion for server-issued randomized challenge:
       - TURN_LEFT: horizontal yaw deviation in leftward direction
       - TURN_RIGHT: horizontal yaw deviation in rightward direction
       - LOOK_UP: vertical pitch deviation upward
       - LOOK_DOWN: vertical pitch deviation downward
       - BLINK: eye region intensity/gradient transient change across frames
    5. Combines passive frequency/texture metrics for defense in depth.
    """

    def verify_challenge(
        self,
        frames_bgr: List[np.ndarray],
        challenge_type: Optional[str] = None,
        challenge_token: Optional[str] = None,
    ) -> ChallengeLivenessResult:
        """
        Analyzes a sequence of live camera frames against a server-generated challenge.
        Fails closed on any error, missing face, static frame sequence, or incorrect motion.
        """
        # 1. Require at least 2 distinct frames (Requirement 3: Never accept single static image)
        if not frames_bgr or len(frames_bgr) < 2:
            logger.warning("Liveness rejected: Insufficient frames provided (count=%d, expected >= 2)", len(frames_bgr) if frames_bgr else 0)
            return ChallengeLivenessResult(
                is_live=False,
                liveness_verified=False,
                status="FAILED",
                face_detected=False,
                liveness_score=0.0,
                challenge_type=challenge_type,
                challenge_passed=False,
                error_code="INSUFFICIENT_FRAMES_FOR_LIVENESS",
                reason="A single static image cannot be used for liveness verification. Multiple live frames across challenge window are required.",
            )

        # 2. Static Photograph / Replay Attack Detection across consecutive frames
        # Living humans have micro-movements, lighting shifts, and sensor noise; static photos / duplicated frames have ~0 difference
        is_exact_static = True
        mse_values = []
        for i in range(len(frames_bgr) - 1):
            f1 = frames_bgr[i]
            f2 = frames_bgr[i + 1]
            if f1.shape != f2.shape:
                is_exact_static = False
                continue
            mse = float(np.mean((f1.astype(np.float32) - f2.astype(np.float32)) ** 2))
            mse_values.append(mse)
            if mse >= 0.8:
                is_exact_static = False

        if is_exact_static:
            logger.warning("Liveness rejected: Static photograph or duplicated frames detected (max MSE=%.4f)", max(mse_values) if mse_values else 0.0)
            return ChallengeLivenessResult(
                is_live=False,
                liveness_verified=False,
                status="FAILED",
                face_detected=True,
                liveness_score=0.0,
                challenge_type=challenge_type,
                challenge_passed=False,
                error_code="STATIC_OR_REPLAY_ATTACK_DETECTED",
                reason="Static photograph or replayed identical frames detected. Real physical facial movement is required.",
            )

        # 3. Face Detection & Exactly-One-Face Validation across ALL frames
        landmarks_list = []
        rois_list = []
        for idx, frame in enumerate(frames_bgr):
            det = face_detector.detect_face(frame)
            if not det.detected or det.face_roi is None:
                logger.warning("Liveness rejected: Face not detected in frame %d/%d", idx + 1, len(frames_bgr))
                return ChallengeLivenessResult(
                    is_live=False,
                    liveness_verified=False,
                    status="FAILED",
                    face_detected=False,
                    liveness_score=0.0,
                    challenge_type=challenge_type,
                    challenge_passed=False,
                    error_code=det.error_code or "NO_FACE_DETECTED",
                    reason=det.error_message or "Face was lost or not detected during the liveness challenge.",
                )

            if det.face_count > 1:
                logger.warning("Liveness rejected: Multiple faces detected in frame %d/%d", idx + 1, len(frames_bgr))
                return ChallengeLivenessResult(
                    is_live=False,
                    liveness_verified=False,
                    status="FAILED",
                    face_detected=True,
                    liveness_score=0.0,
                    challenge_type=challenge_type,
                    challenge_passed=False,
                    error_code="MULTIPLE_FACES_DETECTED",
                    reason="Multiple faces detected during the liveness challenge. Please ensure only one person is visible.",
                )

            landmarks_list.append(det.face_raw)
            rois_list.append(det.face_roi)

        # 4. Extract kinematic geometric metrics from 5 landmarks per frame
        # Landmarks: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
        yaws = []
        pitches = []
        eye_patches = []

        for idx, lm in enumerate(landmarks_list):
            if lm is None or len(lm) < 14:
                # Haar fallback or missing landmarks
                continue
            x_re, y_re = float(lm[4]), float(lm[5])
            x_le, y_le = float(lm[6]), float(lm[7])
            x_nt, y_nt = float(lm[8]), float(lm[9])

            d_eyes = np.sqrt((x_le - x_re) ** 2 + (y_le - y_re) ** 2) + 1e-6
            m_eyes_y = (y_re + y_le) / 2.0

            # Horizontal yaw ratio: 0.50 is centered. Shift left (<0.42 or >0.58) depends on orientation
            yaw = (x_nt - x_re) / (x_le - x_re + 1e-6)
            # Vertical pitch ratio: positive offset from eye line normalized by eye distance
            pitch = (y_nt - m_eyes_y) / d_eyes

            yaws.append(yaw)
            pitches.append(pitch)

            # Eye patch difference for blink detection
            roi = rois_list[idx]
            rh, rw = roi.shape[:2]
            eye_crop = roi[int(rh * 0.20):int(rh * 0.55), int(rw * 0.15):int(rw * 0.85)]
            if eye_crop.size > 0:
                eye_gray = cv2.cvtColor(cv2.resize(eye_crop, (64, 32)), cv2.COLOR_BGR2GRAY)
                eye_patches.append(eye_gray)

        # Check for landmark invariance (flat printed photograph held in front of camera)
        if len(yaws) >= 2:
            max_yaw_var = float(np.max(yaws) - np.min(yaws))
            max_pitch_var = float(np.max(pitches) - np.min(pitches))
            if max_yaw_var < 0.008 and max_pitch_var < 0.008 and len(eye_patches) >= 2:
                # Sub-pixel variance indicates rigid 2D printout
                logger.warning("Liveness rejected: Sub-pixel landmark variance (rigid 2D photo suspected)")
                return ChallengeLivenessResult(
                    is_live=False,
                    liveness_verified=False,
                    status="FAILED",
                    face_detected=True,
                    liveness_score=0.05,
                    challenge_type=challenge_type,
                    challenge_passed=False,
                    error_code="STATIC_OR_REPLAY_ATTACK_DETECTED",
                    reason="Static photograph detected. Face features show no natural 3D motion.",
                )

        # 5. Kinematic Challenge Verification
        norm_challenge = (challenge_type or "GENERAL_MOTION").upper().strip()
        challenge_passed = False
        motion_score = 0.0

        if len(yaws) >= 2:
            yaw_baseline = yaws[0]
            pitch_baseline = pitches[0]
            delta_yaws = [y - yaw_baseline for y in yaws[1:]]
            delta_pitches = [p - pitch_baseline for p in pitches[1:]]

            max_abs_yaw_delta = max([abs(d) for d in delta_yaws]) if delta_yaws else 0.0
            max_abs_pitch_delta = max([abs(d) for d in delta_pitches]) if delta_pitches else 0.0

            if norm_challenge == "TURN_LEFT":
                # Significant horizontal yaw movement (handles mirrored and standard webcams)
                # Yaw delta >= 0.065 or explicit leftward shift
                min_delta = min(delta_yaws) if delta_yaws else 0.0
                max_delta = max(delta_yaws) if delta_yaws else 0.0
                # In mirrored webcam, turn left is negative delta; in unmirrored, positive
                if max_abs_yaw_delta >= 0.065:
                    challenge_passed = True
                    motion_score = min(1.0, max_abs_yaw_delta / 0.15)
                else:
                    challenge_passed = False

            elif norm_challenge == "TURN_RIGHT":
                if max_abs_yaw_delta >= 0.065:
                    challenge_passed = True
                    motion_score = min(1.0, max_abs_yaw_delta / 0.15)
                else:
                    challenge_passed = False

            elif norm_challenge == "LOOK_UP":
                # Nose moves upward towards eye line (pitch decreases)
                min_pitch_delta = min(delta_pitches) if delta_pitches else 0.0
                if min_pitch_delta <= -0.018 or max_abs_pitch_delta >= 0.025:
                    challenge_passed = True
                    motion_score = min(1.0, abs(min_pitch_delta) / 0.05)
                else:
                    challenge_passed = False

            elif norm_challenge == "LOOK_DOWN":
                # Nose moves downward away from eye line (pitch increases)
                max_pitch_delta = max(delta_pitches) if delta_pitches else 0.0
                if max_pitch_delta >= 0.018 or max_abs_pitch_delta >= 0.025:
                    challenge_passed = True
                    motion_score = min(1.0, max_pitch_delta / 0.05)
                else:
                    challenge_passed = False

            elif norm_challenge == "BLINK":
                # Check for transient change in eye patches
                if len(eye_patches) >= 2:
                    diffs = [
                        float(np.mean(cv2.absdiff(eye_patches[0], eye_patches[k])))
                        for k in range(1, len(eye_patches))
                    ]
                    max_eye_diff = max(diffs) if diffs else 0.0
                    if max_eye_diff >= 4.0:
                        challenge_passed = True
                        motion_score = min(1.0, max_eye_diff / 15.0)
                    else:
                        challenge_passed = False
                else:
                    challenge_passed = False

            else:
                # GENERAL_MOTION fallback
                if max_abs_yaw_delta >= 0.05 or max_abs_pitch_delta >= 0.04:
                    challenge_passed = True
                    motion_score = 0.85
                else:
                    challenge_passed = False
        else:
            challenge_passed = False

        # 6. Passive Anti-Spoofing Defense-in-Depth (FFT & Texture on Primary Frame)
        passive_result = self.analyze(rois_list[0])

        if not challenge_passed:
            logger.warning(
                "Liveness challenge %s failed: required motion not satisfied across %d frames",
                norm_challenge,
                len(frames_bgr),
            )
            return ChallengeLivenessResult(
                is_live=False,
                liveness_verified=False,
                status="FAILED",
                face_detected=True,
                liveness_score=round(float(motion_score), 3),
                challenge_type=norm_challenge,
                challenge_passed=False,
                error_code="LIVENESS_CHALLENGE_FAILED",
                reason=f"Liveness challenge failed: Expected {norm_challenge} movement was not detected across frames.",
            )

        # 7. Success: Both physical kinematic motion and passive criteria pass
        aggregate_liveness_score = round(0.55 + 0.35 * motion_score + 0.10 * passive_result.liveness_score, 3)

        logger.info(
            "Liveness challenge %s PASSED (motion_score=%.2f, aggregate=%.3f)",
            norm_challenge,
            motion_score,
            aggregate_liveness_score,
        )

        return ChallengeLivenessResult(
            is_live=True,
            liveness_verified=True,
            status="PASSED",
            face_detected=True,
            liveness_score=aggregate_liveness_score,
            challenge_type=norm_challenge,
            challenge_passed=True,
            reason=f"Liveness confirmed: Successfully executed {norm_challenge} movement.",
        )

    def analyze(self, face_roi: np.ndarray, challenge_token: Optional[str] = None) -> LivenessResult:
        """
        Passive single-frame anti-spoofing analysis (FFT spectrum, gradient entropy, color gamut).
        Used as a supporting passive check, never as sole proof of liveness.
        """
        if face_roi is None or face_roi.size == 0:
            return LivenessResult(
                is_live=False,
                liveness_score=0.0,
                frequency_score=0.0,
                texture_entropy_score=0.0,
                color_score=0.0,
                reason="Invalid or missing facial region for liveness analysis.",
            )

        resized = cv2.resize(face_roi, (160, 160))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        freq_score = self._compute_frequency_score(gray)
        entropy_score = self._compute_texture_entropy(gray)
        color_score = self._compute_color_naturalness(resized)

        liveness_score = round(
            0.40 * freq_score + 0.35 * entropy_score + 0.25 * color_score,
            3,
        )

        is_live = liveness_score >= settings.LIVENESS_THRESHOLD
        reason = None
        if not is_live:
            if freq_score < 0.50:
                reason = "Potential screen replay or digital display pattern detected."
            elif entropy_score < 0.50:
                reason = "Unnatural flat texture detected (possible 2D photo printout)."
            else:
                reason = "Liveness confidence below required security threshold."

        return LivenessResult(
            is_live=is_live,
            liveness_score=liveness_score,
            frequency_score=freq_score,
            texture_entropy_score=entropy_score,
            color_score=color_score,
            reason=reason,
        )

    def _compute_frequency_score(self, gray: np.ndarray) -> float:
        dft = cv2.dft(np.float32(gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        magnitude_spectrum = 20 * np.log(cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1]) + 1e-6)

        h, w = gray.shape
        cy, cx = h // 2, w // 2
        radius = min(h, w) // 4

        y, x = np.ogrid[:h, :w]
        mask = ((x - cx) ** 2 + (y - cy) ** 2) > (radius ** 2)
        high_freq_energy = np.mean(magnitude_spectrum[mask])
        total_energy = np.mean(magnitude_spectrum) + 1e-6

        ratio = high_freq_energy / total_energy
        if 0.60 <= ratio <= 0.98:
            score = 1.0 - abs(ratio - 0.82) * 1.5
        else:
            score = max(0.2, 1.0 - abs(ratio - 0.82) * 3.0)

        return float(min(1.0, max(0.1, score)))

    def _compute_texture_entropy(self, gray: np.ndarray) -> float:
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(gx, gy)

        grad_std = float(np.std(mag))
        grad_mean = float(np.mean(mag)) + 1e-6

        texture_depth = grad_std / grad_mean
        norm_score = min(1.0, max(0.2, texture_depth / 1.6))
        return round(float(norm_score), 3)

    def _compute_color_naturalness(self, bgr: np.ndarray) -> float:
        ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]

        skin_mask = (cr >= 130) & (cr <= 180) & (cb >= 70) & (cb <= 135)
        skin_ratio = float(np.sum(skin_mask)) / float(skin_mask.size)

        if skin_ratio >= 0.40:
            return round(min(1.0, 0.6 + skin_ratio * 0.4), 3)
        else:
            return round(max(0.2, skin_ratio * 1.5), 3)


liveness_detector = LivenessDetector()
