import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/db';
import { UserModel } from '../../src/models/User';
import {
  BiometricUpdateRequestModel,
  BiometricUpdateRequestDocument,
} from '../../src/models/BiometricUpdateRequest';
import { biometricUpdateRequestRepository } from '../../src/repositories/biometricUpdateRequest.repository';

describe('BiometricUpdateRequest Model & Database Foundation Tests', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  let testFacultyId: mongoose.Types.ObjectId;
  let testFacultyEmpId: string;
  let testAdminId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();

    // Ensure clean index synchronization
    try {
      await BiometricUpdateRequestModel.collection.dropIndexes();
    } catch {
      // Collection may not exist yet
    }
    await BiometricUpdateRequestModel.syncIndexes();
    await UserModel.init();

    // Create test faculty user
    testFacultyEmpId = `FAC-BIO-${uniqueSuffix}`;
    const facultyDoc = await UserModel.create({
      name: `Dr. Biometric Audit ${uniqueSuffix}`,
      email: `faculty.bio.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhashedpassword123',
      employeeId: testFacultyEmpId,
      role: 'FACULTY',
      department: 'Computer Science',
      isActive: true,
    });
    testFacultyId = facultyDoc._id as mongoose.Types.ObjectId;

    // Create test admin user
    const adminDoc = await UserModel.create({
      name: `Admin Reviewer ${uniqueSuffix}`,
      email: `admin.bio.${uniqueSuffix}@lpu.in`,
      passwordHash: 'dummyhashedpassword123',
      employeeId: `ADM-BIO-${uniqueSuffix}`,
      role: 'ADMIN',
      department: 'Dean Office',
      isActive: true,
    });
    testAdminId = adminDoc._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    // Cleanup test records
    await BiometricUpdateRequestModel.deleteMany({ employeeId: testFacultyEmpId });
    await UserModel.deleteMany({
      email: { $in: [`faculty.bio.${uniqueSuffix}@lpu.in`, `admin.bio.${uniqueSuffix}@lpu.in`] },
    });
    await disconnectDB();
  });

  describe('User Model Profile Photo Extension', () => {
    it('1. should initialize user with null profilePhotoReference and photoUpdatedAt', async () => {
      const user = await UserModel.findById(testFacultyId);
      expect(user).not.toBeNull();
      expect(user!.profilePhotoReference).toBeNull();
      expect(user!.photoUpdatedAt).toBeNull();

      const json = user!.toJSON();
      expect(json.profilePhotoReference).toBeNull();
      expect(json.photoUpdatedAt).toBeNull();
      expect(json.hasProfilePhoto).toBe(false);
    });

    it('2. should persist profilePhotoReference and compute hasProfilePhoto correctly', async () => {
      const testPhotoRef = 'photo_active_12345678-1234-1234-1234-123456789abc.jpg';
      const updatedDate = new Date();

      const updatedUser = await UserModel.findByIdAndUpdate(
        testFacultyId,
        {
          profilePhotoReference: testPhotoRef,
          photoUpdatedAt: updatedDate,
        },
        { new: true }
      );

      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.profilePhotoReference).toBe(testPhotoRef);
      expect(updatedUser!.photoUpdatedAt).toEqual(updatedDate);

      const json = updatedUser!.toJSON();
      expect(json.profilePhotoReference).toBe(testPhotoRef);
      expect(json.photoUpdatedAt).toBeDefined();
      expect(json.hasProfilePhoto).toBe(true);

      // Clean up user profile photo
      await UserModel.findByIdAndUpdate(testFacultyId, {
        profilePhotoReference: null,
        photoUpdatedAt: null,
      });
    });
  });

  describe('BiometricUpdateRequest Model & Validation', () => {
    it('3. should create a valid pending biometric update request', async () => {
      const candidatePhoto = 'photo_pending_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
      const candidateEmb = 'emb_cand_FAC-BIO-001_123456';

      const request = await BiometricUpdateRequestModel.create({
        facultyId: testFacultyId,
        employeeId: testFacultyEmpId,
        candidatePhotoReference: candidatePhoto,
        candidateEmbeddingReference: candidateEmb,
        reason: 'Updated haircut and prescription spectacles.',
      });

      expect(request).not.toBeNull();
      expect(request.status).toBe('PENDING');
      expect(request.candidatePhotoReference).toBe(candidatePhoto);
      expect(request.candidateEmbeddingReference).toBe(candidateEmb);
      expect(request.reason).toBe('Updated haircut and prescription spectacles.');
      expect(request.createdAt).toBeDefined();
      expect(request.updatedAt).toBeDefined();
      expect(request.adminReview).toBeNull();

      // Clean up this request for subsequent tests
      await BiometricUpdateRequestModel.findByIdAndDelete(request._id);
    });

    it('4. should fail validation when required fields are missing', async () => {
      // Missing candidatePhotoReference
      await expect(
        BiometricUpdateRequestModel.create({
          facultyId: testFacultyId,
          employeeId: testFacultyEmpId,
          candidateEmbeddingReference: 'emb_sample',
        })
      ).rejects.toThrow();

      // Missing candidateEmbeddingReference
      await expect(
        BiometricUpdateRequestModel.create({
          facultyId: testFacultyId,
          employeeId: testFacultyEmpId,
          candidatePhotoReference: 'photo_pending_test.jpg',
        })
      ).rejects.toThrow();
    });

    it('5. should reject invalid status values outside enum', async () => {
      await expect(
        BiometricUpdateRequestModel.create({
          facultyId: testFacultyId,
          employeeId: testFacultyEmpId,
          candidatePhotoReference: 'photo_pending_test.jpg',
          candidateEmbeddingReference: 'emb_sample',
          status: 'INVALID_STATUS' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Duplicate Pending Request Prevention (Critical Safety Mechanism)', () => {
    let firstPendingId: mongoose.Types.ObjectId;

    it('6. should allow creating the first pending request for faculty', async () => {
      const firstReq = await BiometricUpdateRequestModel.create({
        facultyId: testFacultyId,
        employeeId: testFacultyEmpId,
        candidatePhotoReference: 'photo_pending_first.jpg',
        candidateEmbeddingReference: 'emb_first_ref',
        reason: 'First pending submission',
      });

      expect(firstReq).not.toBeNull();
      expect(firstReq.status).toBe('PENDING');
      firstPendingId = firstReq._id as mongoose.Types.ObjectId;
    });

    it('7. should REJECT creating a second pending request for the same faculty member with duplicate key error', async () => {
      let duplicateError: any = null;

      try {
        await BiometricUpdateRequestModel.create({
          facultyId: testFacultyId,
          employeeId: testFacultyEmpId,
          candidatePhotoReference: 'photo_pending_second.jpg',
          candidateEmbeddingReference: 'emb_second_ref',
          reason: 'Attempted duplicate pending submission',
        });
      } catch (err: any) {
        duplicateError = err;
      }

      expect(duplicateError).not.toBeNull();
      // MongoDB duplicate key error code is 11000
      expect(duplicateError.code).toBe(11000);
    });

    it('8. should allow creating a new request once previous request is APPROVED or REJECTED', async () => {
      // 1. Resolve first request to REJECTED
      await BiometricUpdateRequestModel.findByIdAndUpdate(firstPendingId, {
        status: 'REJECTED',
        adminReview: {
          adminId: testAdminId,
          adminName: 'Compliance Officer',
          reviewedAt: new Date(),
          notes: 'Lighting was too dark in the photograph.',
        },
      });

      // 2. Now a new PENDING request for the same faculty MUST succeed
      const secondReq = await BiometricUpdateRequestModel.create({
        facultyId: testFacultyId,
        employeeId: testFacultyEmpId,
        candidatePhotoReference: 'photo_pending_retry.jpg',
        candidateEmbeddingReference: 'emb_retry_ref',
        reason: 'Re-submitted with studio lighting.',
      });

      expect(secondReq).not.toBeNull();
      expect(secondReq.status).toBe('PENDING');

      // Verify repository can find current pending request
      const pendingFound = await biometricUpdateRequestRepository.findPendingByFacultyId(testFacultyId);
      expect(pendingFound).not.toBeNull();
      expect(pendingFound!._id.toString()).toBe(secondReq._id.toString());
      expect(pendingFound!.reason).toBe('Re-submitted with studio lighting.');

      // Clean up
      await BiometricUpdateRequestModel.deleteMany({ facultyId: testFacultyId });
    });
  });

  describe('Repository Operations', () => {
    it('9. should paginate pending requests properly', async () => {
      // Create request
      const reqDoc = await biometricUpdateRequestRepository.create({
        facultyId: testFacultyId,
        employeeId: testFacultyEmpId,
        candidatePhotoReference: 'photo_pending_repo_test.jpg',
        candidateEmbeddingReference: 'emb_repo_ref',
        reason: 'Pagination test submission',
      });

      const { requests, total } = await biometricUpdateRequestRepository.findPendingWithPagination(1, 10);
      expect(total).toBeGreaterThanOrEqual(1);
      const found = requests.find((r) => r.employeeId === testFacultyEmpId);
      expect(found).toBeDefined();

      // Update review via repository
      const updated = await biometricUpdateRequestRepository.updateReview(reqDoc._id, 'APPROVED', {
        adminId: testAdminId,
        adminName: 'Dean of Academics',
        reviewedAt: new Date(),
        notes: 'Photo verified and approved.',
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('APPROVED');
      expect(updated!.adminReview?.adminName).toBe('Dean of Academics');

      // Verify pending count decreases
      const pendingFound = await biometricUpdateRequestRepository.findPendingByFacultyId(testFacultyId);
      expect(pendingFound).toBeNull();
    });
  });
});
