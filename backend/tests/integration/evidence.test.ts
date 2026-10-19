import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { AttendanceModel } from '../../src/models/Attendance';
import { AuditLogModel } from '../../src/models/AuditLog';
import { evidenceStorageService } from '../../src/services/evidenceStorage.service';
import { generateAccessToken } from '../../src/utils/crypto';
import { JwtPayload } from '../../src/types';
import { env } from '../../src/config/env';
import { redis } from '../../src/config/redis';

describe('Secure Attendance Verification Evidence Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let facultyId: string;
  let facultyToken: string;
  let otherFacultyToken: string;

  let attendanceWithEvidenceId: string;
  let attendanceExpiredEvidenceId: string;
  let attendanceNoEvidenceId: string;
  let evidenceReference: string;
  let expiredEvidenceReference: string;

  const testImageBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  const uniqueSuffix = Date.now().toString().slice(-5);

  beforeAll(async () => {
    await connectDB();

    // 1. Create test admin
    const adminDoc = await UserModel.create({
      name: 'Evidence Officer Admin',
      email: `admin.evidence.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash',
      employeeId: `ADM-EVI-${uniqueSuffix}`,
      role: 'ADMIN',
      department: 'Security & Compliance',
      isActive: true,
    });
    adminId = adminDoc._id.toString();
    adminToken = generateAccessToken({
      userId: adminId,
      email: adminDoc.email,
      role: 'ADMIN',
      employeeId: adminDoc.employeeId,
      name: adminDoc.name,
    });

    // 2. Create primary test faculty
    const facultyDoc = await UserModel.create({
      name: `Dr. Evidence Faculty ${uniqueSuffix}`,
      email: `faculty.evidence.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash',
      employeeId: `FAC-EVI-${uniqueSuffix}`,
      role: 'FACULTY',
      department: 'Computer Science',
      isActive: true,
    });
    facultyId = facultyDoc._id.toString();
    facultyToken = generateAccessToken({
      userId: facultyId,
      email: facultyDoc.email,
      role: 'FACULTY',
      employeeId: facultyDoc.employeeId,
      name: facultyDoc.name,
    });

    // 3. Create secondary test faculty
    const otherFacultyDoc = await UserModel.create({
      name: `Dr. Other Faculty ${uniqueSuffix}`,
      email: `faculty.other.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash',
      employeeId: `FAC-OTH-${uniqueSuffix}`,
      role: 'FACULTY',
      department: 'Biotechnology',
      isActive: true,
    });
    otherFacultyToken = generateAccessToken({
      userId: otherFacultyDoc._id.toString(),
      email: otherFacultyDoc.email,
      role: 'FACULTY',
      employeeId: otherFacultyDoc.employeeId,
      name: otherFacultyDoc.name,
    });

    // 4. Save test evidence to private storage
    const storedEvidence = await evidenceStorageService.saveEvidence(testImageBuffer, 'image/jpeg');
    evidenceReference = storedEvidence.reference;

    const storedExpired = await evidenceStorageService.saveEvidence(testImageBuffer, 'image/jpeg');
    expiredEvidenceReference = storedExpired.reference;

    // 5. Create Attendance record with valid active evidence
    const retentionDays = env.ATTENDANCE_EVIDENCE_RETENTION_DAYS || 90;
    const now = new Date();
    const activeRetentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const attValidDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: `2026-10-${(10 + Math.floor(Math.random() * 15)).toString().padStart(2, '0')}`,
      timestamp: now,
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 15.2,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'VERIFIED',
      originalStatus: 'VERIFIED',
      verificationEvidence: {
        reference: evidenceReference,
        capturedAt: now,
        contentType: 'image/jpeg',
        size: testImageBuffer.length,
        retentionUntil: activeRetentionUntil,
      },
      verificationMetadata: {
        faceConfidence: 0.94,
        livenessScore: 0.98,
        accuracyMeters: 10,
        zoneName: 'LPU Main Campus',
      },
    });
    attendanceWithEvidenceId = attValidDoc._id.toString();

    // 6. Create Attendance record with expired evidence (retentionUntil in the past)
    const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const attExpiredDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: `2026-09-${(10 + Math.floor(Math.random() * 15)).toString().padStart(2, '0')}`,
      timestamp: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 20.0,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'VERIFIED',
      originalStatus: 'VERIFIED',
      verificationEvidence: {
        reference: expiredEvidenceReference,
        capturedAt: new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000),
        contentType: 'image/jpeg',
        size: testImageBuffer.length,
        retentionUntil: expiredDate,
      },
      verificationMetadata: {
        faceConfidence: 0.91,
        livenessScore: 0.96,
        accuracyMeters: 12,
      },
    });
    attendanceExpiredEvidenceId = attExpiredDoc._id.toString();

    // 7. Create Attendance record without evidence
    const attNoEvidenceDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: `2026-08-${(10 + Math.floor(Math.random() * 15)).toString().padStart(2, '0')}`,
      timestamp: now,
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 18.0,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'VERIFIED',
      originalStatus: 'VERIFIED',
      verificationMetadata: {},
    });
    attendanceNoEvidenceId = attNoEvidenceDoc._id.toString();
  });

  afterAll(async () => {
    // Clean up test documents and files
    await UserModel.deleteMany({ email: { $regex: uniqueSuffix } });
    await AttendanceModel.deleteMany({
      _id: { $in: [attendanceWithEvidenceId, attendanceExpiredEvidenceId, attendanceNoEvidenceId] },
    });
    await AuditLogModel.deleteMany({ 'metadata.attendanceId': { $in: [attendanceWithEvidenceId, attendanceExpiredEvidenceId] } });

    await evidenceStorageService.deleteEvidence(evidenceReference);
    await evidenceStorageService.deleteEvidence(expiredEvidenceReference);

    await disconnectDB();
  });

  it('1. should reject unauthenticated request to evidence endpoint with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get(`/api/v1/admin/attendance/${attendanceWithEvidenceId}/evidence`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('2. should reject faculty role attempting to access evidence with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceWithEvidenceId}/evidence`)
      .set('Cookie', [`access_token=${facultyToken}`]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. should reject other faculty attempting to access another record evidence with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceWithEvidenceId}/evidence`)
      .set('Cookie', [`access_token=${otherFacultyToken}`]);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('4. should reject invalid attendance ID format with 400 INVALID_ATTENDANCE_ID', async () => {
    const res = await request(app)
      .get('/api/v1/admin/attendance/not-a-valid-id/evidence')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ATTENDANCE_ID');
  });

  it('5. should return 404 for non-existent attendance record', async () => {
    const randomId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${randomId}/evidence`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ATTENDANCE_NOT_FOUND');
  });

  it('6. should return 404 EVIDENCE_NOT_FOUND when record has no verification evidence', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceNoEvidenceId}/evidence`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVIDENCE_NOT_FOUND');
  });

  it('7. should allow ADMIN to retrieve verified evidence with 200 OK and JPEG binary stream', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceWithEvidenceId}/evidence`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['content-disposition']).toContain('verification-snapshot.jpg');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBe(testImageBuffer.length);

    // Verify audit log entry was created for the evidence access event
    const audit = await AuditLogModel.findOne({
      action: 'EVIDENCE_ACCESSED',
      'metadata.attendanceId': attendanceWithEvidenceId,
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId.toString()).toBe(adminId);
  });

  it('8. should reject expired evidence with 410 EVIDENCE_EXPIRED', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceExpiredEvidenceId}/evidence`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVIDENCE_EXPIRED');
    expect(res.body.error.message).toContain('expired');
  });

  it('9. should not expose base64 or raw evidence files in normal attendance API responses', async () => {
    // Admin attendance list
    const adminListRes = await request(app)
      .get('/api/v1/admin/attendance')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(adminListRes.status).toBe(200);
    const records = adminListRes.body.data.records;
    const targetRec = records.find((r: any) => r.id === attendanceWithEvidenceId);
    expect(targetRec).toBeDefined();
    // Does NOT contain base64 image data
    expect(JSON.stringify(targetRec)).not.toContain('data:image');
    expect(targetRec.verificationEvidence).toBeDefined();
    expect(targetRec.verificationEvidence.reference).toBeDefined();
    expect(targetRec.verificationEvidence.size).toBe(testImageBuffer.length);
  });

  it('10. should safely clean up expired evidence while retaining attendance record and audit trail', async () => {
    // File exists prior to cleanup
    const existsBefore = await evidenceStorageService.evidenceExists(expiredEvidenceReference);
    expect(existsBefore).toBe(true);

    const cleanupRes = await request(app)
      .post('/api/v1/admin/evidence/cleanup')
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.success).toBe(true);
    expect(cleanupRes.body.data.purgedCount).toBeGreaterThanOrEqual(1);

    // File was purged from disk
    const existsAfter = await evidenceStorageService.evidenceExists(expiredEvidenceReference);
    expect(existsAfter).toBe(false);

    // Attendance record remains intact in MongoDB!
    const attendanceDocAfter = await AttendanceModel.findById(attendanceExpiredEvidenceId);
    expect(attendanceDocAfter).not.toBeNull();
    expect(attendanceDocAfter!.status).toBe('VERIFIED');
    expect(attendanceDocAfter!.verificationEvidence!.reference).toBe(''); // Reference cleared

    // Audit log was recorded
    const purgeAudit = await AuditLogModel.findOne({
      action: 'EVIDENCE_PURGED',
      userId: adminId,
    });
    expect(purgeAudit).not.toBeNull();
  });

  it('11. should mark attendance as VERIFIED with verificationEvidence when location, identity, liveness, and evidence persistence succeed', async () => {
    const testDate = `2026-11-${(10 + Math.floor(Math.random() * 15)).toString().padStart(2, '0')}`;
    const locToken = `loc_test_${Date.now()}`;
    const faceToken = `face_test_${Date.now()}`;

    // Seed location token
    await redis.set(
      `attendance:loctoken:${locToken}`,
      JSON.stringify({
        facultyId,
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        distanceFromZone: 20,
      }),
      'EX',
      120
    );

    // Seed face token with best validated frame snapshot
    await redis.set(
      `attendance:facetoken:${faceToken}`,
      JSON.stringify({
        facultyId,
        faceVerified: true,
        identityMatched: true,
        livenessVerified: true,
        similarity: 0.96,
        distance: 0.25,
        snapshotBase64: `data:image/jpeg;base64,${testImageBuffer.toString('base64')}`,
        verifiedAt: Date.now(),
      }),
      'EX',
      120
    );

    const markRes = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Cookie', [`access_token=${facultyToken}`])
      .send({
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        locationToken: locToken,
        faceToken: faceToken,
      });

    expect(markRes.status).toBe(201);
    expect(markRes.body.success).toBe(true);
    const newRecord = markRes.body.data;
    expect(newRecord.status).toBe('VERIFIED');
    expect(newRecord.verificationEvidence).toBeDefined();
    expect(newRecord.verificationEvidence.reference).toMatch(/^ev_/);
    expect(newRecord.verificationEvidence.size).toBe(testImageBuffer.length);

    // Verify evidence file exists on disk in private storage
    const exists = await evidenceStorageService.evidenceExists(newRecord.verificationEvidence.reference);
    expect(exists).toBe(true);

    // Cleanup new evidence file and document
    await evidenceStorageService.deleteEvidence(newRecord.verificationEvidence.reference);
    await AttendanceModel.deleteOne({ _id: newRecord.id });
  });

  it('12. should reject attendance and NOT mark VERIFIED when verification evidence is missing from face token', async () => {
    const locToken = `loc_fail_${Date.now()}`;
    const faceToken = `face_fail_${Date.now()}`;

    await redis.set(
      `attendance:loctoken:${locToken}`,
      JSON.stringify({
        facultyId,
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        distanceFromZone: 20,
      }),
      'EX',
      120
    );

    // Face token without snapshotBase64
    await redis.set(
      `attendance:facetoken:${faceToken}`,
      JSON.stringify({
        facultyId,
        faceVerified: true,
        identityMatched: true,
        livenessVerified: true,
      }),
      'EX',
      120
    );

    const markRes = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Cookie', [`access_token=${facultyToken}`])
      .send({
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        locationToken: locToken,
        faceToken: faceToken,
      });

    expect(markRes.status).toBe(500);
    expect(markRes.body.success).toBe(false);
    expect(markRes.body.error.code).toBe('EVIDENCE_PERSISTENCE_FAILED');
    expect(markRes.body.error.message).toContain('verification evidence could not be securely saved. Please retry.');

    // Ensure no attendance record was created in MongoDB
    const today = new Date().toISOString().split('T')[0];
    const createdRec = await AttendanceModel.findOne({ facultyId, date: today });
    expect(createdRec).toBeNull();
  });

  it('13. should return retryable EVIDENCE_PERSISTENCE_FAILED error without leaking internal paths or database details', async () => {
    const locToken = `loc_leak_${Date.now()}`;
    const faceToken = `face_leak_${Date.now()}`;

    await redis.set(
      `attendance:loctoken:${locToken}`,
      JSON.stringify({
        facultyId,
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        distanceFromZone: 20,
      }),
      'EX',
      120
    );

    // Empty snapshotBase64
    await redis.set(
      `attendance:facetoken:${faceToken}`,
      JSON.stringify({
        facultyId,
        faceVerified: true,
        identityMatched: true,
        livenessVerified: true,
        snapshotBase64: '',
      }),
      'EX',
      120
    );

    const res = await request(app)
      .post('/api/v1/attendance/mark')
      .set('Cookie', [`access_token=${facultyToken}`])
      .send({
        latitude: 31.2536,
        longitude: 75.7037,
        accuracy: 10,
        locationToken: locToken,
        faceToken: faceToken,
      });

    expect(res.status).toBe(500);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('storage/evidence');
    expect(bodyStr).not.toContain('C:\\');
    expect(bodyStr).not.toContain('mongo');
    expect(bodyStr).not.toContain('redis');
    expect(res.body.error.message).toBe('Attendance could not be completed because verification evidence could not be securely saved. Please retry.');
  });

  it('14. should not leak raw base64 or biometric embeddings in detail API response', async () => {
    const detailRes = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceWithEvidenceId}/detail`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(detailRes.status).toBe(200);
    const detail = detailRes.body.data.detail;
    expect(detail.verificationEvidence).toBeDefined();
    expect(detail.verificationEvidence.hasEvidence).toBe(true);
    // Does NOT contain raw base64 image data or embeddings
    expect(JSON.stringify(detail)).not.toContain('data:image');
    expect(JSON.stringify(detail)).not.toContain('faceEmbeddingReference');
  });

  it('15. should safely handle historical records where verificationEvidence is absent or reference is empty', async () => {
    const detailRes = await request(app)
      .get(`/api/v1/admin/attendance/${attendanceNoEvidenceId}/detail`)
      .set('Cookie', [`access_token=${adminToken}`]);

    expect(detailRes.status).toBe(200);
    const detail = detailRes.body.data.detail;
    expect(detail.verificationEvidence).toBeDefined();
    expect(detail.verificationEvidence.hasEvidence).toBe(false);
    expect(detail.verificationEvidence.reference).toBeNull();
  });
});
