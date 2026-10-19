import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AttendanceService } from '../../src/services/attendance.service';
import { attendanceRepository } from '../../src/repositories/attendance.repository';
import { attendanceZoneRepository } from '../../src/repositories/attendanceZone.repository';
import { userRepository } from '../../src/repositories/user.repository';
import { auditService } from '../../src/services/audit.service';
import { AppError } from '../../src/utils/apiError';
import { redis } from '../../src/config/redis';
import { evidenceStorageService } from '../../src/services/evidenceStorage.service';

describe('AttendanceService Unit Tests', () => {
  let attendanceService: AttendanceService;

  beforeEach(() => {
    attendanceService = new AttendanceService();
    jest.clearAllMocks();
    jest.spyOn(auditService, 'logAction').mockResolvedValue({} as any);
  });

  describe('verifyLocation', () => {
    it('should throw LOCATION_OUTSIDE_ZONE when faculty is beyond the geofence radius', async () => {
      // Zone center: New Delhi
      jest.spyOn(attendanceZoneRepository, 'getActiveZone').mockResolvedValue({
        _id: 'zone-1' as any,
        name: 'Main Campus Geofence',
        latitude: 28.613939,
        longitude: 77.209021,
        radiusMeters: 150,
        maxAllowedAccuracyMeters: 35,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Coordinates 5km away
      await expect(
        attendanceService.verifyLocation('faculty-123', {
          latitude: 28.650000,
          longitude: 77.250000,
          accuracy: 10,
        })
      ).rejects.toThrow(AppError);

      try {
        await attendanceService.verifyLocation('faculty-123', {
          latitude: 28.650000,
          longitude: 77.250000,
          accuracy: 10,
        });
      } catch (err: any) {
        expect(err.code).toBe('LOCATION_OUTSIDE_ZONE');
        expect(err.message).toBe('You are outside the attendance zone.');
      }
    });

    it('should throw GPS_ACCURACY_TOO_LOW when GPS accuracy is worse than threshold', async () => {
      jest.spyOn(attendanceZoneRepository, 'getActiveZone').mockResolvedValue({
        _id: 'zone-1' as any,
        name: 'Main Campus Geofence',
        latitude: 28.613939,
        longitude: 77.209021,
        radiusMeters: 150,
        maxAllowedAccuracyMeters: 35,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      try {
        await attendanceService.verifyLocation('faculty-123', {
          latitude: 28.613940,
          longitude: 77.209022,
          accuracy: 65, // Accuracy 65m > 35m allowed
        });
        expect(true).toBe(false); // Should have thrown GPS_ACCURACY_TOO_LOW
      } catch (err: any) {
        expect(err.code).toBe('GPS_ACCURACY_TOO_LOW');
      }
    });

    it('should successfully verify location within zone and generate short-lived token', async () => {
      jest.spyOn(attendanceZoneRepository, 'getActiveZone').mockResolvedValue({
        _id: 'zone-1' as any,
        name: 'Main Campus Geofence',
        latitude: 28.613939,
        longitude: 77.209021,
        radiusMeters: 150,
        maxAllowedAccuracyMeters: 35,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Coordinates right inside the zone (10 meters away)
      const result = await attendanceService.verifyLocation('faculty-123', {
        latitude: 28.614000,
        longitude: 77.209021,
        accuracy: 12,
      });

      expect(result.locationVerified).toBe(true);
      expect(result.distanceFromZone).toBeLessThan(150);
      expect(result.locationToken).toMatch(/^loc_/);

      // Verify token was stored in Redis
      const stored = await redis.get(`attendance:loctoken:${result.locationToken}`);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.facultyId).toBe('faculty-123');
    });
  });

  describe('verifyFace', () => {
    it('should throw FACE_NOT_REGISTERED if faculty has not enrolled biometrics', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: 'faculty-123' as any,
        faceEmbeddingReference: null,
      } as any);

      await expect(
        attendanceService.verifyFace('faculty-123', {
          image: 'data:image/jpeg;base64,sampleimagepayload123456789',
        })
      ).rejects.toThrow(AppError);

      try {
        await attendanceService.verifyFace('faculty-123', {
          image: 'data:image/jpeg;base64,sampleimagepayload123456789',
        });
      } catch (err: any) {
        expect(err.code).toBe('FACE_NOT_REGISTERED');
      }
    });
  });

  describe('markAttendance duplicate prevention & idempotency', () => {
    it('should throw DUPLICATE_ATTENDANCE when attendance was already recorded today', async () => {
      const today = new Date().toISOString().split('T')[0];

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: 'faculty-123' as any,
        isActive: true,
      } as any);

      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue({
        _id: 'att-1' as any,
        facultyId: 'faculty-123' as any,
        date: today,
        status: 'VERIFIED',
      } as any);

      try {
        await attendanceService.markAttendance('faculty-123', {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'loc_token_123',
          faceToken: 'face_token_123',
        });
        expect(true).toBe(false); // Should have thrown DUPLICATE_ATTENDANCE
      } catch (err: any) {
        expect(err.code).toBe('DUPLICATE_ATTENDANCE');
        expect(err.message).toContain('Attendance has already been marked for today');
      }
    });

    it('should return cached attendance on replay of identical idempotencyKey', async () => {
      const idempotencyKey = 'unique-key-xyz-789';
      const facultyId = '60d0fe4f5311236168a109ca';
      const cachedRecord = {
        id: 'att-cached',
        facultyId,
        date: '2026-10-06',
        status: 'VERIFIED',
      };

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);

      await redis.set(
        `attendance:idempotency:${facultyId}:${idempotencyKey}`,
        JSON.stringify(cachedRecord)
      );

      const result = await attendanceService.markAttendance(facultyId, {
        latitude: 28.613939,
        longitude: 77.209021,
        accuracy: 10,
        locationToken: 'loc_token_123',
        faceToken: 'face_token_123',
        idempotencyKey,
      });

      expect(result).toEqual(cachedRecord);
    });

    it('should throw LOCATION_TOKEN_EXPIRED when locationToken is expired or invalid', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: 'faculty-123' as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);

      try {
        await attendanceService.markAttendance('faculty-123', {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'expired_loc_token',
          faceToken: 'face_token_123',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe('LOCATION_TOKEN_EXPIRED');
      }
    });

    it('should throw FACE_TOKEN_EXPIRED when faceToken is expired or invalid', async () => {
      const facultyId = 'faculty-123';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);

      // Store valid location token in Redis
      await redis.set(
        'attendance:loctoken:valid_loc_token',
        JSON.stringify({
          facultyId,
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          distanceFromZone: 20,
        })
      );

      try {
        await attendanceService.markAttendance(facultyId, {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'valid_loc_token',
          faceToken: 'expired_face_token',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe('FACE_TOKEN_EXPIRED');
      }
    });

    it('should successfully mark attendance and consume single-use tokens', async () => {
      const facultyId = 'faculty-123';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);
      jest.spyOn(evidenceStorageService, 'saveEvidence').mockResolvedValue({
        reference: 'ev_unit_test_123.jpg',
        size: 256,
        contentType: 'image/jpeg',
      });
      jest.spyOn(evidenceStorageService, 'evidenceExists').mockResolvedValue(true);

      jest.spyOn(attendanceRepository, 'create').mockResolvedValue({
        _id: 'att-created-1' as any,
        facultyId,
        date: new Date().toISOString().split('T')[0],
        toJSON: () => ({ id: 'att-created-1', status: 'VERIFIED' }),
      } as any);

      await redis.set(
        'attendance:loctoken:consume_loc',
        JSON.stringify({
          facultyId,
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          distanceFromZone: 20,
        })
      );
      await redis.set(
        'attendance:facetoken:consume_face',
        JSON.stringify({
          facultyId,
          faceVerified: true,
          identityMatched: true,
          livenessVerified: true,
          faceConfidence: 0.98,
          livenessScore: 0.99,
          snapshotBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        })
      );

      const result = await attendanceService.markAttendance(facultyId, {
        latitude: 28.613939,
        longitude: 77.209021,
        accuracy: 10,
        locationToken: 'consume_loc',
        faceToken: 'consume_face',
      });

      expect(result.id).toBe('att-created-1');
      const locRemaining = await redis.get('attendance:loctoken:consume_loc');
      const faceRemaining = await redis.get('attendance:facetoken:consume_face');
      expect(locRemaining).toBeNull();
      expect(faceRemaining).toBeNull();
    });

    it('should throw EVIDENCE_PERSISTENCE_FAILED when faceToken lacks snapshotBase64 and NOT mark attendance', async () => {
      const facultyId = 'faculty-no-evidence';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);
      const createSpy = jest.spyOn(attendanceRepository, 'create');

      await redis.set(
        'attendance:loctoken:no_evi_loc',
        JSON.stringify({
          facultyId,
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          distanceFromZone: 20,
        })
      );
      // Missing snapshotBase64
      await redis.set(
        'attendance:facetoken:no_evi_face',
        JSON.stringify({
          facultyId,
          faceVerified: true,
          identityMatched: true,
          livenessVerified: true,
        })
      );

      try {
        await attendanceService.markAttendance(facultyId, {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'no_evi_loc',
          faceToken: 'no_evi_face',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (err: any) {
        expect(err.code).toBe('EVIDENCE_PERSISTENCE_FAILED');
        expect(err.message).toContain('verification evidence could not be securely saved');
      }

      // Verify DB create was NEVER called
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should throw EVIDENCE_PERSISTENCE_FAILED when evidence storage save fails and NOT create attendance', async () => {
      const facultyId = 'faculty-storage-fail';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);
      const createSpy = jest.spyOn(attendanceRepository, 'create');

      jest.spyOn(evidenceStorageService, 'saveEvidence').mockRejectedValue(new Error('Disk write failure'));

      await redis.set(
        'attendance:loctoken:disk_fail_loc',
        JSON.stringify({
          facultyId,
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          distanceFromZone: 20,
        })
      );
      await redis.set(
        'attendance:facetoken:disk_fail_face',
        JSON.stringify({
          facultyId,
          faceVerified: true,
          identityMatched: true,
          livenessVerified: true,
          snapshotBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        })
      );

      try {
        await attendanceService.markAttendance(facultyId, {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'disk_fail_loc',
          faceToken: 'disk_fail_face',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.code).toBe('EVIDENCE_PERSISTENCE_FAILED');
        expect(err.message).toContain('verification evidence could not be securely saved');
      }

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should rollback and delete newly created evidence file if attendanceRepository.create throws an error', async () => {
      const facultyId = 'faculty-rollback';
      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        _id: facultyId as any,
        isActive: true,
      } as any);
      jest.spyOn(attendanceRepository, 'findByFacultyAndDate').mockResolvedValue(null);

      const deleteSpy = jest.spyOn(evidenceStorageService, 'deleteEvidence').mockResolvedValue(true);
      jest.spyOn(evidenceStorageService, 'saveEvidence').mockResolvedValue({
        reference: 'ev_rollback_test.jpg',
        size: 128,
        contentType: 'image/jpeg',
      });
      jest.spyOn(evidenceStorageService, 'evidenceExists').mockResolvedValue(true);

      // Simulate database crash on attendance insert
      jest.spyOn(attendanceRepository, 'create').mockRejectedValue(new Error('MongoDB replica connection lost'));

      await redis.set(
        'attendance:loctoken:rb_loc',
        JSON.stringify({
          facultyId,
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          distanceFromZone: 20,
        })
      );
      await redis.set(
        'attendance:facetoken:rb_face',
        JSON.stringify({
          facultyId,
          faceVerified: true,
          identityMatched: true,
          livenessVerified: true,
          snapshotBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        })
      );

      await expect(
        attendanceService.markAttendance(facultyId, {
          latitude: 28.613939,
          longitude: 77.209021,
          accuracy: 10,
          locationToken: 'rb_loc',
          faceToken: 'rb_face',
        })
      ).rejects.toThrow('MongoDB replica connection lost');

      // Crucial invariant: Newly saved evidence was deleted during rollback
      expect(deleteSpy).toHaveBeenCalledWith('ev_rollback_test.jpg');
    });
  });

  describe('createLivenessChallenge', () => {
    it('should create and store single-use server liveness challenge', async () => {
      const challenge = await attendanceService.createLivenessChallenge('faculty-123');
      expect(challenge.challengeToken).toMatch(/^chal_/);
      expect(challenge.expiresInSeconds).toBe(60);

      const stored = await redis.get(`attendance:challenge:${challenge.challengeToken}`);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.facultyId).toBe('faculty-123');
    });
  });
});
