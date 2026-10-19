'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  VerificationStep,
  VerificationError,
  VerificationProgress,
  AttendanceRecord,
  AttendanceSession,
  BiometricStatusState,
  BiometricItemStatus,
  LivenessChallengeInfo,
} from '../types';
import { attendanceService, blobToBase64 } from '../services/attendance.service';
import { useAuth } from './useAuth';
import { useGeolocation, GeoLocationState } from './useGeolocation';
import { useCamera } from './useCamera';
import { ApiError } from '../lib/api-client';
import { BIOMETRIC_CONFIG } from '../utils/biometricConfig';

export interface IdentityCheckState {
  isChecking: boolean;
  faceDetected: boolean;
  faceMatching: boolean;
  identityVerified: boolean;
  faceFailed: boolean;
  confidenceScore: number | null;
  errorMessage: string | null;
  faceToken: string | null;
  registeredSuccess?: string | null;
  isRegisteringProfile?: boolean;
}

export function useAttendanceFlow() {
  const { user, isAuthenticated } = useAuth();
  const geo = useGeolocation();
  const camera = useCamera();
  const idempotencyKeyRef = useRef<string | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [step, setStep] = useState<VerificationStep>('AUTH_CHECK');
  const [sessionType] = useState<AttendanceSession>('CHECK_IN');
  const [error, setError] = useState<VerificationError | null>(null);

  // In-memory verification state (never persisted to localStorage)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Server-issued tokens for multi-gate verification pipeline
  const [locationToken, setLocationToken] = useState<string | null>(null);
  const [faceToken, setFaceToken] = useState<string | null>(null);
  const [verifiedDistance, setVerifiedDistance] = useState<number | null>(null);
  const [activeZoneName, setActiveZoneName] = useState<string>('Campus Geofence');

  // Liveness Challenge & Countdown State
  const [activeChallenge, setActiveChallenge] = useState<LivenessChallengeInfo | null>(null);
  const [challengeCountdown, setChallengeCountdown] = useState<number | null>(null);
  // Phase 7: Synchronized 5-second active capture window countdown
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);

  // Verification UI & Status Card State (Phase 4)
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [biometricStatus, setBiometricStatus] = useState<BiometricStatusState>({
    faceDetected: 'idle',
    faceQuality: 'idle',
    livenessCheck: 'idle',
    identityMatch: 'idle',
    failureTitle: null,
    failureMessage: null,
    errorCode: null,
  });

  // Backward compatibility object for existing views if needed
  const [identityCheck, setIdentityCheck] = useState<IdentityCheckState>({
    isChecking: false,
    faceDetected: false,
    faceMatching: false,
    identityVerified: false,
    faceFailed: false,
    confidenceScore: null,
    errorMessage: null,
    faceToken: null,
    registeredSuccess: null,
    isRegisteringProfile: false,
  });

  // Multi-step progress states for verification animation
  const [progress, setProgress] = useState<VerificationProgress>({
    locationVerified: false,
    faceVerifying: false,
    faceVerified: false,
    livenessVerifying: false,
    livenessVerified: false,
    attendanceProcessing: false,
    attendanceProcessed: false,
  });

  const [verifiedRecord, setVerifiedRecord] = useState<AttendanceRecord | null>(null);

  // Clean up countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (initialSeconds: number, onExpired: () => void) => {
      stopCountdown();
      setChallengeCountdown(initialSeconds);
      let remaining = initialSeconds;

      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          stopCountdown();
          setChallengeCountdown(0);
          onExpired();
        } else {
          setChallengeCountdown(remaining);
        }
      }, 1000);
    },
    [stopCountdown]
  );

  /**
   * Calculates the current numeric step (1 to 6) for VerificationFlowStepper
   */
  const currentFlowStep = (() => {
    if (step === 'LOCATION_CHECKING' || step === 'AUTH_CHECK') return 1;
    if (step === 'LOCATION_VERIFIED' || step === 'CAMERA_ACTIVE') return 2;
    if (step === 'CHALLENGE_READY' || step === 'LIVENESS_CAPTURING' || step === 'LIVENESS_ANALYZING' || step === 'CHALLENGE_ACTIVE') return 3;
    if (step === 'LIVENESS_VERIFIED' || step === 'IDENTITY_MATCHING' || step === 'BIOMETRIC_PROCESSING') return 4;
    if (step === 'IDENTITY_VERIFIED') return 5;
    if (step === 'ATTENDANCE_READY' || step === 'ATTENDANCE_SUMMARY' || step === 'VERIFYING_MULTI_GATE' || step === 'COMPLETED_SUCCESS') return 6;
    return isFailed ? 3 : 2;
  })();

  /**
   * Step 1 & 2: Initiate Device Geolocation & Verify against Backend Geofence
   */
  const startFlow = useCallback(async () => {
    setError(null);
    setLocationToken(null);
    setFaceToken(null);
    setVerifiedDistance(null);
    stopCountdown();
    setActiveChallenge(null);
    setChallengeCountdown(null);
    setCaptureCountdown(null);
    setIsVerifying(false);
    setIsVerified(false);
    setIsFailed(false);
    setIsSubmitting(false);

    setBiometricStatus({
      faceDetected: 'idle',
      faceQuality: 'idle',
      livenessCheck: 'idle',
      identityMatch: 'idle',
      failureTitle: null,
      failureMessage: null,
      errorCode: null,
    });

    setIdentityCheck({
      isChecking: false,
      faceDetected: false,
      faceMatching: false,
      identityVerified: false,
      faceFailed: false,
      confidenceScore: null,
      errorMessage: null,
      faceToken: null,
      registeredSuccess: null,
      isRegisteringProfile: false,
    });

    // 1. Session validation
    if (!isAuthenticated || !user) {
      setStep('FAILED_ERROR');
      setError({
        code: 'AUTH_REQUIRED',
        title: 'Authentication Required',
        message: 'You must be logged in as a faculty member to mark attendance.',
        retryable: false,
      });
      return;
    }

    // 2. Request physical location from device
    setStep('LOCATION_CHECKING');
    const locationResult: GeoLocationState = await geo.acquireDeviceCoordinates();

    if (locationResult.error || !locationResult.latitude || !locationResult.longitude) {
      setStep('FAILED_ERROR');
      setError({
        code:
          locationResult.errorCode === 'PERMISSION_DENIED'
            ? 'LOCATION_PERMISSION_DENIED'
            : 'LOCATION_TIMEOUT',
        title: 'Device Location Acquisition Failed',
        message:
          locationResult.error ||
          'Unable to acquire GPS coordinates from your device.',
        retryable: true,
        actionLabel: 'Retry Location Acquisition',
      });
      return;
    }

    // 3. Send raw coordinates to backend for server-side Haversine validation
    try {
      const response = await attendanceService.verifyLocation({
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        accuracy: locationResult.accuracy || 15,
      });

      setLocationToken(response.locationToken);
      setVerifiedDistance(response.distanceFromZone);
      setActiveZoneName(response.zoneName);

      // Backend confirmed physical presence within campus boundary
      setStep('LOCATION_VERIFIED');

      // 4. Open Camera upon valid location confirmation
      await camera.startCamera('user');
      setStep('CAMERA_ACTIVE');
    } catch (err: unknown) {
      setStep('FAILED_ERROR');
      const apiErr = err instanceof ApiError ? err : null;
      const code = apiErr?.code || 'SERVER_ERROR';

      if (code === 'LOCATION_OUTSIDE_ZONE') {
        const details = (apiErr?.details as any) || {};
        const dist = details.distanceFromZone ? Math.round(details.distanceFromZone) : 'outside';
        const allowed = details.allowedRadius || 500;
        setError({
          code: 'OUTSIDE_GEOFENCE',
          title: 'Outside Campus Geofence',
          message: `You are currently ${dist}m away from ${details.zoneName || 'Campus'}. You must be physically within ${allowed}m to mark attendance.`,
          detail: 'Please step inside campus perimeter and verify that device GPS high-accuracy mode is active.',
          retryable: true,
          actionLabel: 'Recalibrate GPS',
        });
      } else if (code === 'GPS_ACCURACY_TOO_LOW') {
        setError({
          code: 'LOCATION_INACCURATE',
          title: 'GPS Signal Accuracy Insufficient',
          message: apiErr?.message || 'GPS signal tolerance exceeds permitted threshold.',
          detail: 'Please step outdoors or away from metallic structures to allow satellite triangulation.',
          retryable: true,
          actionLabel: 'Retry GPS Lock',
        });
      } else if (apiErr?.isRateLimited) {
        setError({
          code: 'SERVER_ERROR',
          title: 'Rate Limit Reached',
          message: 'Too many verification attempts in a short interval. Please wait 1 minute before retrying.',
          retryable: true,
          actionLabel: 'Wait and Retry',
        });
      } else if (apiErr?.isUnauthorized) {
        setError({
          code: 'AUTH_REQUIRED',
          title: 'Session Expired',
          message: 'Your authentication session has expired. Please log in again.',
          retryable: false,
        });
      } else {
        setError({
          code: 'SERVER_ERROR',
          title: 'Geofence Verification Error',
          message: apiErr?.message || 'Failed to verify campus location with attendance server.',
          retryable: true,
          actionLabel: 'Retry',
        });
      }
    }
  }, [isAuthenticated, user, geo, camera, stopCountdown]);

  /**
   * Phase 4: Primary Biometric Verification Execution
   * 1. Requests server-generated challenge
   * 2. Starts expiration countdown
   * 3. Captures multi-frame camera sequence
   * 4. Sends sequence to backend for SFace identity + kinematic liveness verification
   * 5. Strictly unlocks attendance ONLY if both checks pass
   */
  const startVerification = useCallback(async () => {
    setIsVerifying(true);
    setIsFailed(false);
    setError(null);

    setBiometricStatus({
      faceDetected: 'evaluating',
      faceQuality: 'evaluating',
      livenessCheck: 'evaluating',
      identityMatch: 'evaluating',
      failureTitle: null,
      failureMessage: null,
      errorCode: null,
    });

    try {
      // 1. Request a cryptographically unique server challenge
      const challengeData = await attendanceService.requestLivenessChallenge();
      setActiveChallenge({
        token: challengeData.challengeToken,
        type: challengeData.challengeType,
        instruction: challengeData.instruction,
        expiresInSeconds: BIOMETRIC_CONFIG.SERVER_CHALLENGE_TTL_SECONDS,
        expiresAt: Date.now() + BIOMETRIC_CONFIG.SERVER_CHALLENGE_TTL_SECONDS * 1000,
      });

      // Step: CHALLENGE_READY (User gets ready, sees instruction)
      setStep('CHALLENGE_READY');

      // 2. Start server challenge security TTL countdown (60s) in background
      startCountdown(BIOMETRIC_CONFIG.SERVER_CHALLENGE_TTL_SECONDS, () => {
        setBiometricStatus((prev) => ({
          ...prev,
          livenessCheck: 'failed',
          failureTitle: 'Verification session expired.',
          failureMessage: 'Start a new verification attempt.',
          errorCode: 'CHALLENGE_EXPIRED',
        }));
        setIsVerifying(false);
        setIsFailed(true);
        setActiveChallenge(null);
        setCaptureCountdown(null);
      });

      // 3. User registers visual prompt (grace period before capture)
      await new Promise((r) => setTimeout(r, BIOMETRIC_CONFIG.PRE_CAPTURE_GRACE_MS));

      // 4. Transition to LIVENESS_CAPTURING (5-second active capture window)
      setStep('LIVENESS_CAPTURING');
      setCaptureCountdown(5);

      // 5. Capture multi-frame sequence across verification window (~5 seconds, ~10 frames)
      const sequence = await camera.captureFrameSequence(
        BIOMETRIC_CONFIG.TARGET_FRAME_COUNT,
        BIOMETRIC_CONFIG.FRAME_CAPTURE_INTERVAL_MS,
        (_capturedCount, remainingSeconds) => {
          setCaptureCountdown(remainingSeconds);
        }
      );
      setPreviewUrl(sequence.primaryPreviewUrl);

      // 6. Transition to LIVENESS_ANALYZING ("Analyzing liveness...")
      setStep('LIVENESS_ANALYZING');
      setCaptureCountdown(null);

      // 7. Convert frames to base64
      const imageBase64 = await blobToBase64(sequence.primaryBlob);
      const framesBase64 = await Promise.all(
        sequence.frameBlobs.map((f) => blobToBase64(f))
      );

      // 8. Verify with backend attendance API (YuNet liveness + OpenCV SFace multi-frame consensus)
      const result = await attendanceService.verifyFace({
        imageBase64,
        frames: framesBase64,
        challengeToken: challengeData.challengeToken,
      });

      stopCountdown();
      setActiveChallenge(null);
      setCaptureCountdown(null);

      // 9. Backend confirmed BOTH identity consensus and kinematic liveness
      if (result.identityMatched && result.livenessVerified && result.faceToken) {
        // Step: LIVENESS_VERIFIED
        setStep('LIVENESS_VERIFIED');
        setBiometricStatus((prev) => ({
          ...prev,
          faceDetected: 'passed',
          faceQuality: 'passed',
          livenessCheck: 'passed',
        }));

        // Transition through IDENTITY_MATCHING to IDENTITY_VERIFIED
        await new Promise((r) => setTimeout(r, 400));
        setStep('IDENTITY_VERIFIED');

        setBiometricStatus({
          faceDetected: 'passed',
          faceQuality: 'passed',
          livenessCheck: 'passed',
          identityMatch: 'passed',
          failureTitle: null,
          failureMessage: null,
          errorCode: null,
        });

        setIdentityCheck({
          isChecking: false,
          faceDetected: true,
          faceMatching: false,
          identityVerified: true,
          faceFailed: false,
          confidenceScore: result.similarity ?? null,
          errorMessage: null,
          faceToken: result.faceToken,
        });

        setFaceToken(result.faceToken);
        setIsVerified(true);
        setIsVerifying(false);
        setIsFailed(false);
        setStep('ATTENDANCE_READY');
      } else {
        throw new Error('Biometric verification was rejected by server.');
      }
    } catch (err: unknown) {
      stopCountdown();
      setActiveChallenge(null);
      setCaptureCountdown(null);
      setIsVerifying(false);
      setIsFailed(true);

      const apiErr = err instanceof ApiError ? err : null;
      const code = apiErr?.code || 'FACE_VERIFICATION_FAILED';

      let title = 'Verification Failed';
      let message = apiErr?.message || 'Biometric verification failed. Please try again.';

      let detectedStatus: BiometricItemStatus = 'passed';
      let qualityStatus: BiometricItemStatus = 'passed';
      let livenessStatus: BiometricItemStatus = 'failed';
      let identityStatus: BiometricItemStatus = 'idle';

      // Specific requirement messages from Phase 4 Section 5:
      if (code === 'FACE_MISMATCH') {
        title = 'Identity verification failed.';
        message = 'The detected face does not match the registered faculty profile.';
        detectedStatus = 'passed';
        qualityStatus = 'passed';
        livenessStatus = 'passed';
        identityStatus = 'failed';
      } else if (
        code === 'LIVENESS_FAILED' ||
        code === 'STATIC_OR_REPLAY_ATTACK_DETECTED' ||
        code === 'SINGLE_FRAME_LIVENESS_REJECTED'
      ) {
        title = 'Live verification failed.';
        message = 'Please follow the camera challenge and try again.';
        detectedStatus = 'passed';
        qualityStatus = 'passed';
        livenessStatus = 'failed';
        identityStatus = 'idle';
      } else if (code === 'CHALLENGE_EXPIRED') {
        title = 'Verification session expired.';
        message = 'Start a new verification attempt.';
        detectedStatus = 'idle';
        qualityStatus = 'idle';
        livenessStatus = 'failed';
        identityStatus = 'idle';
      } else if (code === 'NO_FACE_DETECTED') {
        title = 'No face detected.';
        message = 'Position your face inside the guide.';
        detectedStatus = 'failed';
        qualityStatus = 'failed';
        livenessStatus = 'failed';
        identityStatus = 'failed';
      } else if (code === 'MULTIPLE_FACES_DETECTED') {
        title = 'Multiple faces detected.';
        message = 'Only the registered faculty member should be visible.';
        detectedStatus = 'failed';
        qualityStatus = 'failed';
        livenessStatus = 'failed';
        identityStatus = 'failed';
      } else if (
        code === 'IMAGE_TOO_DARK' ||
        code === 'IMAGE_TOO_BLURRY' ||
        code === 'IMAGE_TOO_POOR' ||
        code === 'LOW_IMAGE_RESOLUTION' ||
        code === 'INSUFFICIENT_LIGHTING'
      ) {
        title = 'Lighting is insufficient.';
        message = 'Move to a brighter location and try again.';
        detectedStatus = 'passed';
        qualityStatus = 'failed';
        livenessStatus = 'failed';
        identityStatus = 'failed';
      }

      setBiometricStatus({
        faceDetected: detectedStatus,
        faceQuality: qualityStatus,
        livenessCheck: livenessStatus,
        identityMatch: identityStatus,
        failureTitle: title,
        failureMessage: message,
        errorCode: code,
      });

      setIdentityCheck({
        isChecking: false,
        faceDetected: detectedStatus === 'passed',
        faceMatching: false,
        identityVerified: false,
        faceFailed: true,
        confidenceScore: null,
        errorMessage: message,
        faceToken: null,
      });
    }
  }, [camera, startCountdown, stopCountdown]);

  /**
   * Phase 4 Section 6: Retry Flow
   * When user clicks Try Again:
   * 1. Request a new server challenge.
   * 2. Create a new verification session.
   * 3. Capture a new frame sequence.
   * 4. Perform liveness again.
   * 5. Perform identity matching again.
   * Never reuses an expired or consumed challenge.
   */
  const retryVerification = useCallback(async () => {
    stopCountdown();
    setActiveChallenge(null);
    setChallengeCountdown(null);
    setIsFailed(false);
    setIsVerifying(false);
    setPreviewUrl(null);

    // Reopen camera stream if closed
    if (!camera.cameraState.isActive) {
      await camera.startCamera('user');
    }

    // Automatically trigger fresh verification session
    await startVerification();
  }, [camera, stopCountdown, startVerification]);

  /**
   * Step 5 -> Step 6: Transition to Compact Pre-Submission Attendance Summary
   */
  const proceedToSummary = useCallback(() => {
    setStep('ATTENDANCE_SUMMARY');
  }, []);

  /**
   * Return from summary to camera viewport if desired
   */
  const backToCamera = useCallback(() => {
    setStep('IDENTITY_VERIFIED');
  }, []);

  /**
   * Step 6: Submit final verified attendance transaction
   */
  const submitAttendance = useCallback(async () => {
    if (!locationToken || !faceToken || !geo.latitude || !geo.longitude) {
      setError({
        code: 'SERVER_ERROR',
        title: 'Missing Security Tokens',
        message: 'Location or biometric verification tokens are missing. Please complete verification.',
        retryable: true,
        actionLabel: 'Restart Verification',
      });
      return;
    }

    setIsSubmitting(true);
    setStep('VERIFYING_MULTI_GATE');
    setProgress({
      locationVerified: true,
      faceVerifying: false,
      faceVerified: true,
      livenessVerifying: false,
      livenessVerified: true,
      attendanceProcessing: true,
      attendanceProcessed: false,
    });

    try {
      const record = await attendanceService.markAttendance({
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy || 15,
        locationToken,
        faceToken,
        faceVerified: true,
        livenessPassed: true,
      });

      setProgress((prev) => ({
        ...prev,
        attendanceProcessing: false,
        attendanceProcessed: true,
      }));
      setVerifiedRecord(record);
      setStep('COMPLETED_SUCCESS');
    } catch (err: unknown) {
      setIsSubmitting(false);
      setStep('FAILED_ERROR');
      const apiErr = err instanceof ApiError ? err : null;
      const code = apiErr?.code || 'SERVER_ERROR';

      let title = 'Attendance Submission Failed';
      let message = apiErr?.message || 'Failed to record attendance on the server.';
      let retryable = true;

      if (code === 'DUPLICATE_ATTENDANCE' || code === 'ALREADY_MARKED') {
        title = 'Attendance Already Recorded';
        message = 'You have already marked your attendance for today. Duplicate submissions are strictly prevented.';
        retryable = false;
      } else if (code === 'LOCATION_TOKEN_EXPIRED') {
        title = 'Location Window Expired';
        message = 'Campus location verification has timed out. Please verify your location again.';
      } else if (code === 'FACE_TOKEN_EXPIRED') {
        title = 'Biometric Verification Expired';
        message = 'Biometric verification session has timed out. Please verify your identity again.';
      } else if (code === 'EVIDENCE_PERSISTENCE_FAILED') {
        title = 'Verification Evidence Save Failed';
        message = "Attendance could not be completed. We couldn't securely save the verification record. Please retry.";
        retryable = true;
      }

      setError({
        code: (code as any) || 'SERVER_ERROR',
        title,
        message,
        retryable,
        actionLabel: retryable ? 'Retry Verification' : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [locationToken, faceToken, geo]);

  /**
   * Reset entire attendance flow back to start
   */
  const resetFlow = useCallback(() => {
    stopCountdown();
    camera.stopCamera();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setLocationToken(null);
    setFaceToken(null);
    setVerifiedDistance(null);
    setError(null);
    setVerifiedRecord(null);
    setActiveChallenge(null);
    setChallengeCountdown(null);
    setIsVerifying(false);
    setIsVerified(false);
    setIsFailed(false);
    setIsSubmitting(false);

    setBiometricStatus({
      faceDetected: 'idle',
      faceQuality: 'idle',
      livenessCheck: 'idle',
      identityMatch: 'idle',
      failureTitle: null,
      failureMessage: null,
      errorCode: null,
    });

    setIdentityCheck({
      isChecking: false,
      faceDetected: false,
      faceMatching: false,
      identityVerified: false,
      faceFailed: false,
      confidenceScore: null,
      errorMessage: null,
      faceToken: null,
      registeredSuccess: null,
      isRegisteringProfile: false,
    });

    setProgress({
      locationVerified: false,
      faceVerifying: false,
      faceVerified: false,
      livenessVerifying: false,
      livenessVerified: false,
      attendanceProcessing: false,
      attendanceProcessed: false,
    });

    setStep('AUTH_CHECK');
  }, [camera, previewUrl, stopCountdown]);

  return {
    step,
    currentFlowStep,
    sessionType,
    error,
    geo,
    camera,
    user,
    previewUrl,
    progress,
    verifiedRecord,
    verifiedDistance,
    activeZoneName,
    biometricStatus,
    activeChallenge,
    challengeCountdown,
    captureCountdown,
    isVerifying,
    isVerified,
    isFailed,
    isSubmitting,
    identityCheck,
    startFlow,
    startVerification,
    retryVerification,
    proceedToSummary,
    backToCamera,
    submitAttendance,
    resetFlow,
  };
}
