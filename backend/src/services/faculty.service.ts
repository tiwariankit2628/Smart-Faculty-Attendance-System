import { Types } from 'mongoose';
import { userRepository } from '../repositories/user.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { biometricUpdateRequestRepository } from '../repositories/biometricUpdateRequest.repository';
import { faceVerificationService } from './faceVerification.service';
import { profilePhotoStorageService } from './profilePhotoStorage.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/apiError';
import { CreateBiometricUpdateRequestInput } from '../validators/faculty.validator';

export class FacultyService {
  async getProfile(facultyId: string) {
    const user = await userRepository.findById(facultyId);
    if (!user) {
      throw AppError.notFound('Faculty profile not found.', 'FACULTY_NOT_FOUND');
    }
    return user.toJSON();
  }

  async getAttendanceHistory(facultyId: string, limit = 60) {
    const records = await attendanceRepository.findByFacultyId(facultyId, limit);
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = records.find((r) => r.date === today) || null;

    return {
      records,
      hasMarkedToday: !!todayRecord,
      todayRecord,
      totalRecords: records.length,
    };
  }

  async registerFace(facultyId: string, imageBase64: string, requestId?: string) {
    const user = await userRepository.findById(facultyId);
    if (!user) {
      throw AppError.notFound('Faculty user not found.', 'FACULTY_NOT_FOUND');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Inactive faculty cannot register biometrics.', 'ACCOUNT_INACTIVE');
    }

    // Security Hardening: Initial face enrollment is allowed ONLY once per faculty.
    // Overwriting an existing biometric profile requires administrator approval.
    if (user.faceEmbeddingReference) {
      throw AppError.forbidden(
        'Facial profile is already enrolled. Re-enrollment requires administrator approval.',
        'BIOMETRICS_ALREADY_REGISTERED'
      );
    }

    // Call Python Face Verification Service
    const faceReference = await faceVerificationService.registerFace(user.employeeId, imageBase64);

    // Save reference in MongoDB
    user.faceEmbeddingReference = faceReference;
    await user.save();

    await auditService.logAction(
      facultyId,
      'FACE_REGISTRATION_SUCCESS',
      requestId,
      { employeeId: user.employeeId, referenceId: faceReference }
    );

    return {
      registered: true,
      employeeId: user.employeeId,
      message: 'Facial biometrics registered successfully.',
    };
  }

  /**
   * Phase 10.4: Submits a new candidate biometric photo for administrator review.
   * Generates a candidate embedding under an isolated ID without modifying the active profile.
   * Stores the photo in private pending storage and rolls back all resources on any failure.
   */
  async createBiometricUpdateRequest(
    facultyId: string,
    input: CreateBiometricUpdateRequestInput,
    requestId?: string
  ) {
    const user = await userRepository.findById(facultyId);
    if (!user) {
      throw AppError.notFound('Faculty user not found.', 'FACULTY_NOT_FOUND');
    }

    if (!user.isActive) {
      throw AppError.forbidden(
        'Inactive faculty account cannot submit biometric update requests.',
        'ACCOUNT_INACTIVE'
      );
    }

    // 1. Prevent duplicate pending requests
    const existingPending = await biometricUpdateRequestRepository.findPendingByFacultyId(facultyId);
    if (existingPending) {
      throw AppError.conflict(
        'You already have a biometric photo update request pending administrator approval.',
        'DUPLICATE_PENDING_REQUEST'
      );
    }

    // 2. Decode and validate image buffer bytes
    let imageBuffer: Buffer;
    try {
      const cleanBase64 = input.image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    } catch {
      throw AppError.badRequest('Invalid base64 image data payload.', 'INVALID_IMAGE');
    }

    // Validates permitted formats (JPEG, PNG, WEBP) and 5MB size limit
    profilePhotoStorageService.validateImageBuffer(imageBuffer);

    // 3. Face verification pipeline validation (quality, face presence, anti-spoof liveness)
    // Rejects blurry, poorly lit, multi-face, or spoofed images before file storage
    await faceVerificationService.checkFace(input.image);

    // 4. Save candidate photo to private pending storage vault
    const storedPhoto = await profilePhotoStorageService.savePendingPhoto(imageBuffer);

    // 5. Generate candidate biometric embedding under an isolated candidate ID
    // CRITICAL: candidate ID ensures it CANNOT overwrite the active faculty embedding!
    const candidateId = `candidate_${user.employeeId}_${Date.now()}`;
    let candidateEmbeddingRef: string;
    try {
      candidateEmbeddingRef = await faceVerificationService.registerFace(candidateId, input.image);
    } catch (faceErr) {
      // Rollback stored photo file on candidate embedding extraction failure
      await profilePhotoStorageService.deletePhoto(storedPhoto.reference, 'pending');
      throw faceErr;
    }

    // 6. Persist BiometricUpdateRequest in MongoDB
    let newRequest: any;
    try {
      newRequest = await biometricUpdateRequestRepository.create({
        facultyId: user._id,
        employeeId: user.employeeId,
        candidatePhotoReference: storedPhoto.reference,
        candidateEmbeddingReference: candidateEmbeddingRef,
        reason: (input.reason || '').trim(),
        status: 'PENDING',
      });
    } catch (dbErr: any) {
      // Rollback stored photo file on database failure
      await profilePhotoStorageService.deletePhoto(storedPhoto.reference, 'pending');
      if (dbErr.code === 11000) {
        throw AppError.conflict(
          'You already have a biometric photo update request pending administrator approval.',
          'DUPLICATE_PENDING_REQUEST'
        );
      }
      throw dbErr;
    }

    // 7. Audit logging
    await auditService.logAction(
      facultyId,
      'BIOMETRIC_UPDATE_REQUESTED',
      requestId,
      {
        updateRequestId: newRequest._id.toString(),
        employeeId: user.employeeId,
        candidatePhotoReference: storedPhoto.reference,
        reason: newRequest.reason,
      }
    );

    // 8. Return safe response metadata only (no filesystem paths, no embeddings)
    return {
      id: newRequest._id.toString(),
      employeeId: newRequest.employeeId,
      status: newRequest.status,
      reason: newRequest.reason,
      createdAt: newRequest.createdAt,
      message: 'Biometric photo update request submitted successfully. It is now awaiting administrator review.',
    };
  }

  /**
   * Phase 10.4: Retrieves the current faculty member's update-request history and pending status.
   * Faculty identity is strictly derived from the authenticated session token.
   */
  async getBiometricUpdateRequests(facultyId: string) {
    const requests = await biometricUpdateRequestRepository.findByFacultyId(facultyId);
    const pendingRequest = requests.find((r) => r.status === 'PENDING') || null;

    return {
      hasPendingRequest: Boolean(pendingRequest),
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest._id.toString(),
            status: pendingRequest.status,
            reason: pendingRequest.reason,
            createdAt: pendingRequest.createdAt,
            updatedAt: pendingRequest.updatedAt,
          }
        : null,
      history: requests.map((r) => ({
        id: r._id.toString(),
        status: r.status,
        reason: r.reason,
        adminReview: r.adminReview
          ? {
              adminName: r.adminReview.adminName,
              reviewedAt: r.adminReview.reviewedAt,
              notes: r.adminReview.notes,
            }
          : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }
}

export const facultyService = new FacultyService();
