import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { BiometricUpdateRequestModel } from '../../src/models/BiometricUpdateRequest';
import { NotificationModel } from '../../src/models/Notification';
import { AuditLogModel } from '../../src/models/AuditLog';
import { profilePhotoStorageService } from '../../src/services/profilePhotoStorage.service';
import { faceVerificationService } from '../../src/services/faceVerification.service';
import { generateAccessToken } from '../../src/utils/crypto';
import { env } from '../../src/config/env';

describe('Phase 10.5 — Admin Biometric Photo Review & Approval Integration Tests', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);

  let faculty1Id: string;
  let faculty1EmpId: string;
  let faculty1Token: string;
  const initialActivePhotoRef1 = `photo_active_initial1_${uniqueSuffix}.jpg`;
  const initialActiveEmbeddingRef1 = `face_emb_initial1_${uniqueSuffix}`;

  let faculty2Id: string;
  let faculty2EmpId: string;
  let faculty2Token: string;
  const initialActivePhotoRef2 = `photo_active_initial2_${uniqueSuffix}.jpg`;
  const initialActiveEmbeddingRef2 = `face_emb_initial2_${uniqueSuffix}`;

  let adminId: string;
  let adminEmpId: string;
  let adminToken: string;

  // 1x1 valid JPEG image buffer
  const sampleJpegBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  beforeAll(async () => {
    await connectDB();

    try {
      await BiometricUpdateRequestModel.collection.dropIndexes();
    } catch {
      // Index drop fallback
    }
    await BiometricUpdateRequestModel.syncIndexes();
    await UserModel.init();

    // 1. Create Faculty 1
    faculty1EmpId = `FAC-REV1-${uniqueSuffix}`;
    const faculty1Doc = await UserModel.create({
      name: `Dr. Alan Reviewee ${uniqueSuffix}`,
      email: `faculty.rev1.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: faculty1EmpId,
      role: 'FACULTY',
      department: 'Computer Science',
      profilePhotoReference: initialActivePhotoRef1,
      faceEmbeddingReference: initialActiveEmbeddingRef1,
      photoUpdatedAt: new Date(),
      isActive: true,
    });
    faculty1Id = faculty1Doc._id.toString();
    faculty1Token = generateAccessToken({
      userId: faculty1Id,
      email: faculty1Doc.email,
      role: 'FACULTY',
      employeeId: faculty1EmpId,
      name: faculty1Doc.name,
    });

    // 2. Create Faculty 2
    faculty2EmpId = `FAC-REV2-${uniqueSuffix}`;
    const faculty2Doc = await UserModel.create({
      name: `Dr. Grace Reviewee ${uniqueSuffix}`,
      email: `faculty.rev2.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: faculty2EmpId,
      role: 'FACULTY',
      department: 'Mathematics',
      profilePhotoReference: initialActivePhotoRef2,
      faceEmbeddingReference: initialActiveEmbeddingRef2,
      photoUpdatedAt: new Date(),
      isActive: true,
    });
    faculty2Id = faculty2Doc._id.toString();
    faculty2Token = generateAccessToken({
      userId: faculty2Id,
      email: faculty2Doc.email,
      role: 'FACULTY',
      employeeId: faculty2EmpId,
      name: faculty2Doc.name,
    });

    // 3. Create Admin
    adminEmpId = `ADM-REV-${uniqueSuffix}`;
    const adminDoc = await UserModel.create({
      name: `Chief Auditor ${uniqueSuffix}`,
      email: `admin.rev.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: adminEmpId,
      role: 'ADMIN',
      department: 'Dean of Academic Affairs',
      isActive: true,
    });
    adminId = adminDoc._id.toString();
    adminToken = generateAccessToken({
      userId: adminId,
      email: adminDoc.email,
      role: 'ADMIN',
      employeeId: adminEmpId,
      name: adminDoc.name,
    });

    // Seed mock active profile photos on disk for cleanup tests
    await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);
  });

  beforeEach(() => {
    jest.spyOn(faceVerificationService, 'validateCandidateEmbedding').mockImplementation(async (ref) => {
      if (!ref || ref.includes('corrupt') || ref.includes('invalid') || ref === 'missing') return false;
      return true;
    });
    jest.spyOn(faceVerificationService, 'checkFace').mockResolvedValue({
      valid: true,
      qualityScore: 0.95,
      message: 'Face detected clearly.',
    });
    jest.spyOn(faceVerificationService, 'activateCandidateEmbedding').mockImplementation(async ({ employeeId }) => {
      return `face_emb_active_${employeeId}_${Date.now()}`;
    });
    jest.spyOn(faceVerificationService, 'cleanupEmbedding').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await BiometricUpdateRequestModel.deleteMany({
      employeeId: { $in: [faculty1EmpId, faculty2EmpId] },
    });
    await UserModel.deleteMany({
      _id: { $in: [faculty1Id, faculty2Id, adminId] },
    });
    await NotificationModel.deleteMany({
      facultyId: { $in: [faculty1Id, faculty2Id] },
    });
    await AuditLogModel.deleteMany({
      userId: { $in: [adminId, faculty1Id, faculty2Id] },
    });
    await disconnectDB();
  });

  describe('1. Admin Authorization & Access Control', () => {
    it('should reject unauthenticated access to review endpoints with 401', async () => {
      const resList = await request(app).get('/api/v1/admin/biometric-update-requests');
      expect(resList.status).toBe(401);

      const resDetail = await request(app).get('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011');
      expect(resDetail.status).toBe(401);

      const resPhoto = await request(app).get(
        '/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/photo'
      );
      expect(resPhoto.status).toBe(401);

      const resApprove = await request(app)
        .post('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/approve')
        .send({ notes: 'Unauthenticated attempt' });
      expect(resApprove.status).toBe(401);

      const resReject = await request(app)
        .post('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/reject')
        .send({ reason: 'Unauthenticated attempt' });
      expect(resReject.status).toBe(401);
    });

    it('should reject FACULTY role from calling admin review endpoints with 403', async () => {
      const resList = await request(app)
        .get('/api/v1/admin/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`);
      expect(resList.status).toBe(403);

      const resDetail = await request(app)
        .get('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${faculty1Token}`);
      expect(resDetail.status).toBe(403);

      const resPhoto = await request(app)
        .get('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/photo')
        .set('Authorization', `Bearer ${faculty1Token}`);
      expect(resPhoto.status).toBe(403);

      const resApprove = await request(app)
        .post('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/approve')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ notes: 'Faculty attempting approval' });
      expect(resApprove.status).toBe(403);

      const resReject = await request(app)
        .post('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/reject')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ reason: 'Faculty attempting rejection' });
      expect(resReject.status).toBe(403);
    });
  });

  describe('2. Candidate Photo Streaming & Privacy Protections', () => {
    let pendingReqId: string;
    let storedPendingRef: string;

    beforeAll(async () => {
      // Save a valid pending photo to disk
      const photo = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      storedPendingRef = photo.reference;

      const reqDoc = await BiometricUpdateRequestModel.create({
        facultyId: faculty1Id,
        employeeId: faculty1EmpId,
        candidatePhotoReference: storedPendingRef,
        candidateEmbeddingReference: `candidate_${faculty1EmpId}_${Date.now()}`,
        reason: 'Photo inspect test submission.',
        status: 'PENDING',
      });
      pendingReqId = reqDoc._id.toString();
    });

    afterAll(async () => {
      await profilePhotoStorageService.deletePhoto(storedPendingRef, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(pendingReqId);
    });

    it('should allow ADMIN to stream candidate photo with 200 OK and no-store cache headers', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/biometric-update-requests/${pendingReqId}/photo`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['content-disposition']).toContain('candidate-biometric-photo.jpg');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return 404 if request does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/admin/biometric-update-requests/${nonExistentId}/photo`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BIOMETRIC_REQUEST_NOT_FOUND');
    });

    it('should return sanitized detail without exposing file paths or embeddings', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/biometric-update-requests/${pendingReqId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reqData = res.body.data.request;
      expect(reqData.id).toBe(pendingReqId);
      expect(reqData.employeeId).toBe(faculty1EmpId);
      expect(reqData.status).toBe('PENDING');

      // CRITICAL: Ensure sensitive paths and embeddings are never exposed
      expect(reqData.candidatePhotoReference).toBeUndefined();
      expect(reqData.candidateEmbeddingReference).toBeUndefined();
      expect(reqData.image).toBeUndefined();
      expect(reqData.filePath).toBeUndefined();
    });
  });

  describe('3. Approval Workflow, Atomic Activation & Safe Rollback', () => {
    let approvalReqId: string;
    let candidatePhotoRef: string;
    let candidateEmbeddingRef: string;

    beforeEach(async () => {
      // Save pending photo
      const photo = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      candidatePhotoRef = photo.reference;
      candidateEmbeddingRef = `candidate_${faculty1EmpId}_test_${Date.now()}`;

      // Reset faculty 1 active enrollment
      await UserModel.findByIdAndUpdate(faculty1Id, {
        profilePhotoReference: initialActivePhotoRef1,
        faceEmbeddingReference: initialActiveEmbeddingRef1,
      });

      // Clear any prior requests
      await BiometricUpdateRequestModel.deleteMany({ facultyId: faculty1Id });

      const reqDoc = await BiometricUpdateRequestModel.create({
        facultyId: faculty1Id,
        employeeId: faculty1EmpId,
        candidatePhotoReference: candidatePhotoRef,
        candidateEmbeddingReference: candidateEmbeddingRef,
        reason: 'Studio headshot with prescription eyewear.',
        status: 'PENDING',
      });
      approvalReqId = reqDoc._id.toString();
    });

    afterEach(async () => {
      await profilePhotoStorageService.deletePhoto(candidatePhotoRef, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(approvalReqId);
    });

    it('should successfully approve request, promote photo, activate embedding, and notify faculty', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Photo verified against official university badge credentials.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.employeeId).toBe(faculty1EmpId);

      // 1. Verify BiometricUpdateRequest updated in DB
      const updatedReq = await BiometricUpdateRequestModel.findById(approvalReqId);
      expect(updatedReq).not.toBeNull();
      expect(updatedReq!.status).toBe('APPROVED');
      expect(updatedReq!.adminReview?.adminName).toContain('Chief Auditor');
      expect(updatedReq!.adminReview?.notes).toBe(
        'Photo verified against official university badge credentials.'
      );

      // 2. Verify User model updated with new active photo and new active embedding
      const updatedUser = await UserModel.findById(faculty1Id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.profilePhotoReference).toMatch(/^photo_active_[a-f0-9-]+\.(jpe?g|png|webp)$/i);
      expect(updatedUser!.profilePhotoReference).not.toBe(initialActivePhotoRef1);
      expect(updatedUser!.faceEmbeddingReference).toMatch(/^face_emb_active_/);
      expect(updatedUser!.faceEmbeddingReference).not.toBe(initialActiveEmbeddingRef1);
      expect(updatedUser!.photoUpdatedAt).toBeDefined();

      // 3. Verify promoted photo exists in active storage vault
      const activeExists = await profilePhotoStorageService.photoExists(
        updatedUser!.profilePhotoReference!,
        'active'
      );
      expect(activeExists).toBe(true);

      // 4. Verify candidate pending photo was purged from pending storage
      const pendingExists = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'pending');
      expect(pendingExists).toBe(false);

      // 5. Verify faculty received BIOMETRIC_UPDATE_APPROVED notification
      const notification = await NotificationModel.findOne({
        facultyId: faculty1Id,
        biometricRequestId: approvalReqId,
        type: 'BIOMETRIC_UPDATE_APPROVED',
      });
      expect(notification).not.toBeNull();
      expect(notification!.title).toContain('Approved');
      expect(notification!.message).toContain('Chief Auditor');

      // 6. Verify audit event was recorded
      const auditLog = await AuditLogModel.findOne({
        userId: adminId,
        action: 'BIOMETRIC_UPDATE_APPROVED',
      });
      expect(auditLog).not.toBeNull();
      expect((auditLog!.metadata as any).employeeId).toBe(faculty1EmpId);
    });

    it('should reject approval if candidate photo is missing from pending storage (fail-closed)', async () => {
      // Intentionally delete the candidate photo from disk before approval
      await profilePhotoStorageService.deletePhoto(candidatePhotoRef, 'pending');

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approving missing photo' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANDIDATE_PHOTO_MISSING');

      // Verify active user profile remains 100% UNCHANGED
      const user = await UserModel.findById(faculty1Id);
      expect(user!.profilePhotoReference).toBe(initialActivePhotoRef1);
      expect(user!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef1);

      // Verify request remains PENDING
      const reqDoc = await BiometricUpdateRequestModel.findById(approvalReqId);
      expect(reqDoc!.status).toBe('PENDING');
    });

    it('should reject approval if candidate embedding is corrupt or does not belong to faculty', async () => {
      // Modify request candidate embedding to an invalid token
      await BiometricUpdateRequestModel.findByIdAndUpdate(approvalReqId, {
        candidateEmbeddingReference: 'corrupt_invalid_token',
      });

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approving invalid embedding' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CANDIDATE_EMBEDDING');

      // Verify active user profile is preserved
      const user = await UserModel.findById(faculty1Id);
      expect(user!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef1);
    });

    it('should reject approval if face re-validation fails', async () => {
      const checkFaceSpy = jest
        .spyOn(faceVerificationService, 'checkFace')
        .mockResolvedValueOnce({ valid: false, qualityScore: 0.2, message: 'Image quality too low or multi-face detected' });

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Testing re-validation failure' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BIOMETRIC_REVALIDATION_FAILED');

      // Verify request remains PENDING
      const reqDoc = await BiometricUpdateRequestModel.findById(approvalReqId);
      expect(reqDoc!.status).toBe('PENDING');

      checkFaceSpy.mockRestore();
    });

    it('should prevent duplicate approval with 409 conflict', async () => {
      // First approval succeeds
      const firstRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'First approval' });
      expect(firstRes.status).toBe(200);

      // Second approval attempt MUST fail with 409
      const secondRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${approvalReqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Duplicate approval attempt' });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error.code).toBe('REQUEST_ALREADY_REVIEWED');
    });
  });

  describe('4. Rejection Workflow, Reason Enforcement & Candidate Cleanup', () => {
    let rejectReqId: string;
    let candidatePhotoRef: string;
    let candidateEmbeddingRef: string;

    beforeEach(async () => {
      const photo = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      candidatePhotoRef = photo.reference;
      candidateEmbeddingRef = `candidate_${faculty2EmpId}_rej_${Date.now()}`;

      // Reset faculty 2 enrollment
      await UserModel.findByIdAndUpdate(faculty2Id, {
        profilePhotoReference: initialActivePhotoRef2,
        faceEmbeddingReference: initialActiveEmbeddingRef2,
      });

      await BiometricUpdateRequestModel.deleteMany({ facultyId: faculty2Id });

      const reqDoc = await BiometricUpdateRequestModel.create({
        facultyId: faculty2Id,
        employeeId: faculty2EmpId,
        candidatePhotoReference: candidatePhotoRef,
        candidateEmbeddingReference: candidateEmbeddingRef,
        reason: 'Casual selfie upload.',
        status: 'PENDING',
      });
      rejectReqId = reqDoc._id.toString();
    });

    afterEach(async () => {
      await profilePhotoStorageService.deletePhoto(candidatePhotoRef, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(rejectReqId);
    });

    it('should reject request without a valid rejection reason with 400', async () => {
      // Empty reason
      const resEmpty = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' });
      expect(resEmpty.status).toBe(400);

      // Too short reason (< 3 chars)
      const resShort = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'no' });
      expect(resShort.status).toBe(400);
    });

    it('should successfully reject request, preserve active profile, cleanup candidate photo, and notify faculty', async () => {
      const rejectionReason = 'Photograph contains poor backlighting and sunglasses.';

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: rejectionReason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');

      // 1. Verify BiometricUpdateRequest marked REJECTED
      const updatedReq = await BiometricUpdateRequestModel.findById(rejectReqId);
      expect(updatedReq!.status).toBe('REJECTED');
      expect(updatedReq!.adminReview?.notes).toBe(rejectionReason);

      // 2. CRITICAL: Active user enrollment must remain 100% UNCHANGED
      const user = await UserModel.findById(faculty2Id);
      expect(user!.profilePhotoReference).toBe(initialActivePhotoRef2);
      expect(user!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef2);

      // 3. Candidate pending photo MUST be deleted from storage
      const pendingExists = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'pending');
      expect(pendingExists).toBe(false);

      // 4. Verify faculty notification with reason
      const notification = await NotificationModel.findOne({
        facultyId: faculty2Id,
        biometricRequestId: rejectReqId,
        type: 'BIOMETRIC_UPDATE_REJECTED',
      });
      expect(notification).not.toBeNull();
      expect(notification!.title).toContain('Rejected');
      expect(notification!.message).toContain(rejectionReason);

      // 5. Verify audit event
      const auditLog = await AuditLogModel.findOne({
        userId: adminId,
        action: 'BIOMETRIC_UPDATE_REJECTED',
      });
      expect(auditLog).not.toBeNull();
      expect((auditLog!.metadata as any).rejectionReason).toBe(rejectionReason);
    });

    it('should prevent rejecting an already reviewed request with 409 conflict', async () => {
      // Reject once
      await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Initial rejection' });

      // Reject again -> 409
      const resSecond = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Duplicate rejection' });

      expect(resSecond.status).toBe(409);
      expect(resSecond.body.error.code).toBe('REQUEST_ALREADY_REVIEWED');
    });
  });

  describe('5. Admin Review Queue Listing & Status Filtering', () => {
    beforeAll(async () => {
      // Seed requests with different statuses
      await BiometricUpdateRequestModel.deleteMany({ facultyId: faculty1Id });
      await BiometricUpdateRequestModel.create([
        {
          facultyId: faculty1Id,
          employeeId: faculty1EmpId,
          candidatePhotoReference: 'photo_pending_q1.jpg',
          candidateEmbeddingReference: 'candidate_q1_ref',
          reason: 'Queue listing pending test',
          status: 'PENDING',
        },
      ]);
    });

    it('should paginate and filter review requests by status', async () => {
      const resPending = await request(app)
        .get('/api/v1/admin/biometric-update-requests?status=PENDING&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPending.status).toBe(200);
      expect(resPending.body.success).toBe(true);
      expect(Array.isArray(resPending.body.data.requests)).toBe(true);
      expect(resPending.body.data.requests.length).toBeGreaterThanOrEqual(1);

      const found = resPending.body.data.requests.find((r: any) => r.employeeId === faculty1EmpId);
      expect(found).toBeDefined();
      expect(found.status).toBe('PENDING');
      expect(found.facultyName).toBeDefined();

      // Ensure no internal paths or embeddings are returned in listing
      expect(found.candidatePhotoReference).toBeUndefined();
      expect(found.candidateEmbeddingReference).toBeUndefined();
    });
  });
});
