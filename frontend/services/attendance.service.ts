import {
  AttendanceRecord,
  TodayAttendanceStatus,
  VerifyLocationResponse,
  VerifyFaceResponse,
  MarkAttendancePayload,
} from '../types';
import { apiClient } from '../lib/api-client';

// ORIGINAL COLLEGE CONFIGURATION (Preserved for restoration after testing):
export const ORIGINAL_LPU_CAMPUS_ZONE = {
  id: 'geo_lpu_01',
  name: 'Lovely Professional University (LPU) - Main Campus',
  latitude: 31.2536,
  longitude: 75.7037,
  radiusMeters: 500,
  maxAccuracyMeters: 35,
};

// CURRENT ACTIVE GEOFENCE (Temporary testing near Railway Community Hall, Jodhpur):
export const DEFAULT_CAMPUS_ZONE = {
  id: 'geo_jodhpur_test_01',
  name: 'Railway Community Hall, Jodhpur (Testing Zone)',
  latitude: 26.807646,
  longitude: 75.818616,
  radiusMeters: 5000,
  maxAccuracyMeters: 1000,
};

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function normalizeAttendanceRecord(raw: any): AttendanceRecord {
  if (!raw) return raw;
  const id = raw.id || raw._id || `att_${Date.now()}`;
  const facultyObj = typeof raw.facultyId === 'object' ? raw.facultyId : null;
  const facultyId = facultyObj?._id || facultyObj?.id || raw.facultyId || '';
  const facultyName = raw.facultyName || facultyObj?.name || 'Faculty Member';
  const employeeId = raw.employeeId || facultyObj?.employeeId || 'FACULTY';
  const department =
    raw.department ||
    facultyObj?.department ||
    'Academic Department';

  const date =
    raw.date ||
    (raw.timestamp
      ? new Date(raw.timestamp).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]);

  const timestamp =
    typeof raw.timestamp === 'string'
      ? raw.timestamp
      : raw.timestamp
      ? new Date(raw.timestamp).toISOString()
      : new Date().toISOString();

  const status = raw.status || 'VERIFIED';
  const meta = raw.verificationMetadata || {};

  return {
    id,
    facultyId,
    facultyName,
    employeeId,
    department,
    date,
    sessionType: raw.sessionType || 'CHECK_IN',
    status,
    timestamp,
    locationVerification: {
      verified: raw.locationVerified ?? true,
      geofenceId: meta.zoneId || 'geo_lpu_01',
      geofenceName:
        meta.zoneName || 'Lovely Professional University (LPU) - Main Campus',
      distanceMeters: raw.distanceFromZone ?? 0,
      accuracyMeters: meta.accuracyMeters ?? 10,
      isMockedSuspicion: false,
    },
    faceVerification: {
      verified: raw.faceVerified ?? true,
      confidenceScore: meta.faceConfidence ?? 0.94,
      matchThreshold: 0.7,
      livenessPassed: raw.livenessVerified ?? true,
      livenessScore: meta.livenessScore ?? 0.98,
    },
    deviceAudit: {
      ipAddress: meta.ipAddress || '127.0.0.1',
      userAgent:
        meta.userAgent ||
        (typeof navigator !== 'undefined'
          ? navigator.userAgent
          : 'Web Client'),
      clientTimestamp: timestamp,
    },
    rejectionReason: meta.rejectionReason,
    manualOverride: raw.manualOverride
      ? {
          overriddenBy:
            (raw.manualOverride.adminId ? String(raw.manualOverride.adminId) : '') ||
            raw.manualOverride.overriddenBy ||
            'ADMIN',
          overriddenByName:
            raw.manualOverride.adminName ||
            raw.manualOverride.overriddenByName ||
            'Administrator',
          reason: raw.manualOverride.reason,
          overriddenAt:
            raw.manualOverride.timestamp ||
            raw.manualOverride.overriddenAt ||
            new Date().toISOString(),
        }
      : undefined,
    evidenceAvailable: (() => {
      if (typeof raw.evidenceAvailable === 'boolean') return raw.evidenceAvailable;
      const ev = raw.verificationEvidence || raw.evidence;
      const hasRef = Boolean(ev?.reference || ev?.hasEvidence);
      const isExp = Boolean(ev?.isExpired ?? (ev?.retentionUntil ? new Date() > new Date(ev.retentionUntil) : false));
      return hasRef && !isExp;
    })(),
    evidenceExpired: (() => {
      if (typeof raw.evidenceExpired === 'boolean') return raw.evidenceExpired;
      const ev = raw.verificationEvidence || raw.evidence;
      const hasRef = Boolean(ev?.reference || ev?.hasEvidence);
      const isExp = Boolean(ev?.isExpired ?? (ev?.retentionUntil ? new Date() > new Date(ev.retentionUntil) : false));
      return hasRef && isExp;
    })(),
    verificationEvidence: (() => {
      const ev = raw.verificationEvidence || raw.evidence;
      if (!ev) return undefined;
      const isExpired = Boolean(
        raw.evidenceExpired ??
        ev?.isExpired ??
        (ev?.retentionUntil ? new Date() > new Date(ev.retentionUntil) : false)
      );
      const hasEvidence = Boolean(
        raw.evidenceAvailable !== undefined
          ? raw.evidenceAvailable
          : (ev.hasEvidence !== undefined ? ev.hasEvidence : Boolean(ev.reference))
      );

      if (!hasEvidence && !isExpired && !ev.reference) {
        return undefined;
      }

      return {
        reference: ev?.reference || undefined,
        capturedAt: ev?.capturedAt ? new Date(ev.capturedAt).toISOString() : undefined,
        contentType: ev?.contentType || 'image/jpeg',
        size: ev?.size,
        retentionUntil: ev?.retentionUntil ? new Date(ev.retentionUntil).toISOString() : undefined,
        hasEvidence: hasEvidence && !isExpired,
        isExpired,
      };
    })(),
  };
}

export const attendanceService = {
  /**
   * Step 1: Verify GPS coordinates against backend geofence engine.
   * Sends raw coordinates to backend; backend calculates Haversine distance
   * and issues a short-lived single-use location token (loc_<uuid>).
   */
  async verifyLocation(coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }): Promise<VerifyLocationResponse> {
    return await apiClient<VerifyLocationResponse>('/attendance/verify-location', {
      method: 'POST',
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      }),
    });
  },

  /**
   * Step 2: Verify captured selfie against faculty face embedding.
   * Sends base64 image payload to backend, which runs biometric and liveness checks,
   * returning a short-lived single-use face token (face_<uuid>).
   */
  async verifyFace(payload: {
    imageBase64: string;
    frames?: string[];
    challengeToken?: string;
  }): Promise<VerifyFaceResponse> {
    return await apiClient<VerifyFaceResponse>('/attendance/verify-face', {
      method: 'POST',
      body: JSON.stringify({
        image: payload.imageBase64,
        frames: payload.frames,
        challengeToken: payload.challengeToken,
      }),
    });
  },

  /**
   * Enrolls/registers live captured face photo as official faculty face profile in backend.
   */
  async registerFace(imageBase64: string): Promise<{ registered: boolean; message: string }> {
    return await apiClient<{ registered: boolean; message: string }>('/faculty/face-registration', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
    });
  },

  /**
   * Step 3: Submit final attendance transaction to backend.
   * Backend enforces database uniqueness { facultyId, date },
   * verifies single-use tokens, writes MongoDB attendance record, and logs audit.
   */
  async markAttendance(payload: MarkAttendancePayload): Promise<AttendanceRecord> {
    const rawResult = await apiClient<any>('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        locationToken: payload.locationToken,
        faceToken: payload.faceToken,
        faceVerified: payload.faceVerified ?? true,
        faceConfidence: payload.faceConfidence ?? 0.94,
        livenessPassed: payload.livenessPassed ?? true,
        challengeToken: payload.challengeToken,
        idempotencyKey:
          payload.idempotencyKey ||
          `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      }),
    });

    return normalizeAttendanceRecord(rawResult);
  },

  /**
   * Fetch today's confirmed attendance record from backend MongoDB.
   */
  async getTodayAttendance(): Promise<AttendanceRecord | null> {
    try {
      const response = await apiClient<{ attendance: any }>('/attendance/today');
      if (response && response.attendance) {
        return normalizeAttendanceRecord(response.attendance);
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Aggregate today's attendance status for the faculty dashboard.
   */
  async getTodayStatus(): Promise<TodayAttendanceStatus> {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecord = await this.getTodayAttendance();
    const history = await this.getAttendanceHistory(30);

    const totalWorkingDays = Math.max(history.length, 1);
    const presentDays = history.filter((r) => r.status === 'VERIFIED').length;
    const attendancePercentage = Math.round((presentDays / totalWorkingDays) * 100);

    if (todayRecord) {
      return {
        date: todayStr,
        attendancePercentage,
        totalWorkingDays,
        presentDays,
        checkIn: {
          marked: true,
          time: todayRecord.timestamp,
          status: todayRecord.status,
          geofenceName:
            todayRecord.locationVerification?.geofenceName ||
            DEFAULT_CAMPUS_ZONE.name,
        },
      };
    }

    return {
      date: todayStr,
      attendancePercentage: attendancePercentage || 100,
      totalWorkingDays,
      presentDays,
      checkIn: {
        marked: false,
      },
      checkOut: {
        marked: false,
      },
    };
  },

  /**
   * Fetch historical attendance records from backend MongoDB.
   */
  async getAttendanceHistory(limit = 30): Promise<AttendanceRecord[]> {
    try {
      const response = await apiClient<{ records: any[] }>(
        `/attendance/history?limit=${limit}`
      );
      if (response && Array.isArray(response.records)) {
        return response.records.map(normalizeAttendanceRecord);
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Requests a cryptographically signed, single-session liveness challenge token from the backend.
   */
  async requestLivenessChallenge(): Promise<{
    challengeToken: string;
    challengeType: string;
    instruction: string;
    action: string;
  }> {
    const response = await apiClient<{
      challengeToken: string;
      challengeType: string;
      instruction: string;
      expiresInSeconds: number;
    }>('/attendance/challenge', { method: 'POST' });
    return {
      challengeToken: response.challengeToken,
      challengeType: response.challengeType || 'LOOK_UP',
      instruction: response.instruction || 'Look at the camera',
      action: response.challengeType || 'LOOK_UP',
    };
  },
};
