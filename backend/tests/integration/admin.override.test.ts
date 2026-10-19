import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { AttendanceModel } from '../../src/models/Attendance';
import { AuditLogModel } from '../../src/models/AuditLog';
import { generateAccessToken } from '../../src/utils/crypto';
import { JwtPayload } from '../../src/types';

describe('Admin Attendance Override Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let facultyId: string;
  let facultyToken: string;
  let testAttendanceId: string;
  const uniqueSuffix = Date.now().toString().slice(-5);

  beforeAll(async () => {
    await connectDB();

    // Create test admin
    const adminDoc = await UserModel.create({
      name: 'Super Admin Officer',
      email: `admin.override.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash',
      employeeId: `ADM-${uniqueSuffix}`,
      role: 'ADMIN',
      department: 'Administration',
      isActive: true,
    });
    adminId = adminDoc._id.toString();
    const adminPayload: JwtPayload = {
      userId: adminId,
      email: adminDoc.email,
      role: 'ADMIN',
      employeeId: adminDoc.employeeId,
      name: adminDoc.name,
    };
    adminToken = generateAccessToken(adminPayload);

    // Create test faculty
    const facultyDoc = await UserModel.create({
      name: `Dr. Faculty Test ${uniqueSuffix}`,
      email: `faculty.override.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash',
      employeeId: `FAC-OVER-${uniqueSuffix}`,
      role: 'FACULTY',
      department: 'Computer Science',
      isActive: true,
    });
    facultyId = facultyDoc._id.toString();

    const facultyPayload: JwtPayload = {
      userId: facultyId,
      email: facultyDoc.email,
      role: 'FACULTY',
      employeeId: facultyDoc.employeeId,
      name: facultyDoc.name,
    };
    facultyToken = generateAccessToken(facultyPayload);

    // Create initial automated attendance record
    const attendanceDoc = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: `2026-10-${(10 + Math.floor(Math.random() * 15)).toString().padStart(2, '0')}`,
      timestamp: new Date(),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 25.4,
      locationVerified: true,
      faceVerified: false,
      livenessVerified: false,
      status: 'REJECTED',
      originalStatus: 'REJECTED',
      verificationMetadata: {
        faceConfidence: 0.42,
        livenessScore: 0.5,
        accuracyMeters: 12,
        zoneId: 'geo_lpu_01',
        zoneName: 'LPU Main Campus',
        rejectionReason: 'Biometric confidence below required threshold',
      },
    });
    testAttendanceId = attendanceDoc._id.toString();
  });

  afterAll(async () => {
    // Clean up test data
    if (facultyId) {
      await UserModel.deleteMany({ _id: { $in: [facultyId, adminId] } });
    }
    if (testAttendanceId) {
      await AttendanceModel.deleteMany({ _id: testAttendanceId });
      await AuditLogModel.deleteMany({ 'metadata.attendanceId': testAttendanceId });
    }
    await disconnectDB();
  });

  it('1. should reject unauthenticated override requests with 401', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .send({
        status: 'VERIFIED',
        reason: 'Authorized duty',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('2. should reject faculty role attempting override with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${facultyToken}`])
      .send({
        status: 'VERIFIED',
        reason: 'Authorized duty by self',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. should reject missing or whitespace audit justification with 400 VALIDATION_ERROR', async () => {
    const resEmpty = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'VERIFIED',
        reason: '   ',
      });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.success).toBe(false);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    const resShort = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'VERIFIED',
        reason: 'ok',
      });

    expect(resShort.status).toBe(400);
    expect(resShort.body.success).toBe(false);
    expect(resShort.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('4. should reject arbitrary status values with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'PENDING',
        reason: 'Attempting invalid status transition',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('5. should allow ADMIN to "Verify Present" with valid reason, preserving original result & creating audit log', async () => {
    const justification = 'Dean authorized off-campus duty; verified manually with department head';
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'VERIFIED',
        reason: justification,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record.status).toBe('VERIFIED');
    expect(res.body.data.record.originalStatus).toBe('REJECTED');
    expect(res.body.data.record.manualOverride).toBeDefined();
    expect(res.body.data.record.manualOverride.previousStatus).toBe('REJECTED');
    expect(res.body.data.record.manualOverride.newStatus).toBe('VERIFIED');
    expect(res.body.data.record.manualOverride.reason).toBe(justification);
    expect(res.body.data.record.manualOverride.adminName).toBe('Super Admin Officer');

    // Verify in database directly
    const updatedRecord = await AttendanceModel.findById(testAttendanceId);
    expect(updatedRecord).not.toBeNull();
    expect(updatedRecord!.status).toBe('VERIFIED');
    expect(updatedRecord!.originalStatus).toBe('REJECTED');
    expect(updatedRecord!.locationVerified).toBe(true);
    expect(updatedRecord!.faceVerified).toBe(false); // original biometric telemetry preserved
    expect(updatedRecord!.distanceFromZone).toBe(25.4); // original telemetry preserved
    expect(updatedRecord!.manualOverride!.adminId.toString()).toBe(adminId);
    expect(updatedRecord!.manualOverride!.reason).toBe(justification);

    // Verify AuditLog entry was created
    const auditEntry = await AuditLogModel.findOne({
      action: 'ATTENDANCE_OVERRIDE',
      'metadata.attendanceId': testAttendanceId,
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry!.userId.toString()).toBe(adminId);
    const meta = auditEntry!.metadata as any;
    expect(meta?.newStatus).toBe('VERIFIED');
    expect(meta?.previousStatus).toBe('REJECTED');
    expect(meta?.originalStatus).toBe('REJECTED');
  });

  it('6. should reject duplicate override to the same status with 409 DUPLICATE_OVERRIDE_REJECTED', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'VERIFIED',
        reason: 'Attempting to override again to VERIFIED',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_OVERRIDE_REJECTED');
  });

  it('7. should reject stale override if expectedPreviousStatus does not match with 409 STALE_RECORD_CONFLICT', async () => {
    // Current status is VERIFIED, but client claims expecting REJECTED
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'REJECTED',
        reason: 'Discrepancy detected during physical roll call',
        expectedPreviousStatus: 'REJECTED', // stale: it is already VERIFIED
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STALE_RECORD_CONFLICT');
  });

  it('8. should reject stale override if lastUpdatedAt timestamp does not match with 409 STALE_RECORD_CONFLICT', async () => {
    const staleDate = new Date(Date.now() - 1000000).toISOString();
    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'REJECTED',
        reason: 'Discrepancy detected during physical roll call',
        lastUpdatedAt: staleDate,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STALE_RECORD_CONFLICT');
  });

  it('9. should allow ADMIN to "Reject Attendance" with valid reason and accurate concurrency tokens', async () => {
    const currentDoc = await AttendanceModel.findById(testAttendanceId);
    const rejectionReason = 'Faculty confirmed absent from department floor despite previous override';

    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'REJECTED',
        reason: rejectionReason,
        expectedPreviousStatus: 'VERIFIED',
        lastUpdatedAt: currentDoc!.updatedAt!.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record.status).toBe('REJECTED');
    expect(res.body.data.record.originalStatus).toBe('REJECTED');
    expect(res.body.data.record.manualOverride.previousStatus).toBe('VERIFIED');
    expect(res.body.data.record.manualOverride.newStatus).toBe('REJECTED');
    expect(res.body.data.record.manualOverride.reason).toBe(rejectionReason);

    // Verify DB
    const finalRecord = await AttendanceModel.findById(testAttendanceId);
    expect(finalRecord!.status).toBe('REJECTED');
    expect(finalRecord!.originalStatus).toBe('REJECTED');
    expect(finalRecord!.manualOverride!.previousStatus).toBe('VERIFIED');
    expect(finalRecord!.manualOverride!.newStatus).toBe('REJECTED');
  });

  it('10. should ignore client-supplied admin ID or faculty ID in payload and use authenticated JWT identity', async () => {
    const fakeAdminId = new mongoose.Types.ObjectId().toString();
    const fakeFacultyId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/v1/admin/attendance/${testAttendanceId}/override`)
      .set('Cookie', [`access_token=${adminToken}`])
      .send({
        status: 'VERIFIED',
        reason: 'Re-verifying with spoofed admin ID in body',
        adminId: fakeAdminId, // spoofed
        facultyId: fakeFacultyId, // spoofed
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const record = await AttendanceModel.findById(testAttendanceId);
    expect(record!.manualOverride!.adminId.toString()).toBe(adminId); // MUST be JWT adminId, NOT spoofed
    expect(record!.facultyId.toString()).toBe(facultyId); // MUST not change facultyId
  });
});
