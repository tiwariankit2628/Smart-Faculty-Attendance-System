import { describe, it, expect, vi } from 'vitest';
import {
  ORIGINAL_LPU_CAMPUS_ZONE,
  DEFAULT_CAMPUS_ZONE,
  normalizeAttendanceRecord,
  attendanceService,
} from '../services/attendance.service';
import { BIOMETRIC_CONFIG } from '../utils/biometricConfig';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: string, public statusCode: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('Frontend Attendance Service & Biometric Timing Config', () => {
  it('should preserve original college coordinates for LPU campus', () => {
    expect(ORIGINAL_LPU_CAMPUS_ZONE.latitude).toBe(31.2536);
    expect(ORIGINAL_LPU_CAMPUS_ZONE.longitude).toBe(75.7037);
    expect(ORIGINAL_LPU_CAMPUS_ZONE.radiusMeters).toBe(500);
    expect(ORIGINAL_LPU_CAMPUS_ZONE.maxAccuracyMeters).toBe(35);
  });

  it('should define valid active testing zone coordinates', () => {
    expect(DEFAULT_CAMPUS_ZONE.latitude).toBeDefined();
    expect(DEFAULT_CAMPUS_ZONE.longitude).toBeDefined();
    expect(DEFAULT_CAMPUS_ZONE.radiusMeters).toBeGreaterThan(0);
  });

  it('should verify Phase 7 liveness capture configuration constants', () => {
    expect(BIOMETRIC_CONFIG.LIVENESS_CAPTURE_DURATION_MS).toBe(5000);
    expect(BIOMETRIC_CONFIG.TARGET_FRAME_COUNT).toBe(10);
    expect(BIOMETRIC_CONFIG.FRAME_CAPTURE_INTERVAL_MS).toBe(450);
    expect(BIOMETRIC_CONFIG.PRE_CAPTURE_GRACE_MS).toBe(800);
    expect(BIOMETRIC_CONFIG.SERVER_CHALLENGE_TTL_SECONDS).toBe(60);
    // 10 frames * 450ms = 4500ms + initial frame = ~5000ms duration
    expect(BIOMETRIC_CONFIG.TARGET_FRAME_COUNT * BIOMETRIC_CONFIG.FRAME_CAPTURE_INTERVAL_MS).toBe(4500);
  });

  it('should correctly normalize raw attendance record from backend', () => {
    const raw = {
      _id: 'att_12345',
      facultyId: {
        _id: 'fac_999',
        name: 'Dr. Jane Smith',
        employeeId: 'LPU-EMP-999',
        department: 'School of Computer Science',
      },
      date: '2026-10-07',
      timestamp: '2026-10-07T09:00:00.000Z',
      status: 'VERIFIED',
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      distanceFromZone: 25,
      verificationMetadata: {
        faceConfidence: 0.98,
        livenessScore: 0.99,
        accuracyMeters: 10,
        zoneName: 'Main Campus',
      },
    };

    const record = normalizeAttendanceRecord(raw);

    expect(record.id).toBe('att_12345');
    expect(record.facultyId).toBe('fac_999');
    expect(record.facultyName).toBe('Dr. Jane Smith');
    expect(record.status).toBe('VERIFIED');
    expect(record.locationVerification.distanceMeters).toBe(25);
    expect(record.faceVerification.confidenceScore).toBe(0.98);
  });

  it('should request single-session liveness challenge token with mock client', async () => {
    const mockPost = vi.mocked(apiClient);
    mockPost.mockResolvedValueOnce({
      challengeToken: 'chal_sec_nonce_99182',
      challengeType: 'TURN_RIGHT',
      instruction: 'Turn your head slightly right',
      expiresInSeconds: 60,
    });

    const challenge = await attendanceService.requestLivenessChallenge();
    expect(challenge.challengeToken).toBe('chal_sec_nonce_99182');
    expect(challenge.challengeType).toBe('TURN_RIGHT');
    expect(challenge.instruction).toBe('Turn your head slightly right');
    expect(challenge.action).toBe('TURN_RIGHT');
    expect(mockPost).toHaveBeenCalledWith('/attendance/challenge', { method: 'POST' });
  });

  it('should normalize verificationEvidence metadata correctly when evidence is present', () => {
    const rawWithEvidence = {
      _id: 'att_evi_1',
      facultyId: 'fac_1',
      date: '2026-10-09',
      status: 'VERIFIED',
      verificationEvidence: {
        reference: 'ev_test_123.jpg',
        capturedAt: '2026-10-09T09:00:00.000Z',
        contentType: 'image/jpeg',
        size: 54321,
        retentionUntil: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    const record = normalizeAttendanceRecord(rawWithEvidence);
    expect(record.verificationEvidence).toBeDefined();
    expect(record.verificationEvidence?.hasEvidence).toBe(true);
    expect(record.verificationEvidence?.reference).toBe('ev_test_123.jpg');
    expect(record.verificationEvidence?.size).toBe(54321);
    expect(record.verificationEvidence?.isExpired).toBe(false);
  });

  it('should normalize evidence key from admin API response correctly', () => {
    const rawFromAdmin = {
      _id: 'att_evi_admin',
      facultyId: 'fac_1',
      date: '2026-10-09',
      status: 'VERIFIED',
      evidence: {
        hasEvidence: true,
        isExpired: false,
        capturedAt: '2026-10-09T09:00:00.000Z',
      },
    };

    const record = normalizeAttendanceRecord(rawFromAdmin);
    expect(record.verificationEvidence).toBeDefined();
    expect(record.verificationEvidence?.hasEvidence).toBe(true);
    expect(record.verificationEvidence?.isExpired).toBe(false);
  });

  it('should detect expired evidence based on retentionUntil in the past', () => {
    const rawExpired = {
      _id: 'att_evi_exp',
      facultyId: 'fac_1',
      date: '2026-06-01',
      status: 'VERIFIED',
      verificationEvidence: {
        reference: 'ev_old.jpg',
        capturedAt: '2026-06-01T09:00:00.000Z',
        retentionUntil: '2026-09-01T09:00:00.000Z', // In the past
      },
    };

    const record = normalizeAttendanceRecord(rawExpired);
    expect(record.verificationEvidence?.isExpired).toBe(true);
  });

  it('should handle records with no evidence safely', () => {
    const rawNoEvidence = {
      _id: 'att_no_evi',
      facultyId: 'fac_1',
      date: '2026-10-09',
      status: 'VERIFIED',
    };

    const record = normalizeAttendanceRecord(rawNoEvidence);
    expect(record.verificationEvidence).toBeUndefined();
  });
});

