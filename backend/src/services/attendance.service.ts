import crypto from 'crypto';
import { attendanceRepository } from '../repositories/attendance.repository';
import { attendanceZoneRepository } from '../repositories/attendanceZone.repository';
import { userRepository } from '../repositories/user.repository';
import { faceVerificationService } from './faceVerification.service';
import { evidenceStorageService } from './evidenceStorage.service';
import { auditService } from './audit.service';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { calculateHaversineDistance, isValidCoordinate } from '../utils/geo';
import { isTrustedCampusIp } from '../utils/networkTrust';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';
import {
  VerifyLocationInput,
  VerifyFaceInput,
  MarkAttendanceInput,
} from '../validators/attendance.validator';
import { IAttendanceZone } from '../types';

export class AttendanceService {
  /**
   * Retrieves the active attendance geofence zone, falling back to configured environment defaults
   */
  async getActiveZone(): Promise<IAttendanceZone> {
    const zone = await attendanceZoneRepository.getActiveZone();
    if (zone) {
      return zone;
    }

    // Fallback to configured environment defaults
    return {
      _id: undefined as any,
      name: 'Lovely Professional University (LPU) - Main Campus',
      latitude: env.DEFAULT_GEOFENCE_LAT,
      longitude: env.DEFAULT_GEOFENCE_LNG,
      radiusMeters: env.DEFAULT_GEOFENCE_RADIUS_METERS,
      maxAllowedAccuracyMeters: env.MAX_ALLOWED_ACCURACY_METERS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Step 1: Verify location against campus network anchor and active geofence zone
   * Generates a short-lived token stored in Redis upon success
   */
  async verifyLocation(facultyId: string, input: VerifyLocationInput, clientIp?: string) {
    // 1. Campus Network Trust & Physical Anchor Check
    const effectiveIp = clientIp || '127.0.0.1';
    if (!isTrustedCampusIp(effectiveIp)) {
      logger.warn(
        { facultyId, clientIp: effectiveIp },
        'Location verification rejected: client IP not in authorized campus network'
      );
      throw AppError.forbidden(
        'Location verification failed: request does not originate from an authorized campus network or Wi-Fi IP range.',
        'LOCATION_NETWORK_NOT_TRUSTED',
        { clientIp: effectiveIp }
      );
    }

    if (!isValidCoordinate(input.latitude, input.longitude)) {
      throw AppError.badRequest('Invalid GPS coordinates provided.', 'INVALID_COORDINATES');
    }

    const zone = await this.getActiveZone();
    const maxAccuracy = zone.maxAllowedAccuracyMeters || env.MAX_ALLOWED_ACCURACY_METERS;

    logger.info(
      {
        facultyId,
        coords: { lat: input.latitude, lng: input.longitude, accuracy: input.accuracy },
        zone: { name: zone.name, lat: zone.latitude, lng: zone.longitude, radius: zone.radiusMeters, maxAccuracy },
        clientIp: effectiveIp,
      },
      'Verifying incoming faculty location request'
    );

    if (input.accuracy > maxAccuracy) {
      throw AppError.badRequest(
        `GPS signal accuracy (${Math.round(input.accuracy)}m) is too low. Maximum allowed accuracy is ${maxAccuracy}m. Please ensure GPS/high accuracy mode is turned on.`,
        'GPS_ACCURACY_TOO_LOW',
        { accuracy: input.accuracy, requiredMaxAccuracy: maxAccuracy }
      );
    }

    // 2. Server-side distance calculation via Haversine formula
    const distance = calculateHaversineDistance(
      input.latitude,
      input.longitude,
      zone.latitude,
      zone.longitude
    );

    if (distance > zone.radiusMeters) {
      throw AppError.badRequest(
        'You are outside the attendance zone.',
        'LOCATION_OUTSIDE_ZONE',
        {
          distanceFromZone: distance,
          allowedRadius: zone.radiusMeters,
          zoneName: zone.name,
        }
      );
    }

    // 3. Velocity / Impossible Teleportation Check (ensure user didn't teleport into the geofence)
    try {
      const lastLocRaw = await redis.get(`attendance:lastloc:${facultyId}`);
      if (lastLocRaw) {
        const lastLoc = JSON.parse(lastLocRaw);
        const timeElapsedSec = (Date.now() - lastLoc.timestamp) / 1000;
        if (timeElapsedSec > 0 && timeElapsedSec < 300) {
          const displacementMeters = calculateHaversineDistance(
            lastLoc.latitude,
            lastLoc.longitude,
            input.latitude,
            input.longitude
          );
          // Displaced > 300m at speed > 50 m/s (~180 km/h) in under 5 minutes
          if (displacementMeters > 300 && (displacementMeters / timeElapsedSec) > 50) {
            throw AppError.badRequest(
              'Unrealistic location change detected (impossible velocity). Verification rejected.',
              'LOCATION_TELEPORTATION_DETECTED',
              { displacementMeters, timeElapsedSec, calculatedSpeedMps: displacementMeters / timeElapsedSec }
            );
          }
        }
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      // non-fatal if Redis read fails
    }

    // Cache last verified location for velocity checks (1 hour TTL)
    await redis.set(
      `attendance:lastloc:${facultyId}`,
      JSON.stringify({
        latitude: input.latitude,
        longitude: input.longitude,
        timestamp: Date.now(),
      }),
      'EX',
      3600
    );

    // Generate short-lived Redis location verification token (5 minutes TTL)
    const locationToken = `loc_${crypto.randomUUID()}`;
    const tokenPayload = {
      facultyId,
      latitude: input.latitude,
      longitude: input.longitude,
      distanceFromZone: distance,
      accuracy: input.accuracy,
      zoneName: zone.name,
      clientIp: effectiveIp,
      verifiedAt: Date.now(),
    };

    await redis.set(
      `attendance:loctoken:${locationToken}`,
      JSON.stringify(tokenPayload),
      'EX',
      300
    );

    return {
      locationVerified: true,
      distanceFromZone: distance,
      zoneName: zone.name,
      allowedRadiusMeters: zone.radiusMeters,
      locationToken,
    };
  }

  /**
   * Generates a cryptographically secure, server-randomized single-use liveness challenge nonce
   * Stored in Redis with a 60-second TTL
   */
  async createLivenessChallenge(facultyId: string) {
    const CHALLENGES = [
      { type: 'TURN_LEFT', instruction: 'Turn your head slightly to the left' },
      { type: 'TURN_RIGHT', instruction: 'Turn your head slightly to the right' },
      { type: 'LOOK_UP', instruction: 'Tilt your head slightly upward' },
      { type: 'LOOK_DOWN', instruction: 'Tilt your head slightly downward' },
      { type: 'BLINK', instruction: 'Blink your eyes naturally' },
    ];
    const selected = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

    const challengeToken = `chal_${crypto.randomUUID()}`;
    const challengePayload = {
      challengeToken,
      facultyId,
      challengeType: selected.type,
      instruction: selected.instruction,
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    };

    await redis.set(
      `attendance:challenge:${challengeToken}`,
      JSON.stringify(challengePayload),
      'EX',
      60
    );

    return {
      challengeToken,
      challengeType: selected.type,
      instruction: selected.instruction,
      expiresInSeconds: 60,
    };
  }

  /**
   * Step 2: Verify facial biometrics and live challenge against registered embedding
   * Generates a short-lived token stored in Redis ONLY when BOTH identity and liveness pass
   */
  async verifyFace(facultyId: string, input: VerifyFaceInput) {
    const user = await userRepository.findById(facultyId);
    if (!user) {
      throw AppError.notFound('Faculty not found.', 'FACULTY_NOT_FOUND');
    }

    if (!user.faceEmbeddingReference) {
      throw AppError.badRequest(
        'Facial biometrics are not registered for this faculty. Please register your face first before marking attendance.',
        'FACE_NOT_REGISTERED'
      );
    }

    // Liveness Challenge Token is strictly required for live attendance verification
    if (!input.challengeToken) {
      throw AppError.badRequest(
        'A valid liveness challenge session token is required.',
        'CHALLENGE_TOKEN_REQUIRED'
      );
    }

    const challengeKey = `attendance:challenge:${input.challengeToken}`;
    const storedChallenge = await redis.get(challengeKey);
    if (!storedChallenge) {
      throw AppError.badRequest(
        'Liveness challenge session has expired or is invalid. Please request a new challenge.',
        'CHALLENGE_EXPIRED'
      );
    }

    const parsedChallenge = JSON.parse(storedChallenge);
    if (parsedChallenge.facultyId !== facultyId) {
      throw AppError.forbidden('Liveness challenge does not belong to this faculty.', 'CHALLENGE_TOKEN_MISMATCH');
    }

    // Check expiration explicitly
    if (parsedChallenge.expiresAt && Date.now() > parsedChallenge.expiresAt) {
      await redis.del(challengeKey);
      throw AppError.badRequest(
        'Liveness challenge session has timed out. Please request a new challenge.',
        'CHALLENGE_EXPIRED'
      );
    }

    // Single-use: delete challenge nonce immediately to prevent replay attacks
    await redis.del(challengeKey);

    // Call Python FastAPI face verification microservice with multi-frame sequence and challenge
    const result = await faceVerificationService.verifyFace(
      user.employeeId,
      user.faceEmbeddingReference,
      input.image,
      input.challengeToken,
      parsedChallenge.challengeType,
      input.frames
    );

    // Enforce dual condition: BOTH identityMatched AND livenessVerified must be true
    if (!result.verified || !result.identityMatched || !result.livenessVerified) {
      const code = !result.identityMatched
        ? (result.errorCode || 'FACE_MISMATCH')
        : (!result.livenessVerified ? (result.errorCode || 'LIVENESS_FAILED') : 'FACE_VERIFICATION_FAILED');

      const defaultMsg =
        code === 'NO_FACE_DETECTED'
          ? 'No face detected. Please position your face clearly in the camera.'
          : code === 'MULTIPLE_FACES_DETECTED'
          ? 'Multiple faces detected. Please ensure only one person is visible.'
          : code === 'INSUFFICIENT_FRAMES_FOR_LIVENESS' || code === 'SINGLE_FRAME_LIVENESS_REJECTED'
          ? 'A single static image cannot be used for liveness verification. Multi-frame challenge verification is required.'
          : code === 'STATIC_OR_REPLAY_ATTACK_DETECTED'
          ? 'Static photograph or replayed frames detected. Real physical facial movement is required.'
          : code === 'LIVENESS_CHALLENGE_FAILED' || code === 'LIVENESS_FAILED'
          ? `Liveness challenge failed: Expected ${parsedChallenge.challengeType} movement was not detected.`
          : 'Face verification failed. The detected face does not match your registered faculty profile.';

      logger.warn(
        {
          facultyId,
          employeeId: user.employeeId,
          similarity: result.similarity,
          distance: result.distance,
          identityMatched: result.identityMatched,
          livenessVerified: result.livenessVerified,
          livenessStatus: result.livenessStatus,
          errorCode: code,
        },
        'Attendance face verification rejected: Identity mismatch or liveness challenge failure'
      );

      // FAIL CLOSED: NEVER issue a Redis faceToken when identity or liveness fails!
      throw AppError.badRequest(
        result.reason || defaultMsg,
        code,
        {
          similarity: result.similarity,
          distance: result.distance,
          identityMatched: result.identityMatched,
          livenessVerified: result.livenessVerified,
          livenessStatus: result.livenessStatus,
        }
      );
    }

    // Select the best verified snapshot frame for evidence archive
    const selectedSnapshotBase64 =
      result.bestFrameIndex !== undefined && input.frames?.[result.bestFrameIndex]
        ? input.frames[result.bestFrameIndex]
        : input.image;

    // Generate short-lived Redis face verification token (5 minutes TTL) ONLY upon BOTH identityMatch AND livenessVerified
    const faceToken = `face_${crypto.randomUUID()}`;
    const tokenPayload = {
      facultyId,
      employeeId: user.employeeId,
      faceVerified: true,
      identityMatched: true,
      livenessVerified: true,
      livenessStatus: 'PASSED',
      similarity: result.similarity,
      distance: result.distance,
      challengeToken: input.challengeToken,
      challengeType: parsedChallenge.challengeType,
      snapshotBase64: selectedSnapshotBase64,
      verifiedAt: Date.now(),
    };

    await redis.set(
      `attendance:facetoken:${faceToken}`,
      JSON.stringify(tokenPayload),
      'EX',
      300
    );

    return {
      faceVerified: true,
      identityMatched: true,
      livenessVerified: true,
      livenessStatus: 'PASSED',
      similarity: result.similarity,
      distance: result.distance,
      challengeType: parsedChallenge.challengeType,
      message: 'Both identity and live challenge verified successfully.',
      faceToken,
    };
  }

  /**
   * Step 3: Mark attendance
   * Enforces server-side date validation, geofencing, face checks, idempotency, and database constraints
   */
  async markAttendance(
    facultyId: string,
    input: MarkAttendanceInput,
    meta?: { ip?: string; userAgent?: string; requestId?: string }
  ) {
    // 1. Authenticate & verify faculty is active
    const user = await userRepository.findById(facultyId);
    if (!user || !user.isActive) {
      throw AppError.forbidden('Inactive faculty cannot mark attendance.', 'ACCOUNT_INACTIVE');
    }

    // 2. Validate attendance date/time on the server
    const now = new Date();
    const serverDate = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // 3. Idempotency Check via Redis
    if (input.idempotencyKey) {
      const idempotencyKey = `attendance:idempotency:${facultyId}:${input.idempotencyKey}`;
      const cachedResponse = await redis.get(idempotencyKey);
      if (cachedResponse) {
        return JSON.parse(cachedResponse);
      }
    }

    // Concurrent request lock for this faculty and date (30s lock with unique token for safe release)
    const lockKey = `attendance:lock:${facultyId}:${serverDate}`;
    const lockToken = crypto.randomUUID();
    const acquiredLock = await redis.set(lockKey, lockToken, 'NX', 'EX', 30);
    if (!acquiredLock) {
      throw AppError.conflict(
        'Attendance request is currently being processed. Please wait a moment.',
        'CONCURRENT_ATTENDANCE_REQUEST'
      );
    }

    try {
      // 4. Enforce one attendance record per faculty per day
      const existingToday = await attendanceRepository.findByFacultyAndDate(facultyId, serverDate);
      if (existingToday) {
        throw AppError.conflict(
          'Attendance has already been marked for today. Duplicate submissions are strictly prevented.',
          'DUPLICATE_ATTENDANCE'
        );
      }

      // 5. Strictly enforce verified Location Token from Redis
      if (!input.locationToken) {
        throw AppError.badRequest(
          'Location verification token is required to mark attendance.',
          'LOCATION_TOKEN_REQUIRED'
        );
      }

      const tokenRaw = await redis.get(`attendance:loctoken:${input.locationToken}`);
      if (!tokenRaw) {
        throw AppError.badRequest(
          'Location verification session has expired. Please verify your location again.',
          'LOCATION_TOKEN_EXPIRED'
        );
      }
      const parsedLocationToken = JSON.parse(tokenRaw);
      if (parsedLocationToken.facultyId !== facultyId) {
        throw AppError.forbidden('Location token mismatch.', 'INVALID_LOCATION_TOKEN');
      }

      const lat = parsedLocationToken.latitude;
      const lon = parsedLocationToken.longitude;
      const accuracy = parsedLocationToken.accuracy;
      const calculatedDistance = parsedLocationToken.distanceFromZone;
      const zoneName = parsedLocationToken.zoneName || 'Main Campus';

      // 6. Strictly enforce verified Biometric Face Token from Redis
      if (!input.faceToken) {
        throw AppError.badRequest(
          'Face verification token is required to mark attendance.',
          'FACE_TOKEN_REQUIRED'
        );
      }

      const faceTokenRaw = await redis.get(`attendance:facetoken:${input.faceToken}`);
      if (!faceTokenRaw) {
        throw AppError.badRequest(
          'Face verification token expired. Please perform face verification again.',
          'FACE_TOKEN_EXPIRED'
        );
      }
      const parsedFaceToken = JSON.parse(faceTokenRaw);
      if (parsedFaceToken.facultyId !== facultyId) {
        throw AppError.forbidden('Face token mismatch.', 'INVALID_FACE_TOKEN');
      }
      if (!parsedFaceToken.faceVerified || !parsedFaceToken.identityMatched || !parsedFaceToken.livenessVerified) {
        throw AppError.badRequest(
          'Both biometric face identity AND genuine liveness verification must pass to mark attendance.',
          'LIVENESS_OR_FACE_NOT_VERIFIED'
        );
      }

      const faceConfidence = parsedFaceToken.faceConfidence;
      const livenessScore = parsedFaceToken.livenessScore;

      // 7. Secure Mandatory Verification Evidence Storage & Retention (Phase 8.7)
      // Verification evidence is MANDATORY for a successful attendance.
      // If Location = PASS, Liveness = PASS, Identity = PASS, but Evidence persistence = FAIL,
      // attendance MUST NOT be marked VERIFIED. Fail safely and return retryable error.
      if (!parsedFaceToken.snapshotBase64 || typeof parsedFaceToken.snapshotBase64 !== 'string') {
        logger.error(
          { facultyId },
          'Mandatory verification evidence missing: snapshotBase64 not found in verified face token'
        );
        throw AppError.internal(
          'Attendance could not be completed because verification evidence could not be securely saved. Please retry.',
          'EVIDENCE_PERSISTENCE_FAILED'
        );
      }

      let imageBuffer: Buffer;
      try {
        const cleanB64 = parsedFaceToken.snapshotBase64.replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '');
        imageBuffer = Buffer.from(cleanB64, 'base64');
      } catch (decodeErr) {
        logger.error({ decodeErr, facultyId }, 'Failed to decode verification snapshot for evidence persistence');
        throw AppError.internal(
          'Attendance could not be completed because verification evidence could not be securely saved. Please retry.',
          'EVIDENCE_PERSISTENCE_FAILED'
        );
      }

      if (imageBuffer.length === 0) {
        logger.error({ facultyId }, 'Decoded verification snapshot buffer is empty');
        throw AppError.internal(
          'Attendance could not be completed because verification evidence could not be securely saved. Please retry.',
          'EVIDENCE_PERSISTENCE_FAILED'
        );
      }

      let storedEvidence;
      try {
        storedEvidence = await evidenceStorageService.saveEvidence(imageBuffer, 'image/jpeg');
      } catch (storageErr) {
        logger.error({ storageErr, facultyId }, 'Failed to persist biometric verification evidence to private storage');
        throw AppError.internal(
          'Attendance could not be completed because verification evidence could not be securely saved. Please retry.',
          'EVIDENCE_PERSISTENCE_FAILED'
        );
      }

      // Step 6: Confirm evidence persistence succeeded on disk
      const fileExists = await evidenceStorageService.evidenceExists(storedEvidence.reference);
      if (!fileExists) {
        logger.error(
          { reference: storedEvidence.reference, facultyId },
          'Verification evidence file was not verified on disk after save'
        );
        await evidenceStorageService.deleteEvidence(storedEvidence.reference).catch(() => {});
        throw AppError.internal(
          'Attendance could not be completed because verification evidence could not be securely saved. Please retry.',
          'EVIDENCE_PERSISTENCE_FAILED'
        );
      }

      const retentionDays = env.ATTENDANCE_EVIDENCE_RETENTION_DAYS || 90;
      const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
      const verificationEvidence = {
        reference: storedEvidence.reference,
        capturedAt: now,
        contentType: storedEvidence.contentType,
        size: storedEvidence.size,
        retentionUntil,
      };

      // Step 7: Persist record to MongoDB with database constraints & atomic rollback cleanup
      let newAttendance;
      try {
        newAttendance = await attendanceRepository.create({
          facultyId: user._id,
          date: serverDate,
          timestamp: now,
          latitude: lat,
          longitude: lon,
          distanceFromZone: calculatedDistance,
          locationVerified: true,
          faceVerified: true,
          livenessVerified: true,
          status: 'VERIFIED',
          originalStatus: 'VERIFIED',
          verificationEvidence,
          verificationMetadata: {
            faceConfidence,
            livenessScore,
            accuracyMeters: accuracy,
            zoneName,
            ipAddress: meta?.ip,
            userAgent: meta?.userAgent,
            challengeToken: input.challengeToken,
          },
        });
      } catch (dbErr) {
        // Rollback: Clean up newly created evidence file so no orphan evidence file remains
        logger.warn(
          { dbErr, reference: storedEvidence.reference, facultyId },
          'MongoDB attendance creation failed after evidence write; executing rollback cleanup of evidence file'
        );
        await evidenceStorageService.deleteEvidence(storedEvidence.reference).catch((delErr) => {
          logger.error({ delErr, reference: storedEvidence.reference }, 'Failed to clean up orphan evidence during rollback');
        });
        throw dbErr;
      }

      // 8. Cache response for idempotency (24 hours TTL)
      const attendanceResponse = newAttendance.toJSON();
      if (input.idempotencyKey) {
        const idempotencyKey = `attendance:idempotency:${facultyId}:${input.idempotencyKey}`;
        await redis.set(idempotencyKey, JSON.stringify(attendanceResponse), 'EX', 86400);
      }

      // 9. Create Audit Log
      await auditService.logAction(facultyId, 'ATTENDANCE_MARKED', meta?.requestId, {
        date: serverDate,
        distanceFromZone: calculatedDistance,
        status: 'VERIFIED',
        attendanceId: newAttendance._id.toString(),
      });

      // 10. Single-Use Consumption: Clean up tokens to prevent replay attacks
      await redis.del(`attendance:loctoken:${input.locationToken}`);
      await redis.del(`attendance:facetoken:${input.faceToken}`);

      return attendanceResponse;
    } finally {
      // Safe Redlock-style release: Only delete lock if we still own it
      try {
        const currentLock = await redis.get(lockKey);
        if (currentLock === lockToken) {
          await redis.del(lockKey);
        }
      } catch (err) {
        logger.error({ err }, 'Error releasing concurrency lock');
      }
    }
  }

  /**
   * Returns today's attendance record for the logged-in faculty
   */
  async getTodayAttendance(facultyId: string) {
    const today = new Date().toISOString().split('T')[0];
    const record = await attendanceRepository.findByFacultyAndDate(facultyId, today);
    return record ? record.toJSON() : null;
  }

  /**
   * Returns attendance history for the logged-in faculty
   */
  async getAttendanceHistory(facultyId: string, limit = 30) {
    const records = await attendanceRepository.findByFacultyId(facultyId, limit);
    return records.map((r) => r.toJSON());
  }
}

export const attendanceService = new AttendanceService();
