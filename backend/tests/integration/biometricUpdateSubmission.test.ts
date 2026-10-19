import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { app } from '../../src/app';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import { BiometricUpdateRequestModel } from '../../src/models/BiometricUpdateRequest';
import { profilePhotoStorageService } from '../../src/services/profilePhotoStorage.service';
import { faceVerificationService } from '../../src/services/faceVerification.service';
import { generateAccessToken } from '../../src/utils/crypto';
import { env } from '../../src/config/env';
import { AppError } from '../../src/utils/apiError';

describe('Phase 10.4 — Faculty Biometric Photo Update Submission API Tests', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);

  let faculty1Id: string;
  let faculty1EmpId: string;
  let faculty1Token: string;
  const initialActiveEmbeddingRef = `face_emb_active_${uniqueSuffix}`;
  const initialActivePhotoRef = `photo_active_original_${uniqueSuffix}.jpg`;

  let faculty2Id: string;
  let faculty2EmpId: string;
  let faculty2Token: string;

  let adminToken: string;

  // 1x1 valid JPEG image buffer & base64
  const validJpegBase64 =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // 1x1 valid PNG image base64
  const validPngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeAll(async () => {
    await connectDB();

    try {
      await BiometricUpdateRequestModel.collection.dropIndexes();
    } catch {
      // collection may not exist yet
    }
    await BiometricUpdateRequestModel.syncIndexes();
    await UserModel.init();

    // 1. Create Faculty 1
    faculty1EmpId = `FAC-SUB1-${uniqueSuffix}`;
    const faculty1Doc = await UserModel.create({
      name: `Dr. Submitter One ${uniqueSuffix}`,
      email: `faculty.sub1.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: faculty1EmpId,
      role: 'FACULTY',
      department: 'Computer Science',
      faceEmbeddingReference: initialActiveEmbeddingRef,
      profilePhotoReference: initialActivePhotoRef,
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
    faculty2EmpId = `FAC-SUB2-${uniqueSuffix}`;
    const faculty2Doc = await UserModel.create({
      name: `Dr. Submitter Two ${uniqueSuffix}`,
      email: `faculty.sub2.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: faculty2EmpId,
      role: 'FACULTY',
      department: 'Mechanical Engineering',
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
    const adminDoc = await UserModel.create({
      name: `Admin Reviewer ${uniqueSuffix}`,
      email: `admin.sub.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhash123',
      employeeId: `ADM-SUB-${uniqueSuffix}`,
      role: 'ADMIN',
      department: 'Registrar Office',
      isActive: true,
    });
    adminToken = generateAccessToken({
      userId: adminDoc._id.toString(),
      email: adminDoc.email,
      role: 'ADMIN',
      employeeId: adminDoc.employeeId,
      name: adminDoc.name,
    });
  });

  afterAll(async () => {
    // Clean up created DB entries
    await BiometricUpdateRequestModel.deleteMany({
      employeeId: { $in: [faculty1EmpId, faculty2EmpId] },
    });
    await UserModel.deleteMany({
      _id: { $in: [faculty1Id, faculty2Id] },
    });
    await disconnectDB();
  });

  describe('1. Authentication and Authorization', () => {
    it('should reject unauthenticated submission with 401', async () => {
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .send({ image: validJpegBase64, reason: 'Unauthenticated test' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-FACULTY role (ADMIN) with 403', async () => {
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ image: validJpegBase64, reason: 'Admin attempting submission' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated request status retrieval with 401', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/biometric-update-requests');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Input & Image Validation', () => {
    it('should reject missing image field with 400', async () => {
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ reason: 'No image provided' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid base64 image data format with 400', async () => {
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ image: 'not-a-valid-data-uri-content-string', reason: 'Invalid format' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSUPPORTED_IMAGE_FORMAT');
    });

    it('should reject non-image mime types masquerading as image with 400', async () => {
      const textBase64 = 'data:image/jpeg;base64,' + Buffer.from('Plain text file content, not an image').toString('base64');
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ image: textBase64, reason: 'Corrupt magic bytes' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSUPPORTED_IMAGE_FORMAT');
    });

    it('should reject oversized image exceeding 5MB limit with 400', async () => {
      const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024);
      const oversizedBase64 = 'data:image/jpeg;base64,' + oversizedBuffer.toString('base64');

      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({ image: oversizedBase64, reason: 'Oversized photo' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('IMAGE_TOO_LARGE');
    });
  });

  describe('3. Successful Submission & Biometric Safety Rules', () => {
    let createdRequestId: string;

    it('should accept valid photo submission, store in pending vault, and return safe metadata', async () => {
      const checkFaceSpy = jest
        .spyOn(faceVerificationService, 'checkFace')
        .mockResolvedValueOnce({ valid: true, qualityScore: 0.95, message: 'Valid face photograph' });

      const registerFaceSpy = jest
        .spyOn(faceVerificationService, 'registerFace')
        .mockResolvedValueOnce('candidate_emb_sub1_test123');

      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({
          image: validJpegBase64,
          reason: 'Updated haircut and spectacles for academic year.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.employeeId).toBe(faculty1EmpId);
      expect(data.status).toBe('PENDING');
      expect(data.reason).toBe('Updated haircut and spectacles for academic year.');
      expect(data.createdAt).toBeDefined();
      expect(data.message).toContain('administrator review');

      // CRITICAL: Verify NO sensitive filesystem paths, image base64, or embeddings are returned in response
      expect(data.candidatePhotoReference).toBeUndefined();
      expect(data.candidateEmbeddingReference).toBeUndefined();
      expect(data.image).toBeUndefined();
      expect(data.filePath).toBeUndefined();

      createdRequestId = data.id;

      // Verify DB record
      const dbRecord = await BiometricUpdateRequestModel.findById(createdRequestId);
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.status).toBe('PENDING');
      expect(dbRecord!.facultyId.toString()).toBe(faculty1Id);
      expect(dbRecord!.employeeId).toBe(faculty1EmpId);
      expect(dbRecord!.candidatePhotoReference).toMatch(/^photo_pending_[a-f0-9-]+\.(jpe?g|png|webp)$/i);
      expect(dbRecord!.candidateEmbeddingReference).toMatch(/^candidate_/);

      // Verify file was written to private pending storage vault
      const storageDir = env.PROFILE_PHOTO_STORAGE_PATH;
      const pendingFilePath = path.join(storageDir, 'pending', dbRecord!.candidatePhotoReference);
      expect(fs.existsSync(pendingFilePath)).toBe(true);

      checkFaceSpy.mockRestore();
      registerFaceSpy.mockRestore();
    });

    it('CRITICAL SAFETY RULE: active user enrollment must NOT be modified during submission', async () => {
      const user = await UserModel.findById(faculty1Id);
      expect(user).not.toBeNull();

      // Active face embedding reference must remain completely unchanged
      expect(user!.faceEmbeddingReference).toBe(initialActiveEmbeddingRef);

      // Active profile photo reference must remain completely unchanged
      expect(user!.profilePhotoReference).toBe(initialActivePhotoRef);
    });

    it('should enforce duplicate pending request rejection with 409', async () => {
      // Submitting while previous request is still PENDING
      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`)
        .send({
          image: validPngBase64,
          reason: 'Second submission attempt while pending',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_PENDING_REQUEST');
      expect(res.body.error.message).toContain('already have a biometric photo update request pending');
    });
  });

  describe('4. Request Status & History API', () => {
    it('should return pending request status and submission history for authenticated faculty', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasPendingRequest).toBe(true);
      expect(res.body.data.pendingRequest).not.toBeNull();
      expect(res.body.data.pendingRequest.status).toBe('PENDING');
      expect(res.body.data.pendingRequest.reason).toBe('Updated haircut and spectacles for academic year.');
      expect(res.body.data.history).toHaveLength(1);

      // Safe fields check
      const historyItem = res.body.data.history[0];
      expect(historyItem.id).toBeDefined();
      expect(historyItem.status).toBe('PENDING');
      expect(historyItem.candidatePhotoReference).toBeUndefined();
      expect(historyItem.candidateEmbeddingReference).toBeUndefined();
    });

    it('FACULTY ISOLATION: Faculty 2 should see empty history and no pending request', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasPendingRequest).toBe(false);
      expect(res.body.data.pendingRequest).toBeNull();
      expect(res.body.data.history).toEqual([]);
    });
  });

  describe('5. Error Handling & Rollback on Failure', () => {
    it('should rollback saved photo if face registration fails', async () => {
      // First clean up any pending request from faculty 2
      await BiometricUpdateRequestModel.deleteMany({ facultyId: faculty2Id });

      // checkFace passes
      const checkFaceSpy = jest
        .spyOn(faceVerificationService, 'checkFace')
        .mockResolvedValueOnce({ valid: true, qualityScore: 0.95, message: 'Valid face photograph' });

      // registerFace fails with 400 AppError
      const registerFaceSpy = jest
        .spyOn(faceVerificationService, 'registerFace')
        .mockRejectedValueOnce(
          new AppError(400, 'FACE_NOT_FOUND', 'No face detected in submitted photograph')
        );

      // Count files in pending vault before
      const pendingVault = path.join(env.PROFILE_PHOTO_STORAGE_PATH, 'pending');
      const filesBefore = fs.existsSync(pendingVault) ? fs.readdirSync(pendingVault).length : 0;

      const res = await request(app)
        .post('/api/v1/faculty/biometric-update-requests')
        .set('Authorization', `Bearer ${faculty2Token}`)
        .send({
          image: validJpegBase64,
          reason: 'Photo with simulated face validation failure',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FACE_NOT_FOUND');
      expect(res.body.error.message).toContain('No face detected in submitted photograph');

      // Verify no orphaned pending file was left on disk
      const filesAfter = fs.existsSync(pendingVault) ? fs.readdirSync(pendingVault).length : 0;
      expect(filesAfter).toBe(filesBefore);

      // Verify no DB record was created
      const pendingDoc = await BiometricUpdateRequestModel.findOne({ facultyId: faculty2Id });
      expect(pendingDoc).toBeNull();

      checkFaceSpy.mockRestore();
      registerFaceSpy.mockRestore();
    });
  });
});
