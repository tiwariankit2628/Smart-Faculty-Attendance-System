import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { AttendanceModel } from '../../src/models/Attendance';
import { NotificationModel } from '../../src/models/Notification';
import { generateAccessToken } from '../../src/utils/crypto';

describe('Faculty Attendance Notification System Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let facultyAId: string;
  let facultyAToken: string;
  let facultyBId: string;
  let facultyBToken: string;
  let attendanceRecordA: any;
  let attendanceRecordB: any;
  const uniqueSuffix = Date.now().toString().slice(-5);

  beforeAll(async () => {
    await connectDB();

    // 1. Create Admin
    const admin = await UserModel.create({
      name: 'System Administrator',
      email: `admin.notif.${uniqueSuffix}@lpu.in`,
      employeeId: `ADM_NOTIF_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'ADMIN',
      department: 'Administration',
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

    // 2. Create Faculty A
    const facultyA = await UserModel.create({
      name: 'Dr. John Doe',
      email: `john.doe.${uniqueSuffix}@lpu.in`,
      employeeId: `FAC_A_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'FACULTY',
      department: 'Computer Science',
      isActive: true,
    });
    facultyAId = facultyA._id.toString();
    facultyAToken = generateAccessToken({
      userId: facultyAId,
      email: facultyA.email,
      role: 'FACULTY',
      employeeId: facultyA.employeeId,
      name: facultyA.name,
    });

    // 3. Create Faculty B
    const facultyB = await UserModel.create({
      name: 'Dr. Jane Smith',
      email: `jane.smith.${uniqueSuffix}@lpu.in`,
      employeeId: `FAC_B_${uniqueSuffix}`,
      passwordHash: 'dummy_hash',
      role: 'FACULTY',
      department: 'Electronics',
      isActive: true,
    });
    facultyBId = facultyB._id.toString();
    facultyBToken = generateAccessToken({
      userId: facultyBId,
      email: facultyB.email,
      role: 'FACULTY',
      employeeId: facultyB.employeeId,
      name: facultyB.name,
    });

    // 4. Create Attendance Record for Faculty A
    attendanceRecordA = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyAId),
      date: '2026-10-08',
      timestamp: new Date('2026-10-08T09:00:00Z'),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 25,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'FLAGGED',
      originalStatus: 'FLAGGED',
      verificationMetadata: {
        faceConfidence: 0.88,
        livenessScore: 0.95,
        rejectionReason: 'Suspected boundary anomaly',
      },
    });

    // 5. Create Attendance Record for Faculty B
    attendanceRecordB = await AttendanceModel.create({
      facultyId: new mongoose.Types.ObjectId(facultyBId),
      date: '2026-10-08',
      timestamp: new Date('2026-10-08T09:15:00Z'),
      latitude: 31.2536,
      longitude: 75.7037,
      distanceFromZone: 30,
      locationVerified: true,
      faceVerified: true,
      livenessVerified: true,
      status: 'FLAGGED',
      originalStatus: 'FLAGGED',
      verificationMetadata: {
        faceConfidence: 0.89,
        livenessScore: 0.96,
      },
    });
  });

  afterAll(async () => {
    if (adminId) await UserModel.deleteMany({ _id: { $in: [adminId, facultyAId, facultyBId] } });
    if (attendanceRecordA) await AttendanceModel.deleteMany({ _id: { $in: [attendanceRecordA._id, attendanceRecordB._id] } });
    await NotificationModel.deleteMany({ facultyId: { $in: [facultyAId, facultyBId] } });
  });

  describe('1. Admin Approval Notification Flow', () => {
    it('should create an ATTENDANCE_APPROVED notification when admin sets status to VERIFIED', async () => {
      const reason = 'Authorized off-campus duty documentation verified.';
      const res = await request(app)
        .post(`/api/v1/admin/attendance/${attendanceRecordA._id}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          reason,
          expectedPreviousStatus: 'FLAGGED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.record.status).toBe('VERIFIED');

      // Verify notification in database
      const notif = await NotificationModel.findOne({
        facultyId: new mongoose.Types.ObjectId(facultyAId),
        attendanceId: attendanceRecordA._id,
      });

      expect(notif).not.toBeNull();
      expect(notif!.type).toBe('ATTENDANCE_APPROVED');
      expect(notif!.title).toBe('Attendance Verification Approved');
      expect(notif!.message).toContain('8 October 2026');
      expect(notif!.message).toContain(reason);
      expect(notif!.read).toBe(false);
      expect(notif!.readAt).toBeNull();

      // Ensure no sensitive internal data is leaked
      expect(notif!.message).not.toContain('faceEmbedding');
      expect(notif!.message).not.toContain('faceToken');
      expect(notif!.message).not.toContain('challengeToken');
      expect(notif!.message).not.toContain('ipAddress');
    });
  });

  describe('2. Admin Rejection Notification Flow', () => {
    it('should create an ATTENDANCE_REJECTED notification when admin sets status to REJECTED', async () => {
      const reason = 'Biometric verification could not be validated.';
      const res = await request(app)
        .post(`/api/v1/admin/attendance/${attendanceRecordB._id}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REJECTED',
          reason,
          expectedPreviousStatus: 'FLAGGED',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.record.status).toBe('REJECTED');

      // Verify notification in database
      const notif = await NotificationModel.findOne({
        facultyId: new mongoose.Types.ObjectId(facultyBId),
        attendanceId: attendanceRecordB._id,
      });

      expect(notif).not.toBeNull();
      expect(notif!.type).toBe('ATTENDANCE_REJECTED');
      expect(notif!.title).toBe('Attendance Verification Rejected');
      expect(notif!.message).toContain('8 October 2026');
      expect(notif!.message).toContain(reason);
      expect(notif!.message).toContain('Decision Timestamp');
      expect(notif!.read).toBe(false);
    });
  });

  describe('3. Failed & Duplicate Override Notifications', () => {
    it('should NOT create a notification if override is rejected due to validation failure', async () => {
      const countBefore = await NotificationModel.countDocuments();

      const res = await request(app)
        .post(`/api/v1/admin/attendance/${attendanceRecordA._id}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REJECTED',
          reason: '   ', // empty reason
        });

      expect(res.status).toBe(400);
      const countAfter = await NotificationModel.countDocuments();
      expect(countAfter).toBe(countBefore);
    });

    it('should NOT create duplicate notifications on duplicate override requests', async () => {
      const countBefore = await NotificationModel.countDocuments();

      // Attendance A is already VERIFIED from previous test
      const res = await request(app)
        .post(`/api/v1/admin/attendance/${attendanceRecordA._id}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          reason: 'Duplicate override attempt',
        });

      expect(res.status).toBe(409); // DUPLICATE_OVERRIDE_REJECTED
      const countAfter = await NotificationModel.countDocuments();
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('4. Faculty Notification API & Strict Isolation', () => {
    it('should allow Faculty A to retrieve only their own notifications', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/notifications')
        .set('Authorization', `Bearer ${facultyAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toBeInstanceOf(Array);
      expect(res.body.data.notifications.length).toBe(1);
      expect(res.body.data.notifications[0].facultyId.toString()).toBe(facultyAId);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('should allow Faculty B to retrieve only their own notifications', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/notifications')
        .set('Authorization', `Bearer ${facultyBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toBeInstanceOf(Array);
      expect(res.body.data.notifications.length).toBe(1);
      expect(res.body.data.notifications[0].facultyId.toString()).toBe(facultyBId);
      expect(res.body.data.unreadCount).toBe(1);
    });

    it('should ignore any client-supplied facultyId in query params and enforce JWT identity', async () => {
      const res = await request(app)
        .get(`/api/v1/faculty/notifications?facultyId=${facultyBId}`)
        .set('Authorization', `Bearer ${facultyAToken}`);

      expect(res.status).toBe(200);
      // Faculty A still only sees Faculty A's notifications
      expect(res.body.data.notifications.length).toBe(1);
      expect(res.body.data.notifications[0].facultyId.toString()).toBe(facultyAId);
    });

    it('should return unread count accurately via /notifications/unread-count', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/notifications/unread-count')
        .set('Authorization', `Bearer ${facultyAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBe(1);
    });
  });

  describe('5. Mark as Read & Mark All as Read', () => {
    it('should allow Faculty A to mark their own notification as read', async () => {
      const notifA = await NotificationModel.findOne({ facultyId: new mongoose.Types.ObjectId(facultyAId) });
      expect(notifA).not.toBeNull();

      const res = await request(app)
        .patch(`/api/v1/faculty/notifications/${notifA!._id}/read`)
        .set('Authorization', `Bearer ${facultyAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification.read).toBe(true);
      expect(res.body.data.notification.readAt).not.toBeNull();

      // Verify unread count is now 0
      const countRes = await request(app)
        .get('/api/v1/faculty/notifications/unread-count')
        .set('Authorization', `Bearer ${facultyAToken}`);
      expect(countRes.body.data.unreadCount).toBe(0);
    });

    it('should prevent Faculty A from marking Faculty B notification as read', async () => {
      const notifB = await NotificationModel.findOne({ facultyId: new mongoose.Types.ObjectId(facultyBId) });
      expect(notifB).not.toBeNull();

      const res = await request(app)
        .patch(`/api/v1/faculty/notifications/${notifB!._id}/read`)
        .set('Authorization', `Bearer ${facultyAToken}`);

      // Faculty A cannot modify Faculty B notification -> 404 NOT_FOUND
      expect(res.status).toBe(404);

      // Verify Faculty B notification remains unread
      const verifyB = await NotificationModel.findById(notifB!._id);
      expect(verifyB!.read).toBe(false);
      expect(verifyB!.readAt).toBeNull();
    });

    it('should mark all notifications as read for the authenticated faculty only', async () => {
      // Create a second unread notification for Faculty B
      await NotificationModel.create({
        facultyId: new mongoose.Types.ObjectId(facultyBId),
        attendanceId: attendanceRecordB._id,
        type: 'ATTENDANCE_REVIEW_REQUIRED',
        title: 'Attendance Review Required',
        message: 'Second notification for faculty B',
        read: false,
      });

      const countBeforeB = await NotificationModel.countDocuments({
        facultyId: new mongoose.Types.ObjectId(facultyBId),
        read: false,
      });
      expect(countBeforeB).toBe(2);

      const res = await request(app)
        .patch('/api/v1/faculty/notifications/read-all')
        .set('Authorization', `Bearer ${facultyBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(2);

      const countAfterB = await NotificationModel.countDocuments({
        facultyId: new mongoose.Types.ObjectId(facultyBId),
        read: false,
      });
      expect(countAfterB).toBe(0);
    });

    it('should reject unauthenticated requests to notifications endpoints with 401', async () => {
      const res = await request(app).get('/api/v1/faculty/notifications');
      expect(res.status).toBe(401);

      const markRes = await request(app).patch('/api/v1/faculty/notifications/read-all');
      expect(markRes.status).toBe(401);
    });
  });
});
