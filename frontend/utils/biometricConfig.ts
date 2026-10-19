/**
 * Centralized Configuration for Biometric Liveness Capture & Multi-Frame Identity Verification
 * Enforces Phase 7 timing, frame acquisition cadence, and security lifecycles.
 */
export const BIOMETRIC_CONFIG = {
  /** Total user interaction window for performing the requested motion (milliseconds) */
  LIVENESS_CAPTURE_DURATION_MS: 5000,

  /** Preparation / prompt visual registration grace period before frame capture starts (milliseconds) */
  PRE_CAPTURE_GRACE_MS: 800,

  /** Target number of frames to acquire continuously across the capture window (8–15 frames) */
  TARGET_FRAME_COUNT: 10,

  /** Interval between continuous frame captures: ~450ms (~10 frames over ~4.5 - 5.0 seconds) */
  FRAME_CAPTURE_INTERVAL_MS: 450,

  /** Server-side challenge nonce security TTL (Redis security expiration) */
  SERVER_CHALLENGE_TTL_SECONDS: 60,
} as const;
