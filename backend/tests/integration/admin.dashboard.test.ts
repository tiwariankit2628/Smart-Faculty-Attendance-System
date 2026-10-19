import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { AttendanceModel } from '../../src/models/Attendance';
import { AuditLogModel } from '../../src/models/AuditLog';
import { generateAccessToken } from '../../src/utils/crypto';

describe('Admin Dashboard, Faculty Management & Audit Center Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let facultyId: string;
  let facultyToken: string;
  let secondFacultyId: string;
  let testRecordId: string;
  const uniqueSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await connectDB();

    // 1. Create Admin
    const admin = await UserModel.create({
      name: 'Super Admin',
      email: `admin.dash.${uniqueSuffix}@lpu.in`,
      employeeId: `ADM_DASH_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'ADMIN',
      department: 'Executive Administration',
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

    // 2. Create Primary Faculty (Enrolled)
    const faculty = await UserModel.create({
      name: 'Prof. Ramesh Sharma',
      email: `ramesh.sharma.${uniqueSuffix}@lpu.in`,
      employeeId: `FAC_DASH_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'FACULTY',
      department: 'Computer Science & Engineering',
      isActive: true,
      faceEmbeddingReference: `emb_ref_${uniqueSuffix}`,
    });
    facultyId = faculty._id.toString();
    facultyToken = generateAccessToken({
      userId: facultyId,
      email: faculty.email,
      role: 'FACULTY',
      employeeId: faculty.employeeId,
      name: faculty.name,
    });

    // 3. Create Second Faculty (Pending Enrollment, Inactive)
    const secondFaculty = await UserModel.create({
      name: 'Dr. Anita Roy',
      email: `anita.roy.${uniqueSuffix}@lpu.in`,
      employeeId: `FAC_ROY_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'FACULTY',
      department: 'Biotechnology',
      isActive: false,
      faceEmbeddingReference: null,
    });
    secondFacultyId = secondFaculty._id.toString();

    // 4. Create Attendance Records for Testing Real Dashboard Aggregation
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const rec1 = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: today,
      timestamp: now,
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 20.0,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'VERIFIED',
      originalStatus: 'VERIFIED',
    });
    testRecordId = rec1._id.toString();

    await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      date: yesterday,
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 150.0,
      locationVerified: false,
      faceVerified: true,
      livenessVerified: true,
      status: 'REJECTED',
      originalStatus: 'REJECTED',
      verificationMetadata: {
        rejectionReason: 'Outside approved campus perimeter',
      },
    });

    await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(secondFacultyId),
      date: today,
      timestamp: now,
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 30.0,
      locationVerified: true,
      faceVerified: false,
      livenessVerified: false,
      status: 'FLAGGED',
      originalStatus: 'FLAGGED',
      verificationMetadata: {
        rejectionReason: 'Liveness test failed',
      },
    });

    // 5. Create Test AuditLog with sensitive keys to test sanitization
    await AuditLogModel.create({
      userId: adminId,
      action: 'ADMIN_TEST_SENSITIVE_ACTION',
      requestId: `req_${uniqueSuffix}`,
      timestamp: new Date(),
      metadata: {
        adminName: 'Super Admin',
        facultyId,
        employeeId: `FAC_DASH_${uniqueSuffix}`,
        secretToken: 'super_secret_redis_key_123',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        rawEmbedding: [0.123, 0.456, 0.789],
        safeField: 'This should remain',
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await UserModel.deleteMany({
      _id: { $in: [adminId, facultyId, secondFacultyId] },
    });
    await AttendanceModel.deleteMany({
      facultyId: { $in: [facultyId, secondFacultyId] },
    });
    await AuditLogModel.deleteMany({
      requestId: `req_${uniqueSuffix}`,
    });
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. ADMIN DASHBOARD TESTS
  // =========================================================================
  describe('Admin Dashboard Statistics & Aggregation', () => {
    it('should allow ADMIN to retrieve dashboard statistics with real backend aggregation', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/stats?range=today')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toHaveProperty('overview');
      expect(data).toHaveProperty('verificationHealth');
      expect(data).toHaveProperty('facultySummary');
      expect(data).toHaveProperty('reviewQueueSummary');
      expect(data).toHaveProperty('trend');
      expect(data).toHaveProperty('recentActivity');

      // Verify real aggregated numbers
      expect(data.overview.totalAttempts).toBeGreaterThanOrEqual(2);
      expect(data.overview.verifiedCount).toBeGreaterThanOrEqual(1);
      expect(data.overview.flaggedCount).toBeGreaterThanOrEqual(1);

      // Verify multi-gate verification health
      expect(data.verificationHealth.identityPassed).toBeGreaterThanOrEqual(1);
      expect(data.verificationHealth.locationPassed).toBeGreaterThanOrEqual(1);

      // Verify faculty summary
      expect(data.facultySummary.totalFaculty).toBeGreaterThanOrEqual(2);
      expect(data.facultySummary.activeFaculty).toBeGreaterThanOrEqual(1);
    });

    it('should support date ranges (yesterday, 7d, 30d, custom)', async () => {
      const res7d = await request(app)
        .get('/api/v1/admin/dashboard/stats?range=7d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res7d.status).toBe(200);
      expect(res7d.body.data.range).toBe('7d');

      const resCustom = await request(app)
        .get(
          `/api/v1/admin/dashboard/stats?range=custom&startDate=2026-01-01&endDate=2026-12-31`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resCustom.status).toBe(200);
      expect(resCustom.body.data.range).toBe('custom');
    });

    it('should reject invalid custom date ranges with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/stats?range=custom&startDate=not-a-date&endDate=invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should block FACULTY users from accessing dashboard stats with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block unauthenticated access with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. FACULTY MANAGEMENT TESTS
  // =========================================================================
  describe('Admin Faculty Directory & Pagination', () => {
    it('should allow ADMIN to retrieve paginated faculty roster with server-side pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculty?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { faculty, pagination } = res.body.data;
      expect(Array.isArray(faculty)).toBe(true);
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 10);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');

      // Verify recent attendance status is attached
      const foundPrimary = faculty.find((f: any) => (f.id || f._id) === facultyId);
      expect(foundPrimary).toBeDefined();
      expect(foundPrimary).toHaveProperty('recentAttendance');
    });

    it('should support search filter by name, employeeId, or email', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/faculty?search=FAC_DASH_${uniqueSuffix}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { faculty } = res.body.data;
      expect(faculty.length).toBe(1);
      expect(faculty[0].employeeId).toBe(`FAC_DASH_${uniqueSuffix}`);
    });

    it('should support department, status, and face enrollment filters', async () => {
      // Department filter
      const resDept = await request(app)
        .get(`/api/v1/admin/faculty?department=Biotechnology`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDept.status).toBe(200);
      const bioFaculty = resDept.body.data.faculty;
      expect(bioFaculty.some((f: any) => (f.id || f._id) === secondFacultyId)).toBe(true);

      // Status filter
      const resInactive = await request(app)
        .get(`/api/v1/admin/faculty?status=INACTIVE`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resInactive.status).toBe(200);
      expect(resInactive.body.data.faculty.some((f: any) => (f.id || f._id) === secondFacultyId)).toBe(true);

      // Biometric enrollment filter
      const resEnrolled = await request(app)
        .get(`/api/v1/admin/faculty?faceEnrolled=true`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resEnrolled.status).toBe(200);
      expect(resEnrolled.body.data.faculty.some((f: any) => (f.id || f._id) === facultyId)).toBe(true);
    });

    it('should block FACULTY users from accessing the faculty management list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculty')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. FACULTY DETAIL & INVESTIGATION VIEW TESTS
  // =========================================================================
  describe('Faculty Detail Investigation View', () => {
    it('should return complete investigation profile, biometric status, and attendance history', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/faculty/${facultyId}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { faculty, attendanceSummary, recentAttendance } = res.body.data;

      // Profile verification
      expect(faculty.id).toBe(facultyId);
      expect(faculty.name).toBe('Prof. Ramesh Sharma');
      expect(faculty.department).toBe('Computer Science & Engineering');

      // Biometric status verification (NEVER leaks raw face vectors)
      expect(faculty.biometricStatus).toHaveProperty('isFaceEnrolled', true);
      expect(faculty.biometricStatus).toHaveProperty('resetCount');
      expect(faculty).not.toHaveProperty('faceEmbedding');
      expect(faculty).not.toHaveProperty('faceVector');

      // Attendance summary verification
      expect(attendanceSummary.totalAttempts).toBeGreaterThanOrEqual(2);
      expect(attendanceSummary.verifiedCount).toBeGreaterThanOrEqual(1);

      // Recent attendance history
      expect(Array.isArray(recentAttendance)).toBe(true);
      expect(recentAttendance.length).toBeGreaterThanOrEqual(2);
      expect(recentAttendance[0]).toHaveProperty('status');
      expect(recentAttendance[0]).toHaveProperty('locationVerified');
      expect(recentAttendance[0]).toHaveProperty('faceVerified');
      expect(recentAttendance[0]).toHaveProperty('livenessVerified');
    });

    it('should return 400 for invalid faculty ID format', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculty/invalid-mongo-id/detail')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FACULTY_ID');
    });

    it('should return 404 for non-existent faculty ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/admin/faculty/${fakeId}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FACULTY_NOT_FOUND');
    });

    it('should block FACULTY users from accessing faculty detail investigation', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/faculty/${facultyId}/detail`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. FACULTY ACCOUNT & BIOMETRIC ACTIONS TESTS
  // =========================================================================
  describe('Faculty Facial Biometric Reset Action', () => {
    it('should allow ADMIN to reset facial biometrics and log mandatory audit entry', async () => {
      const reason = 'Faculty requested re-enrollment due to optical frame replacement';

      const res = await request(app)
        .post(`/api/v1/admin/faculty/${facultyId}/reset-face`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reset).toBe(true);

      // Verify user face descriptor was cleared in DB
      const updatedUser = await UserModel.findById(facultyId);
      expect(updatedUser?.faceEmbeddingReference).toBeNull();

      // Verify audit trail entry was created
      const audit = await AuditLogModel.findOne({
        action: 'ADMIN_RESET_FACULTY_FACE',
        'metadata.facultyId': facultyId,
      });
      expect(audit).toBeDefined();
      expect(audit?.metadata?.reason).toBe(reason);
    });

    it('should block FACULTY users from resetting biometric profiles', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/faculty/${facultyId}/reset-face`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ reason: 'Self reset attempt' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. AUDIT CENTER & SECRET SANITIZATION TESTS
  // =========================================================================
  describe('Audit Center & Secret Sanitization', () => {
    it('should allow ADMIN to retrieve paginated audit logs with categorized events', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { logs, pagination } = res.body.data;
      expect(Array.isArray(logs)).toBe(true);
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('total');

      // Check categorization
      const sample = logs[0];
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('action');
      expect(sample).toHaveProperty('category');
      expect(['AUTOMATED_VERIFICATION', 'ADMINISTRATIVE_DECISION', 'SECURITY_EVENT']).toContain(
        sample.category
      );
    });

    it('should strictly sanitize secrets and biometrics from audit log details', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs?search=ADMIN_TEST_SENSITIVE_ACTION`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { logs } = res.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const testLog = logs.find((l: any) => l.action === 'ADMIN_TEST_SENSITIVE_ACTION');
      expect(testLog).toBeDefined();

      const details = testLog.details;
      // Secrets must be stripped
      expect(details).not.toHaveProperty('secretToken');
      expect(details).not.toHaveProperty('jwtToken');
      expect(details).not.toHaveProperty('rawEmbedding');

      // Safe fields must be preserved
      expect(details).toHaveProperty('safeField', 'This should remain');
      expect(details).toHaveProperty('employeeId', `FAC_DASH_${uniqueSuffix}`);
    });

    it('should block FACULTY users from accessing the Audit Center', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
    });
  });
});
