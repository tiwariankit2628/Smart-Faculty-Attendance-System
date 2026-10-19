import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
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
import { AttendanceModel } from '../../src/models/Attendance';
import { adminService } from '../../src/services/admin.service';
import { profilePhotoStorageService } from '../../src/services/profilePhotoStorage.service';
import { faceVerificationService } from '../../src/services/faceVerification.service';
import { notificationService } from '../../src/services/notification.service';
import { auditService } from '../../src/services/audit.service';
import { generateAccessToken } from '../../src/utils/crypto';
import { AppError } from '../../src/utils/apiError';

describe('Phase 10.6 — Biometric End-to-End Integration, Crash Recovery & Security Validation', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);

  let faculty1Id: string;
  let faculty1EmpId: string;
  let faculty1Token: string;
  let initialActivePhotoRef1: string;
  let initialActiveEmbeddingRef1: string;

  let faculty2Id: string;
  let faculty2EmpId: string;
  let faculty2Token: string;
  let initialActivePhotoRef2: string;
  let initialActiveEmbeddingRef2: string;

  let adminId: string;
  let adminEmpId: string;
  let adminToken: string;

  // 1x1 valid sample JPEG base64 payload
  const validBase64Jpeg =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const sampleJpegBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );

  beforeAll(async () => {
    await connectDB();

    try {
      await BiometricUpdateRequestModel.collection.dropIndexes();
    } catch {
      // index fallback
    }
    await BiometricUpdateRequestModel.syncIndexes();
    await UserModel.init();

    // 1. Setup isolated Faculty 1
    faculty1EmpId = `FAC-REC1-${uniqueSuffix}`;
    const initialPhoto1 = await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);
    initialActivePhotoRef1 = initialPhoto1.reference;
    initialActiveEmbeddingRef1 = `face_emb_rec1_${uniqueSuffix}`;

    const faculty1Doc = await UserModel.create({
      name: `Dr. Sarah Recovery ${uniqueSuffix}`,
      email: `faculty.rec1.${uniqueSuffix}@lpu.in`,
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

    // 2. Setup isolated Faculty 2
    faculty2EmpId = `FAC-REC2-${uniqueSuffix}`;
    const initialPhoto2 = await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);
    initialActivePhotoRef2 = initialPhoto2.reference;
    initialActiveEmbeddingRef2 = `face_emb_rec2_${uniqueSuffix}`;

    const faculty2Doc = await UserModel.create({
      name: `Dr. Robert Resilience ${uniqueSuffix}`,
      email: `faculty.rec2.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: faculty2EmpId,
      role: 'FACULTY',
      department: 'Mechanical Engineering',
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

    // 3. Setup Administrator
    adminEmpId = `ADM-REC-${uniqueSuffix}`;
    const adminDoc = await UserModel.create({
      name: `Auditor General ${uniqueSuffix}`,
      email: `admin.rec.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: adminEmpId,
      role: 'ADMIN',
      department: 'Academic Administration',
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
  });

  beforeEach(() => {
    // Standard mock setup for faceVerificationService
    jest.spyOn(faceVerificationService, 'validateCandidateEmbedding').mockImplementation(async (ref, expectedEmpId) => {
      if (!ref || ref.includes('corrupt') || ref.includes('invalid') || ref === 'missing') return false;
      if (expectedEmpId && !ref.includes(expectedEmpId) && !ref.startsWith('candidate_') && !ref.startsWith('face_emb_candidate_')) {
        return false;
      }
      return true;
    });

    jest.spyOn(faceVerificationService, 'checkFace').mockResolvedValue({
      valid: true,
      qualityScore: 0.95,
      message: 'Face detected clearly.',
    });

    jest.spyOn(faceVerificationService, 'registerFace').mockImplementation(async (facultyId) => {
      return `face_emb_${facultyId}_${Date.now()}`;
    });

    jest.spyOn(faceVerificationService, 'activateCandidateEmbedding').mockImplementation(async ({ employeeId }) => {
      return `face_emb_active_${employeeId}_${Date.now()}`;
    });

    jest.spyOn(faceVerificationService, 'cleanupEmbedding').mockResolvedValue(true);

    jest.spyOn(faceVerificationService, 'verifyFace').mockImplementation(async (_facultyId, embeddingRef) => {
      return {
        verified: true,
        identityMatched: true,
        similarity: 0.95,
        distance: 0.22,
        confidence: 0.95,
        livenessScore: 0.98,
        isLive: true,
        livenessVerified: true,
        livenessStatus: 'PASSED',
      };
    });
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
    await AttendanceModel.deleteMany({
      facultyId: { $in: [faculty1Id, faculty2Id] },
    });
    await disconnectDB();
  });

  describe('1. Complete End-to-End Workflow Testing', () => {
    let createdRequestId: string;
    let candidatePhotoRef: string;
    let candidateEmbeddingRef: string;
    let promotedPhotoRef: string;
    let newlyActivatedEmbeddingRef: string;

    it('1.1 should allow faculty to submit a valid biometric update request with isolated candidate artifacts', async () => {
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({
          image: validBase64Jpeg,
          reason: 'Updated clear passport specification photo for campus attendance.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.employeeId).toBe(faculty1EmpId);

      createdRequestId = res.body.data.id;

      // Verify request state in database
      const requestDoc = await BiometricUpdateRequestModel.findById(createdRequestId);
      expect(requestDoc).not.toBeNull();
      expect(requestDoc!.status).toBe('PENDING');
      expect(requestDoc!.journal?.stage).toBe('IDLE');

      candidatePhotoRef = requestDoc!.candidatePhotoReference;
      candidateEmbeddingRef = requestDoc!.candidateEmbeddingReference;

      // Verify photo exists strictly in pending private vault
      const existsPending = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'pending');
      const existsActive = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'active');
      expect(existsPending).toBe(true);
      expect(existsActive).toBe(false);

      // Verify active faculty profile remains 100% UNCHANGED
      const facultyUser = await UserModel.findById(faculty1Id);
      expect(facultyUser!.profilePhotoReference).toBe(initialActivePhotoRef1);
      expect(facultyUser!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef1);
    });

    it('1.2 should prevent faculty from creating multiple pending requests concurrently', async () => {
      const duplicateRes = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({
          image: validBase64Jpeg,
          reason: 'Attempting duplicate request submission.',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe('DUPLICATE_PENDING_REQUEST');
    });

    it('1.3 should prevent candidate embedding from being used for ordinary attendance verification while pending', async () => {
      // Normal attendance must succeed with active enrollment
      const activeVerifyResult = await faceVerificationService.verifyFace(
        faculty1EmpId,
        initialActiveEmbeddingRef1,
        validBase64Jpeg
      );
      expect(activeVerifyResult.verified).toBe(true);

      // Verify that candidate reference is isolated
      expect(candidateEmbeddingRef).toMatch(/^face_emb_candidate_/);
      expect(candidateEmbeddingRef).not.toBe(initialActiveEmbeddingRef1);
    });

    it('1.4 should allow admin to stream and inspect candidate photo securely with no-store cache headers', async () => {
      const photoRes = await request(app)
        .get(`/api/v1/admin/biometric-update-requests/${createdRequestId}/photo`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(photoRes.status).toBe(200);
      expect(photoRes.headers['content-type']).toBe('image/jpeg');
      expect(photoRes.headers['cache-control']).toBe('private, no-cache, no-store, must-revalidate');
      expect(photoRes.body).toBeInstanceOf(Buffer);
    });

    it('1.5 should successfully approve request, promote photo, activate embedding, and clean up temporary artifacts', async () => {
      const approveRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${createdRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Photo verified against official campus faculty identity database. Approved.',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // 1. Verify User model has received new photo and embedding
      const updatedFaculty = await UserModel.findById(faculty1Id);
      expect(updatedFaculty!.profilePhotoReference).not.toBe(initialActivePhotoRef1);
      expect(updatedFaculty!.faceEmbeddingReference).not.toBe(initialActiveEmbeddingRef1);
      promotedPhotoRef = updatedFaculty!.profilePhotoReference!;
      newlyActivatedEmbeddingRef = updatedFaculty!.faceEmbeddingReference!;

      // 2. Verify new photo exists in active vault
      const newPhotoActiveExists = await profilePhotoStorageService.photoExists(promotedPhotoRef, 'active');
      expect(newPhotoActiveExists).toBe(true);

      // 3. Verify old active photo was cleaned up safely
      const oldPhotoExists = await profilePhotoStorageService.photoExists(initialActivePhotoRef1, 'active');
      expect(oldPhotoExists).toBe(false);

      // 4. Verify candidate pending photo was cleaned up safely
      const candidatePendingExists = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'pending');
      expect(candidatePendingExists).toBe(false);

      // 5. Verify request document has completed journal and approved review metadata
      const updatedReq = await BiometricUpdateRequestModel.findById(createdRequestId);
      expect(updatedReq!.status).toBe('APPROVED');
      expect(updatedReq!.journal?.stage).toBe('COMPLETED');
      expect(updatedReq!.adminReview?.adminName).toBe('Auditor General ' + uniqueSuffix);

      // 6. Verify faculty received an approval notification
      const notif = await NotificationModel.findOne({
        facultyId: faculty1Id,
        type: 'BIOMETRIC_UPDATE_APPROVED',
      });
      expect(notif).not.toBeNull();
      expect(notif!.title).toContain('Approved');

      // 7. Verify subsequent attendance verification uses newly active embedding
      const postApprovalVerify = await faceVerificationService.verifyFace(
        faculty1EmpId,
        newlyActivatedEmbeddingRef,
        validBase64Jpeg
      );
      expect(postApprovalVerify.verified).toBe(true);
    });

    it('1.6 should return safe conflict response on duplicate approval retry without corrupting state', async () => {
      const retryRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${createdRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Duplicate approval attempt' });

      expect(retryRes.status).toBe(409);
      expect(retryRes.body.error.code).toBe('REQUEST_ALREADY_REVIEWED');

      // Active photo and embedding remain intact and NOT double-promoted or purged
      const facultyUser = await UserModel.findById(faculty1Id);
      expect(facultyUser!.profilePhotoReference).toBe(promotedPhotoRef);
      expect(facultyUser!.faceEmbeddingReference).toBe(newlyActivatedEmbeddingRef);
    });
  });

  describe('2. Administrative Rejection & Isolation Testing', () => {
    let rejectionReqId: string;
    let candidatePhotoRef: string;
    let candidateEmbRef: string;

    it('2.1 should enforce meaningful rejection reason (> 2 characters)', async () => {
      // Create pending request for Faculty 2
      const createRes = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty2Token}`)
        .send({
          image: validBase64Jpeg,
          reason: 'Photo update request intended to test rejection.',
        });
      expect(createRes.status).toBe(201);
      rejectionReqId = createRes.body.data.id;

      const reqDoc = await BiometricUpdateRequestModel.findById(rejectionReqId);
      candidatePhotoRef = reqDoc!.candidatePhotoReference;
      candidateEmbRef = reqDoc!.candidateEmbeddingReference;

      // Reject with empty reason
      const badRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectionReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'no' });

      expect(badRes.status).toBe(400);
      expect(['INVALID_REJECTION_REASON', 'VALIDATION_ERROR']).toContain(badRes.body.error.code);
    });

    it('2.2 should reject request, keep active profile intact, delete candidate files, and notify faculty', async () => {
      const rejectRes = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${rejectionReqId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Photo has insufficient lighting and face is partially shadowed.',
        });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);
      expect(rejectRes.body.data.status).toBe('REJECTED');

      // 1. Verify active enrollment on User remains 100% UNCHANGED
      const facultyUser = await UserModel.findById(faculty2Id);
      expect(facultyUser!.profilePhotoReference).toBe(initialActivePhotoRef2);
      expect(facultyUser!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef2);

      // 2. Verify candidate pending photo was purged
      const candidateExists = await profilePhotoStorageService.photoExists(candidatePhotoRef, 'pending');
      expect(candidateExists).toBe(false);

      // 3. Verify faculty received rejection notification containing the reason
      const notif = await NotificationModel.findOne({
        facultyId: faculty2Id,
        type: 'BIOMETRIC_UPDATE_REJECTED',
      });
      expect(notif).not.toBeNull();
      expect(notif!.message).toContain('insufficient lighting');

      // 4. Verify audit record correctly recorded rejection
      const audit = await AuditLogModel.findOne({
        action: 'BIOMETRIC_UPDATE_REJECTED',
        'metadata.updateRequestId': rejectionReqId,
      });
      expect(audit).not.toBeNull();
      expect((audit!.metadata as any)?.employeeId).toBe(faculty2EmpId);
    });
  });

  describe('3. Failure Boundary & Failure-Injection Testing', () => {
    let testReqId: string;
    let candidatePhotoRef: string;
    let candidateEmbRef: string;

    const createPendingFixture = async () => {
      const stored = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      const embRef = `face_emb_candidate_${faculty2EmpId}_${Date.now()}`;
      const reqDoc = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty2Id),
        employeeId: faculty2EmpId,
        candidatePhotoReference: stored.reference,
        candidateEmbeddingReference: embRef,
        reason: 'Failure boundary test fixture',
        status: 'PENDING',
        journal: { stage: 'IDLE' },
      });
      return { reqDoc, stored, embRef };
    };

    it('3.1 Boundary 1: Missing or corrupt candidate photo fails closed with zero side effects', async () => {
      const fixture = await createPendingFixture();

      // Corrupt candidate by deleting file from pending storage vault
      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should fail closed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANDIDATE_PHOTO_MISSING');

      // Request remains PENDING
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');

      // Faculty active profile completely untouched
      const faculty = await UserModel.findById(faculty2Id);
      expect(faculty!.profilePhotoReference).toBe(initialActivePhotoRef2);

      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });

    it('3.2 Boundary 2: Corrupt or mismatched candidate embedding fails closed', async () => {
      const fixture = await createPendingFixture();

      // Simulate corrupt candidate embedding verification
      jest.spyOn(faceVerificationService, 'validateCandidateEmbedding').mockResolvedValue(false);

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should fail closed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CANDIDATE_EMBEDDING');

      // Request remains PENDING
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');

      // Clean up fixture
      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });

    it('3.3 Boundary 3: Face-service checkFace failure or offline fails closed', async () => {
      const fixture = await createPendingFixture();

      jest.spyOn(faceVerificationService, 'checkFace').mockResolvedValue({
        valid: false,
        qualityScore: 0.1,
        message: 'No distinct facial landmarks detected in submitted photo.',
      });

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should fail closed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BIOMETRIC_REVALIDATION_FAILED');

      // Request remains PENDING
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');

      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });

    it('3.4 Boundary 4: Photo promotion storage failure leaves state clean', async () => {
      const fixture = await createPendingFixture();

      jest.spyOn(profilePhotoStorageService, 'saveActivePhoto').mockRejectedValue(
        new Error('Simulated EACCES disk storage failure')
      );

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should fail' });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('PHOTO_STORAGE_ERROR');

      // Request reverted to PENDING with IDLE journal
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');
      expect(postReq!.journal?.stage).toBe('IDLE');

      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });

    it('3.5 Boundary 5: Embedding activation microservice failure compensates by deleting promoted photo', async () => {
      const fixture = await createPendingFixture();

      let promotedPhotoRefTracked: string | null = null;
      const originalSaveActive = profilePhotoStorageService.saveActivePhoto.bind(profilePhotoStorageService);
      jest.spyOn(profilePhotoStorageService, 'saveActivePhoto').mockImplementation(async (buf) => {
        const res = await originalSaveActive(buf);
        promotedPhotoRefTracked = res.reference;
        return res;
      });

      jest.spyOn(faceVerificationService, 'activateCandidateEmbedding').mockRejectedValue(
        new AppError(503, 'FACE_SERVICE_UNAVAILABLE', 'Face service timed out during activation')
      );

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should compensate and fail' });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('FACE_SERVICE_UNAVAILABLE');

      // Critical Compensating Rollback Check:
      // Verify newly saved active photo was deleted during compensation!
      expect(promotedPhotoRefTracked).not.toBeNull();
      const photoExistsInActive = await profilePhotoStorageService.photoExists(promotedPhotoRefTracked!, 'active');
      expect(photoExistsInActive).toBe(false);

      // Request returned to PENDING with IDLE journal
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');
      expect(postReq!.journal?.stage).toBe('IDLE');

      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });

    it('3.6 Boundary 6: Database User commit failure executes compensating rollback on photo and vector', async () => {
      const fixture = await createPendingFixture();

      let promotedPhotoRefTracked: string | null = null;
      let activatedVectorTracked: string | null = null;

      const originalSaveActive = profilePhotoStorageService.saveActivePhoto.bind(profilePhotoStorageService);
      jest.spyOn(profilePhotoStorageService, 'saveActivePhoto').mockImplementation(async (buf) => {
        const res = await originalSaveActive(buf);
        promotedPhotoRefTracked = res.reference;
        return res;
      });

      jest.spyOn(faceVerificationService, 'activateCandidateEmbedding').mockImplementation(async () => {
        activatedVectorTracked = `face_emb_temp_active_${Date.now()}`;
        return activatedVectorTracked;
      });

      const cleanupSpy = jest.spyOn(faceVerificationService, 'cleanupEmbedding');

      // Simulate MongoDB save error on User
      jest.spyOn(UserModel.prototype, 'save').mockRejectedValue(
        new Error('Simulated MongoNetworkTimeoutException during user commit')
      );

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${fixture.reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval should trigger DB compensation' });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('DATABASE_ERROR');

      // Critical Checks:
      // 1. Promoted active photo must be deleted
      expect(promotedPhotoRefTracked).not.toBeNull();
      const photoExistsInActive = await profilePhotoStorageService.photoExists(promotedPhotoRefTracked!, 'active');
      expect(photoExistsInActive).toBe(false);

      // 2. Activated vector in face service was purged via cleanupEmbedding
      expect(cleanupSpy).toHaveBeenCalledWith(activatedVectorTracked);

      // 3. Request journal marked FAILED with recoveryAction RETRY
      const postReq = await BiometricUpdateRequestModel.findById(fixture.reqDoc._id);
      expect(postReq!.status).toBe('PENDING');
      expect(postReq!.journal?.stage).toBe('FAILED');
      expect(postReq!.journal?.recoveryAction).toBe('RETRY');

      // 4. Faculty active profile unchanged
      const faculty = await UserModel.findById(faculty2Id);
      expect(faculty!.profilePhotoReference).toBe(initialActivePhotoRef2);
      expect(faculty!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef2);

      await profilePhotoStorageService.deletePhoto(fixture.stored.reference, 'pending');
      await BiometricUpdateRequestModel.findByIdAndDelete(fixture.reqDoc._id);
    });
  });

  describe('4. Distributed Crash Recovery & Reconciliation Engine', () => {
    it('4.1 should reconcile requests interrupted after embedding activation before user commit (Rollback)', async () => {
      // Simulate crash: Candidate photo promoted to active, embedding activated in face service,
      // but process was killed before UserModel.save() executed!
      const activePhoto = await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);
      const staleEmbRef = `face_emb_stale_active_${Date.now()}`;

      const crashedReq = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty2Id),
        employeeId: faculty2EmpId,
        candidatePhotoReference: `cand_photo_${uniqueSuffix}.jpg`,
        candidateEmbeddingReference: `cand_emb_${uniqueSuffix}`,
        reason: 'Simulated crash scenario A',
        status: 'PENDING',
        journal: {
          stage: 'EMBEDDING_ACTIVATED',
          promotedPhotoReference: activePhoto.reference,
          newEmbeddingReference: staleEmbRef,
          lastAttemptAt: new Date(Date.now() - 300000), // 5 minutes ago (stale)
        },
      });

      const cleanupSpy = jest.spyOn(faceVerificationService, 'cleanupEmbedding');

      // Run reconciliation engine
      const reconResult = await adminService.reconcileStaleRequests(60000);

      expect(reconResult.reconciledCount).toBeGreaterThanOrEqual(1);
      const reqDetail = reconResult.details.find((d) => d.id === crashedReq._id.toString());
      expect(reqDetail).toBeDefined();
      expect(reqDetail!.action).toBe('ROLLED_BACK');

      // 1. Promoted photo deleted
      const photoExists = await profilePhotoStorageService.photoExists(activePhoto.reference, 'active');
      expect(photoExists).toBe(false);

      // 2. Stale embedding cleaned up
      expect(cleanupSpy).toHaveBeenCalledWith(staleEmbRef);

      // 3. Request reset to clean PENDING state with IDLE journal
      const healedReq = await BiometricUpdateRequestModel.findById(crashedReq._id);
      expect(healedReq!.status).toBe('PENDING');
      expect(healedReq!.journal?.stage).toBe('IDLE');

      // 4. Faculty active profile preserved intact
      const faculty = await UserModel.findById(faculty2Id);
      expect(faculty!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef2);

      await BiometricUpdateRequestModel.findByIdAndDelete(crashedReq._id);
    });

    it('4.2 should reconcile requests interrupted after user commit before request finalization (Heal Forward)', async () => {
      // Simulate crash: User model was updated with new active photo and embedding,
      // but process terminated before BiometricUpdateRequest could be marked APPROVED!
      const newActivePhoto = await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);
      const newActiveEmb = `face_emb_healed_active_${Date.now()}`;

      // Update user to reflect committed state
      const faculty = await UserModel.findById(faculty2Id);
      faculty!.profilePhotoReference = newActivePhoto.reference;
      faculty!.faceEmbeddingReference = newActiveEmb;
      await faculty!.save();

      const crashedReq = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty2Id),
        employeeId: faculty2EmpId,
        candidatePhotoReference: `cand_photo_forward_${uniqueSuffix}.jpg`,
        candidateEmbeddingReference: `cand_emb_forward_${uniqueSuffix}`,
        reason: 'Simulated crash scenario B',
        status: 'PENDING',
        journal: {
          stage: 'USER_COMMITTED',
          promotedPhotoReference: newActivePhoto.reference,
          newEmbeddingReference: newActiveEmb,
          previousPhotoReference: initialActivePhotoRef2,
          previousEmbeddingReference: initialActiveEmbeddingRef2,
          lastAttemptAt: new Date(Date.now() - 300000), // stale
        },
      });

      // Run reconciliation engine
      const reconResult = await adminService.reconcileStaleRequests(60000);

      const reqDetail = reconResult.details.find((d) => d.id === crashedReq._id.toString());
      expect(reqDetail).toBeDefined();
      expect(reqDetail!.action).toBe('HEALED_FORWARD');

      // 1. Request healed forward to APPROVED
      const healedReq = await BiometricUpdateRequestModel.findById(crashedReq._id);
      expect(healedReq!.status).toBe('APPROVED');
      expect(healedReq!.journal?.stage).toBe('COMPLETED');

      // 2. User active enrollment remains intact with new active embedding
      const refreshedFaculty = await UserModel.findById(faculty2Id);
      expect(refreshedFaculty!.faceEmbeddingReference).toBe(newActiveEmb);
      expect(refreshedFaculty!.profilePhotoReference).toBe(newActivePhoto.reference);

      // Clean up fixture
      await profilePhotoStorageService.deletePhoto(newActivePhoto.reference, 'active');
      await BiometricUpdateRequestModel.findByIdAndDelete(crashedReq._id);
    });

    it('4.3 should reconcile requests interrupted during photo promotion (Rollback)', async () => {
      const activePhoto = await profilePhotoStorageService.saveActivePhoto(sampleJpegBuffer);

      const crashedReq = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty2Id),
        employeeId: faculty2EmpId,
        candidatePhotoReference: `cand_photo_${uniqueSuffix}.jpg`,
        candidateEmbeddingReference: `cand_emb_${uniqueSuffix}`,
        reason: 'Simulated crash scenario C',
        status: 'PENDING',
        journal: {
          stage: 'PHOTO_PROMOTED',
          promotedPhotoReference: activePhoto.reference,
          lastAttemptAt: new Date(Date.now() - 300000),
        },
      });

      const reconResult = await adminService.reconcileStaleRequests(60000);
      const reqDetail = reconResult.details.find((d) => d.id === crashedReq._id.toString());
      expect(reqDetail).toBeDefined();
      expect(reqDetail!.action).toBe('ROLLED_BACK');

      // Orphaned photo deleted
      const photoExists = await profilePhotoStorageService.photoExists(activePhoto.reference, 'active');
      expect(photoExists).toBe(false);

      const healedReq = await BiometricUpdateRequestModel.findById(crashedReq._id);
      expect(healedReq!.status).toBe('PENDING');
      expect(healedReq!.journal?.stage).toBe('IDLE');

      await BiometricUpdateRequestModel.findByIdAndDelete(crashedReq._id);
    });
  });

  describe('5. Concurrency & Notification Resilience Testing', () => {
    it('5.1 should prevent concurrent review collisions when two administrators review simultaneously', async () => {
      const stored = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      const testReq = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty1Id),
        employeeId: faculty1EmpId,
        candidatePhotoReference: stored.reference,
        candidateEmbeddingReference: `face_emb_candidate_${faculty1EmpId}_${Date.now()}`,
        reason: 'Concurrent review test fixture',
        status: 'PENDING',
        journal: { stage: 'IDLE' },
      });

      // Fire two concurrent approval calls simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/admin/biometric-update-requests/${testReq._id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ notes: 'Admin 1 Review' }),
        request(app)
          .post(`/api/v1/admin/biometric-update-requests/${testReq._id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ notes: 'Admin 2 Review' }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409); // The second caller must receive 409 Conflict

      // Final state is cleanly APPROVED exactly once
      const finalDoc = await BiometricUpdateRequestModel.findById(testReq._id);
      expect(finalDoc!.status).toBe('APPROVED');

      await BiometricUpdateRequestModel.findByIdAndDelete(testReq._id);
    });

    it('5.2 should not reverse or fail a committed approval if faculty notification service fails', async () => {
      const stored = await profilePhotoStorageService.savePendingPhoto(sampleJpegBuffer);
      const testReq = await BiometricUpdateRequestModel.create({
        facultyId: new mongoose.Types.ObjectId(faculty1Id),
        employeeId: faculty1EmpId,
        candidatePhotoReference: stored.reference,
        candidateEmbeddingReference: `face_emb_candidate_${faculty1EmpId}_${Date.now()}`,
        reason: 'Notification fault test fixture',
        status: 'PENDING',
        journal: { stage: 'IDLE' },
      });

      // Mock notification service throwing an unexpected transport error
      jest.spyOn(notificationService, 'createBiometricNotification').mockRejectedValue(
        new Error('Simulated Redis/Email Transport Connection Failure')
      );

      const res = await request(app)
        .post(`/api/v1/admin/biometric-update-requests/${testReq._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approval must succeed despite notification fault' });

      // Must succeed! Biometric replacement was committed and cannot be rolled back due to notification network blip
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');

      const reqDoc = await BiometricUpdateRequestModel.findById(testReq._id);
      expect(reqDoc!.status).toBe('APPROVED');

      await BiometricUpdateRequestModel.findByIdAndDelete(testReq._id);
    });
  });

  describe('6. Security & Privacy Validation', () => {
    it('6.1 should reject faculty access to admin review queue and candidate details with 403 Forbidden', async () => {
      const resQueue = await request(app)
        .get('/api/v1/admin/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`);
      expect(resQueue.status).toBe(403);

      const resPhoto = await request(app)
        .get('/api/v1/admin/biometric-update-requests/507f1f77bcf86cd799439011/photo')
        .set('Authorization', `Bearer ${faculty1Token}`);
      expect(resPhoto.status).toBe(403);
    });

    it('6.2 should prevent faculty from accessing another faculty members requests', async () => {
      // Faculty 2 fetches their own requests
      const resFaculty2 = await request(app)
        .get('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty2Token}`);

      expect(resFaculty2.status).toBe(200);
      const history = resFaculty2.body.data.history || [];
      // Verify no records from Faculty 1 appear in Faculty 2 history
      history.forEach((h: any) => {
        expect(h.employeeId || '').not.toBe(faculty1EmpId);
      });
    });

    it('6.3 should ensure private filesystem paths and raw embeddings are NEVER exposed in API responses', async () => {
      const resQueue = await request(app)
        .get('/api/v1/admin/biometric-update-requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resQueue.status).toBe(200);
      const jsonString = JSON.stringify(resQueue.body);

      // Verify no absolute disk paths leaked
      expect(jsonString).not.toContain('storage\\profile_photos');
      expect(jsonString).not.toContain('storage/profile_photos');
      expect(jsonString).not.toContain('c:\\');
      expect(jsonString).not.toContain('C:\\');

      // Verify no vector arrays leaked
      expect(jsonString).not.toContain('"embedding":[');
      expect(jsonString).not.toContain('"vector":[');
    });

    it('6.4 should block directory traversal attempts in candidate photo references', async () => {
      const res1 = await profilePhotoStorageService.getPhotoBuffer('../../../etc/passwd', 'pending');
      expect(res1).toBeNull();

      const res2 = await profilePhotoStorageService.getPhotoBuffer('..\\..\\boot.ini', 'active');
      expect(res2).toBeNull();

      const exists = await profilePhotoStorageService.photoExists('../../../etc/passwd', 'pending');
      expect(exists).toBe(false);
    });
  });
});
