import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { AttendanceModel } from '../../src/models/Attendance';
import { AuditLogModel } from '../../src/models/AuditLog';
import { generateAccessToken } from '../../src/utils/crypto';

describe('Admin Attendance Detail View & Needs Review Queue Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let facultyId: string;
  let facultyToken: string;
  let flaggedRecordId: string;
  let rejectedRecordId: string;
  let verifiedRecordId: string;
  const uniqueSuffix = Date.now().toString().slice(-5);

  beforeAll(async () => {
    await connectDB();

    // 1. Create Admin
    const admin = await UserModel.create({
      name: 'Investigation Admin',
      email: `admin.review.${uniqueSuffix}@lpu.in`,
      employeeId: `ADM_REV_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'ADMIN',
      department: 'Compliance',
      isActive: true,
    });
    adminId = admin._id.toString();
    adminToken = generateAccessToken({
      userId: adminId,
      email: admin.email,
      role: 'ADMIN',
      employeeId: admin.employeeId,
      name: admin.name,
    });

    // 2. Create Faculty
    const faculty = await UserModel.create({
      name: 'Dr. Suresh Kumar',
      email: `suresh.kumar.${uniqueSuffix}@lpu.in`,
      employeeId: `FAC_REV_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'FACULTY',
      department: 'Mechanical Engineering',
      isActive: true,
    });
    facultyId = faculty._id.toString();
    facultyToken = generateAccessToken({
      userId: facultyId,
      email: faculty.email,
      role: 'FACULTY',
      employeeId: faculty.employeeId,
      name: faculty.name,
    });

    // 3. Create FLAGGED Attendance Record (Review candidate)
    const flaggedDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: '2026-10-14',
      timestamp: new Date('2026-10-14T09:05:00Z'),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 35.0,
      locationVerified: true,
      faceVerified: false,
      livenessVerified: true,
      status: 'FLAGGED',
      originalStatus: 'FLAGGED',
      verificationEvidence: {
        reference: `ev_flagged_${uniqueSuffix}.jpg`,
        capturedAt: new Date('2026-10-14T09:05:00Z'),
        contentType: 'image/jpeg',
        size: 2048,
        retentionUntil: new Date(Date.now() + 90 * 86400000),
      },
      verificationMetadata: {
        faceConfidence: 0.52,
        livenessScore: 0.95,
        accuracyMeters: 8,
        zoneName: 'Lovely Professional University (LPU) - Main Campus',
        ipAddress: '10.20.30.40',
        rejectionReason: 'Biometric confidence score below required threshold',
      },
    });
    flaggedRecordId = flaggedDoc._id.toString();

    // 4. Create REJECTED Attendance Record (Review candidate)
    const rejectedDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: '2026-10-15',
      timestamp: new Date('2026-10-15T09:10:00Z'),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 180.0,
      locationVerified: false,
      faceVerified: true,
      livenessVerified: false,
      status: 'REJECTED',
      originalStatus: 'REJECTED',
      verificationMetadata: {
        faceConfidence: 0.91,
        livenessScore: 0.40,
        accuracyMeters: 25,
        zoneName: 'LPU Main Campus',
        rejectionReason: 'Location coordinates outside authorized zone perimeter',
      },
    });
    rejectedRecordId = rejectedDoc._id.toString();

    // 5. Create Already VERIFIED Record (NOT a review candidate)
    const verifiedDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: '2026-10-16',
      timestamp: new Date('2026-10-16T09:00:00Z'),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 10.0,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'VERIFIED',
      originalStatus: 'VERIFIED',
      verificationMetadata: {
        faceConfidence: 0.98,
        livenessScore: 0.99,
      },
    });
    verifiedRecordId = verifiedDoc._id.toString();

    // Log sample audit event for the flagged record
    await AuditLogModel.create({
      userId: facultyId,
      action: 'ATTENDANCE_FLAGGED',
      timestamp: new Date(),
      metadata: {
        attendanceId: flaggedRecordId,
        reason: 'Biometric gate anomaly',
      },
    });
  });

  afterAll(async () => {
    if (adminId) await UserModel.deleteMany({ _id: { $in: [adminId, facultyId] } });
    if (flaggedRecordId) {
      await AttendanceModel.deleteMany({ _id: { $in: [flaggedRecordId, rejectedRecordId, verifiedRecordId] } });
      await AuditLogModel.deleteMany({ 'metadata.attendanceId': flaggedRecordId });
    }
  });

  describe('1. Comprehensive Attendance Detail Endpoint (/attendance/:id/detail)', () => {
    it('should allow ADMIN to retrieve full attendance detail including all 8 required sections', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/attendance/${flaggedRecordId}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const detail = res.body.data.detail;

      // Section A: Faculty Information
      expect(detail.faculty).toBeDefined();
      expect(detail.faculty.name).toBe('Dr. Suresh Kumar');
      expect(detail.faculty.department).toBe('Mechanical Engineering');
      expect(detail.faculty.email).toContain('@lpu.in');
      expect(detail.faculty.status).toBe('ACTIVE');

      // Section B: Attendance Information
      expect(detail.date).toBe('2026-10-14');
      expect(detail.status).toBe('FLAGGED');
      expect(detail.originalStatus).toBe('FLAGGED');

      // Section C: Location Verification
      expect(detail.locationVerification).toBeDefined();
      expect(detail.locationVerification.verified).toBe(true);
      expect(detail.locationVerification.distanceMeters).toBe(35.0);
      expect(detail.locationVerification.accuracyMeters).toBe(8);
      expect(detail.locationVerification.zoneName).toContain('LPU');

      // Section D: Identity Verification
      expect(detail.identityVerification).toBeDefined();
      expect(detail.identityVerification.faceDetected).toBe(true);
      expect(detail.identityVerification.identityMatched).toBe(false);
      expect(detail.identityVerification.confidenceScore).toBe(0.52);

      // Section E: Liveness Verification
      expect(detail.livenessVerification).toBeDefined();
      expect(detail.livenessVerification.livenessPassed).toBe(true);
      expect(detail.livenessVerification.livenessScore).toBe(0.95);
      expect(detail.livenessVerification.validFrameCount).toBe(10);

      // Section F: Verification Evidence
      expect(detail.verificationEvidence).toBeDefined();
      expect(detail.verificationEvidence.hasEvidence).toBe(true);
      expect(detail.verificationEvidence.isExpired).toBe(false);

      // Section G: Administrative History
      expect(detail.manualOverride).toBeNull();

      // Section H: Audit History
      expect(detail.auditHistory).toBeInstanceOf(Array);
      expect(detail.auditHistory.length).toBeGreaterThanOrEqual(1);
      expect(detail.auditHistory[0].action).toBe('ATTENDANCE_FLAGGED');
    });

    it('should reject non-admin faculty attempting to access admin detail endpoint with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/attendance/${flaggedRecordId}/detail`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated requests to detail endpoint with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get(`/api/v1/admin/attendance/${flaggedRecordId}/detail`);
      expect(res.status).toBe(401);
    });

    it('should reject malformed attendance ID format with 400 INVALID_ATTENDANCE_ID', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/invalid-format-id/detail')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ATTENDANCE_ID');
    });

    it('should return 404 ATTENDANCE_NOT_FOUND for non-existent record', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/admin/attendance/${nonExistentId}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ATTENDANCE_NOT_FOUND');
    });
  });

  describe('2. Needs Review Queue Endpoint (/attendance/review-queue)', () => {
    it('should allow ADMIN to retrieve the review queue containing FLAGGED and REJECTED records', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.summary).toBeDefined();

      const recordIds = res.body.data.records.map((r: any) => r.id);
      expect(recordIds).toContain(flaggedRecordId);
      expect(recordIds).toContain(rejectedRecordId);
      // Already VERIFIED records should NOT appear in the review queue
      expect(recordIds).not.toContain(verifiedRecordId);
    });

    it('should reject non-admin faculty attempting to access review queue with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/review-queue')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests to review queue with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/admin/attendance/review-queue');
      expect(res.status).toBe(401);
    });

    it('should derive review reason from actual stored verification data without fabrication', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const flaggedItem = res.body.data.records.find((r: any) => r.id === flaggedRecordId);
      expect(flaggedItem).toBeDefined();
      expect(flaggedItem.reviewReason).toContain('Biometric confidence');

      const rejectedItem = res.body.data.records.find((r: any) => r.id === rejectedRecordId);
      expect(rejectedItem).toBeDefined();
      expect(rejectedItem.reviewReason).toContain('Location coordinates outside');
    });

    it('should filter review queue by status (FLAGGED)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/review-queue?status=FLAGGED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const statuses = res.body.data.records.map((r: any) => r.currentStatus);
      expect(statuses.every((s: string) => s === 'FLAGGED')).toBe(true);
      expect(res.body.data.records.some((r: any) => r.id === flaggedRecordId)).toBe(true);
      expect(res.body.data.records.some((r: any) => r.id === rejectedRecordId)).toBe(false);
    });

    it('should filter review queue by search term (Faculty Name / Employee ID)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/attendance/review-queue?search=Suresh`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.records[0].faculty.name).toContain('Suresh');
    });

    it('should enforce safe pagination limits and cap page size at 50', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/review-queue?limit=9999&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Safe maximum limit is capped at 50
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('should remove record from review queue once admin executes an override decision', async () => {
      // 1. Verify flaggedRecordId is currently in the review queue
      const initialQueue = await request(app)
        .get('/api/v1/admin/attendance/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);
      const initialIds = initialQueue.body.data.records.map((r: any) => r.id);
      expect(initialIds).toContain(flaggedRecordId);

      // 2. Admin overrides flagged record to VERIFIED
      const overrideRes = await request(app)
        .post(`/api/v1/admin/attendance/${flaggedRecordId}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          reason: 'Biometric anomaly investigated and verified by Dean.',
          expectedPreviousStatus: 'FLAGGED',
        });
      expect(overrideRes.status).toBe(200);
      expect(overrideRes.body.data.record.status).toBe('VERIFIED');

      // 3. Verify flaggedRecordId has now LEFT the active review queue
      const updatedQueue = await request(app)
        .get('/api/v1/admin/attendance/review-queue')
        .set('Authorization', `Bearer ${adminToken}`);
      const updatedIds = updatedQueue.body.data.records.map((r: any) => r.id);
      expect(updatedIds).not.toContain(flaggedRecordId);

      // 4. Record remains accessible in regular attendance records endpoint
      const detailRes = await request(app)
        .get(`/api/v1/admin/attendance/${flaggedRecordId}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.detail.status).toBe('VERIFIED');
      expect(detailRes.body.data.detail.manualOverride).not.toBeNull();
      expect(detailRes.body.data.detail.manualOverride.newStatus).toBe('VERIFIED');
    });
  });
});
