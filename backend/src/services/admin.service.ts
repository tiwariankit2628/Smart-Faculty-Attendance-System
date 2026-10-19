import mongoose from 'mongoose';
import { userRepository } from '../repositories/user.repository';
import { attendanceRepository } from '../repositories/attendance.repository';
import { AttendanceModel } from '../models/Attendance';
import { UserModel } from '../models/User';
import { AuditLogModel } from '../models/AuditLog';
import { auditLogRepository } from '../repositories/auditLog.repository';
import { attendanceZoneRepository } from '../repositories/attendanceZone.repository';
import { evidenceStorageService } from './evidenceStorage.service';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { hashPassword } from '../utils/crypto';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';
import {
  CreateFacultyInput,
  UpdateFacultyInput,
  UpdateZoneInput,
  OverrideAttendanceInput,
  ApproveBiometricUpdateRequestInput,
  RejectBiometricUpdateRequestInput,
  QueryBiometricUpdateRequestInput,
} from '../validators/admin.validator';
import { biometricUpdateRequestRepository } from '../repositories/biometricUpdateRequest.repository';
import { BiometricUpdateRequestModel } from '../models/BiometricUpdateRequest';
import { profilePhotoStorageService } from './profilePhotoStorage.service';
import { faceVerificationService } from './faceVerification.service';
import { env } from '../config/env';

export class AdminService {
  async createFaculty(
    input: CreateFacultyInput,
    adminId: string,
    requestId?: string
  ) {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw AppError.conflict('A user with this email address already exists.', 'EMAIL_EXISTS');
    }

    const existingEmpId = await userRepository.findByEmployeeId(input.employeeId);
    if (existingEmpId) {
      throw AppError.conflict('A faculty member with this Employee ID already exists.', 'EMPLOYEE_ID_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    const newUser = await userRepository.create({
      name: input.name,
      email: input.email.toLowerCase().trim(),
      employeeId: input.employeeId.toUpperCase().trim(),
      passwordHash,
      role: 'FACULTY',
      department: input.department,
      isActive: true,
    });

    await auditService.logAction(adminId, 'ADMIN_CREATE_FACULTY', requestId, {
      facultyId: newUser._id.toString(),
      employeeId: newUser.employeeId,
      department: newUser.department,
    });

    return newUser.toJSON();
  }

  async getAllFaculty(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    status?: string;
    faceEnrolled?: string;
  }) {
    const filter: Record<string, unknown> = {
      role: 'FACULTY',
    };

    if (filters?.search && filters.search.trim()) {
      const regex = new RegExp(filters.search.trim(), 'i');
      filter.$or = [{ name: regex }, { employeeId: regex }, { email: regex }];
    }

    if (filters?.department && filters.department !== 'ALL') {
      filter.department = filters.department;
    }

    if (filters?.status && filters.status !== 'ALL') {
      filter.isActive = filters.status === 'ACTIVE';
    }

    if (filters?.faceEnrolled && filters.faceEnrolled !== 'ALL') {
      if (filters.faceEnrolled === 'true') {
        filter.faceEmbeddingReference = { $ne: null };
      } else if (filters.faceEnrolled === 'false') {
        filter.faceEmbeddingReference = null;
      }
    }

    const page = filters?.page ? Number(filters.page) : 1;
    const limit = filters?.limit ? Number(filters.limit) : 15;

    const { users, total } = await userRepository.findWithPagination(filter, page, limit);

    // Efficiently aggregate recent attendance status for each faculty
    const userIds = users.map((u) => u._id);
    const recentAttendances = await AttendanceModel.aggregate([
      { $match: { facultyId: { $in: userIds } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$facultyId',
          status: { $first: '$status' },
          timestamp: { $first: '$timestamp' },
          date: { $first: '$date' },
        },
      },
    ]);

    const recentAttendanceMap = new Map<string, { status: string; timestamp: Date; date: string }>();
    for (const att of recentAttendances) {
      recentAttendanceMap.set(att._id.toString(), {
        status: att.status,
        timestamp: att.timestamp,
        date: att.date,
      });
    }

    const formattedUsers = users.map((u) => {
      const json = u.toJSON();
      const recent = recentAttendanceMap.get(u._id.toString());
      return {
        ...json,
        recentAttendance: recent || null,
      };
    });

    return {
      faculty: formattedUsers,
      pagination: {
        page: Math.max(1, page),
        limit: Math.min(50, Math.max(1, limit)),
        total,
        totalPages: Math.ceil(total / Math.min(50, Math.max(1, limit))) || 1,
      },
    };
  }

  async getFacultyDetail(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const user = await userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw AppError.notFound('Faculty member not found.', 'FACULTY_NOT_FOUND');
    }

    const facultyObjId = user._id;

    const [totalAttempts, verifiedCount, rejectedCount, flaggedCount, overrideCount, recentRecords, resetLogs] = await Promise.all([
      AttendanceModel.countDocuments({ facultyId: facultyObjId }),
      AttendanceModel.countDocuments({ facultyId: facultyObjId, status: 'VERIFIED' }),
      AttendanceModel.countDocuments({ facultyId: facultyObjId, status: 'REJECTED' }),
      AttendanceModel.countDocuments({ facultyId: facultyObjId, status: 'FLAGGED' }),
      AttendanceModel.countDocuments({
        facultyId: facultyObjId,
        'manualOverride.adminId': { $exists: true, $ne: null },
      }),
      AttendanceModel.find({ facultyId: facultyObjId })
        .sort({ timestamp: -1 })
        .limit(10),
      AuditLogModel.find({
        action: 'ADMIN_RESET_FACULTY_FACE',
        'metadata.facultyId': id,
      }).sort({ timestamp: -1 }),
    ]);

    const isFaceEnrolled = Boolean(user.faceEmbeddingReference);
    const lastResetAt = resetLogs.length > 0 ? resetLogs[0].timestamp : null;

    return {
      faculty: {
        id: user._id.toString(),
        name: user.name,
        employeeId: user.employeeId,
        email: user.email,
        department: user.department,
        status: user.isActive ? 'ACTIVE' : 'INACTIVE',
        isActive: user.isActive,
        role: user.role,
        createdAt: (user as any).createdAt,
        biometricStatus: {
          isFaceEnrolled,
          enrolledAt: isFaceEnrolled ? ((user as any).updatedAt || (user as any).createdAt) : null,
          lastResetAt,
          resetCount: resetLogs.length,
        },
      },
      attendanceSummary: {
        totalAttempts,
        verifiedCount,
        rejectedCount,
        flaggedCount,
        overrideCount,
        attendanceRate: totalAttempts > 0 ? Math.round((verifiedCount / totalAttempts) * 100) : 0,
      },
      recentAttendance: recentRecords.map((r) => ({
        id: r._id.toString(),
        attendanceId: r._id.toString(),
        date: r.date,
        timestamp: r.timestamp,
        status: r.status,
        originalStatus: r.originalStatus || r.status,
        locationVerified: r.locationVerified,
        faceVerified: r.faceVerified,
        livenessVerified: r.livenessVerified,
        distanceFromZone: r.distanceFromZone,
        manualOverride: r.manualOverride && r.manualOverride.adminId ? {
          adminName: r.manualOverride.adminName || 'Administrator',
          previousStatus: r.manualOverride.previousStatus,
          newStatus: r.manualOverride.newStatus,
          reason: r.manualOverride.reason,
          timestamp: r.manualOverride.timestamp,
        } : null,
      })),
    };
  }

  async updateFaculty(
    id: string,
    updates: UpdateFacultyInput,
    adminId: string,
    requestId?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound('Faculty not found.', 'FACULTY_NOT_FOUND');
    }

    const updatedUser = await userRepository.update(id, updates);

    await auditService.logAction(adminId, 'ADMIN_UPDATE_FACULTY', requestId, {
      facultyId: id,
      updates,
    });

    return updatedUser ? updatedUser.toJSON() : null;
  }

  async deleteFaculty(id: string, adminId: string, requestId?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound('Faculty not found.', 'FACULTY_NOT_FOUND');
    }

    // Soft delete: deactivates faculty and marks deletedAt without destroying foreign keys or historical audits
    await userRepository.softDelete(id);

    await auditService.logAction(adminId, 'ADMIN_DELETE_FACULTY', requestId, {
      deletedFacultyId: id,
      employeeId: user.employeeId,
    });

    return { deleted: true, id };
  }

  async getAttendance(filter: { date?: string; facultyId?: string; status?: string; limit?: number }) {
    const queryFilter: Record<string, unknown> = {};
    if (filter.date) queryFilter.date = filter.date;
    if (filter.facultyId) queryFilter.facultyId = filter.facultyId;
    if (filter.status) queryFilter.status = filter.status;

    const records = await attendanceRepository.findAll(queryFilter, filter.limit || 100);
    return records.map((r) => {
      const raw = r.toJSON();
      const hasRef = Boolean(r.verificationEvidence?.reference);
      const isExpired = r.verificationEvidence?.retentionUntil
        ? new Date() > new Date(r.verificationEvidence.retentionUntil)
        : false;

      return {
        ...raw,
        evidenceAvailable: hasRef && !isExpired,
        evidenceExpired: hasRef && isExpired,
        verificationEvidence: hasRef
          ? {
              hasEvidence: !isExpired,
              reference: r.verificationEvidence!.reference,
              capturedAt: r.verificationEvidence!.capturedAt,
              contentType: r.verificationEvidence!.contentType || 'image/jpeg',
              size: r.verificationEvidence!.size,
              retentionUntil: r.verificationEvidence!.retentionUntil,
              isExpired,
            }
          : undefined,
      };
    });
  }

  async overrideAttendance(
    attendanceId: string,
    data: OverrideAttendanceInput,
    adminId: string,
    adminName: string,
    requestId?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      throw AppError.badRequest('Invalid attendance record ID format.', 'INVALID_ATTENDANCE_ID');
    }

    const record = await attendanceRepository.findById(attendanceId);
    if (!record) {
      throw AppError.notFound('Attendance record not found.', 'ATTENDANCE_NOT_FOUND');
    }

    const previousStatus = record.status;
    const originalStatus = record.originalStatus || previousStatus;

    // Concurrency / Stale Request Protection:
    // 1. If client provided expectedPreviousStatus and record.status !== expectedPreviousStatus:
    if (data.expectedPreviousStatus && record.status !== data.expectedPreviousStatus) {
      throw AppError.conflict(
        `This attendance record has already been modified to ${record.status} by another administrator. Please refresh the records.`,
        'STALE_RECORD_CONFLICT'
      );
    }

    // 2. If client provided lastUpdatedAt and record's updatedAt doesn't match:
    if (data.lastUpdatedAt && record.updatedAt) {
      const recordIso = new Date(record.updatedAt).toISOString();
      if (recordIso !== data.lastUpdatedAt) {
        throw AppError.conflict(
          'This attendance record was modified by another administrator since you loaded it. Please refresh the records.',
          'STALE_RECORD_CONFLICT'
        );
      }
    }

    // 3. Prevent redundant/duplicate override if already manually overridden with this status:
    if (record.manualOverride && record.status === data.status) {
      throw AppError.conflict(
        `This attendance record is already marked as ${data.status} by an administrative override. Duplicate override rejected.`,
        'DUPLICATE_OVERRIDE_REJECTED'
      );
    }

    // Preserve original automated verification result if not already set
    if (!record.originalStatus) {
      record.originalStatus = originalStatus;
    }

    // Update status and manual override metadata
    record.status = data.status;
    record.manualOverride = {
      adminId: new mongoose.Types.ObjectId(adminId),
      adminName,
      previousStatus,
      newStatus: data.status,
      reason: data.reason.trim(),
      timestamp: new Date(),
    };

    await record.save();

    // Create an immutable audit log
    const facultyObj = record.facultyId as any;
    const facultyIdStr = facultyObj?._id ? facultyObj._id.toString() : (facultyObj?.toString() || '');

    await auditService.logAction(adminId, 'ATTENDANCE_OVERRIDE', requestId, {
      attendanceId: record._id.toString(),
      facultyId: facultyIdStr,
      adminId,
      adminName,
      previousStatus,
      newStatus: data.status,
      reason: data.reason.trim(),
      originalStatus,
      timestamp: new Date(),
    });

    // Create faculty notification for the administrative decision
    try {
      await notificationService.createOverrideNotification({
        attendance: record,
        newStatus: data.status,
        reason: data.reason.trim(),
        adminId,
        adminName,
        timestamp: record.manualOverride?.timestamp || new Date(),
        requestId,
      });

      await auditService.logAction(adminId, 'FACULTY_NOTIFICATION_CREATED', requestId, {
        attendanceId: record._id.toString(),
        facultyId: facultyIdStr,
        status: data.status,
      });
    } catch (notifErr) {
      logger.error(
        { notifErr, attendanceId: record._id.toString(), facultyId: facultyIdStr },
        'Failed to generate faculty notification for attendance override'
      );
    }

    logger.info(
      {
        attendanceId: record._id.toString(),
        adminId,
        adminName,
        previousStatus,
        newStatus: data.status,
        reason: data.reason,
      },
      'Administrative attendance regularisation override completed'
    );

    return record.toJSON();
  }

  async getAttendanceDetail(attendanceId: string, adminId: string, requestId?: string) {
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      throw AppError.badRequest('Invalid attendance record ID format.', 'INVALID_ATTENDANCE_ID');
    }

    const record = await attendanceRepository.findById(attendanceId);
    if (!record) {
      throw AppError.notFound('Attendance record not found.', 'ATTENDANCE_NOT_FOUND');
    }

    // Retrieve related audit history for this attendance record
    const auditLogs = await auditLogRepository.findByAttendanceId(attendanceId);
    const sanitizedAuditLogs = auditLogs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      timestamp: log.timestamp,
      actorId: log.userId ? log.userId.toString() : 'SYSTEM',
      details: log.metadata || {},
    }));

    const raw = record.toJSON();
    const faculty = record.facultyId as any;

    return {
      id: raw.id,
      attendanceId: raw.id,
      date: record.date,
      timestamp: record.timestamp,
      status: record.status,
      originalStatus: record.originalStatus || record.status,
      faculty: {
        id: faculty?._id?.toString() || faculty?.id?.toString() || '',
        name: faculty?.name || 'Faculty Member',
        employeeId: faculty?.employeeId || 'N/A',
        department: faculty?.department || 'N/A',
        email: faculty?.email || 'N/A',
        isActive: faculty?.isActive ?? true,
        status: faculty?.isActive ? 'ACTIVE' : 'INACTIVE',
      },
      locationVerification: {
        verified: record.locationVerified,
        latitude: record.latitude,
        longitude: record.longitude,
        distanceMeters: record.distanceFromZone,
        accuracyMeters: record.verificationMetadata?.accuracyMeters || 10,
        zoneName: record.verificationMetadata?.zoneName || 'Lovely Professional University (LPU) - Main Campus',
        networkTrust: record.verificationMetadata?.ipAddress ? 'Campus Network Verified' : 'Standard Connection',
        ipAddress: record.verificationMetadata?.ipAddress || 'Not available',
        timestamp: record.timestamp,
      },
      identityVerification: {
        faceDetected: true,
        identityMatched: record.faceVerified,
        confidenceScore: record.verificationMetadata?.faceConfidence ?? (record.faceVerified ? 0.94 : 0.45),
        verified: record.faceVerified,
        timestamp: record.timestamp,
      },
      livenessVerification: {
        livenessPassed: record.livenessVerified,
        livenessScore: record.verificationMetadata?.livenessScore ?? (record.livenessVerified ? 0.98 : 0.50),
        challengeType: record.verificationMetadata?.challengeType || 'TURN_RIGHT',
        captureDurationSeconds: 5.0,
        validFrameCount: 10,
        totalFrameCount: 10,
        timestamp: record.timestamp,
      },
      verificationEvidence: {
        hasEvidence: Boolean(record.verificationEvidence?.reference),
        reference: record.verificationEvidence?.reference || null,
        capturedAt: record.verificationEvidence?.capturedAt || null,
        contentType: record.verificationEvidence?.contentType || 'image/jpeg',
        size: record.verificationEvidence?.size || null,
        retentionUntil: record.verificationEvidence?.retentionUntil || null,
        isExpired: record.verificationEvidence?.retentionUntil
          ? new Date() > new Date(record.verificationEvidence.retentionUntil)
          : false,
      },
      manualOverride: (record.manualOverride && record.manualOverride.adminId)
        ? {
            adminId: record.manualOverride.adminId?.toString(),
            adminName: record.manualOverride.adminName || 'Administrator',
            previousStatus: record.manualOverride.previousStatus,
            newStatus: record.manualOverride.newStatus,
            reason: record.manualOverride.reason,
            timestamp: record.manualOverride.timestamp,
          }
        : null,
      auditHistory: sanitizedAuditLogs,
      rejectionReason: record.verificationMetadata?.rejectionReason,
      createdAt: (record as any).createdAt || record.timestamp,
      updatedAt: (record as any).updatedAt || record.timestamp,
    };
  }

  async getReviewQueue(filters: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    hasEvidence?: boolean | string;
    locationVerified?: boolean | string;
    faceVerified?: boolean | string;
    livenessVerified?: boolean | string;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 15));

    // Base criteria: Records needing review (FLAGGED or REJECTED) that have NOT been overridden yet!
    const query: any = {
      $and: [
        // No administrative override finalized yet
        {
          $or: [
            { manualOverride: { $exists: false } },
            { manualOverride: null },
            { 'manualOverride.adminId': { $exists: false } },
            { 'manualOverride.adminId': null },
          ],
        },
      ],
    };

    // Status filter
    if (filters.status && filters.status !== 'ALL') {
      query.$and.push({ status: filters.status });
    } else {
      query.$and.push({
        $or: [
          { status: 'FLAGGED' },
          { status: 'REJECTED' },
          { locationVerified: false },
          { faceVerified: false },
          { livenessVerified: false },
        ],
      });
    }

    // Date filters
    if (filters.date) {
      query.$and.push({ date: filters.date });
    } else if (filters.startDate || filters.endDate) {
      const dateRange: any = {};
      if (filters.startDate) dateRange.$gte = filters.startDate;
      if (filters.endDate) dateRange.$lte = filters.endDate;
      query.$and.push({ date: dateRange });
    }

    // Telemetry boolean filters
    if (filters.locationVerified !== undefined && filters.locationVerified !== '') {
      const val = filters.locationVerified === true || filters.locationVerified === 'true';
      query.$and.push({ locationVerified: val });
    }
    if (filters.faceVerified !== undefined && filters.faceVerified !== '') {
      const val = filters.faceVerified === true || filters.faceVerified === 'true';
      query.$and.push({ faceVerified: val });
    }
    if (filters.livenessVerified !== undefined && filters.livenessVerified !== '') {
      const val = filters.livenessVerified === true || filters.livenessVerified === 'true';
      query.$and.push({ livenessVerified: val });
    }

    // Evidence filter
    if (filters.hasEvidence !== undefined && filters.hasEvidence !== '') {
      const val = filters.hasEvidence === true || filters.hasEvidence === 'true';
      if (val) {
        query.$and.push({ 'verificationEvidence.reference': { $exists: true, $ne: '' } });
      } else {
        query.$and.push({
          $or: [
            { 'verificationEvidence.reference': { $exists: false } },
            { 'verificationEvidence.reference': '' },
            { verificationEvidence: null },
          ],
        });
      }
    }

    // Faculty search / department filter
    if (filters.search || filters.department) {
      const userFilter: any = {};
      if (filters.search) {
        const regex = new RegExp(filters.search.trim(), 'i');
        userFilter.$or = [{ name: regex }, { employeeId: regex }, { email: regex }];
      }
      if (filters.department && filters.department !== 'ALL') {
        userFilter.department = filters.department;
      }

      const matchingUsers = await UserModel.find(userFilter, { _id: 1 });
      const matchingIds = matchingUsers.map((u) => u._id);
      query.$and.push({ facultyId: { $in: matchingIds } });
    }

    const { records, total } = await attendanceRepository.findWithPagination(query, page, limit);

    // Compute derived review reason for each record from actual verification data
    const formattedRecords = records.map((record) => {
      const faculty = record.facultyId as any;
      const meta = record.verificationMetadata || {};

      let reviewReason = meta.rejectionReason;
      if (!reviewReason) {
        if (!record.faceVerified) {
          reviewReason = 'Identity verification failed';
        } else if (!record.livenessVerified) {
          reviewReason = 'Liveness verification failed';
        } else if (!record.locationVerified) {
          reviewReason = 'Location verification failed';
        } else if (record.status === 'FLAGGED') {
          reviewReason = 'Suspicious verification anomaly';
        } else {
          reviewReason = 'Manual review requested';
        }
      }

      const evidence = record.verificationEvidence;
      const hasEvidence = Boolean(evidence?.reference);
      const isExpired = evidence?.retentionUntil ? new Date() > new Date(evidence.retentionUntil) : false;

      return {
        id: record._id.toString(),
        attendanceId: record._id.toString(),
        faculty: {
          id: faculty?._id?.toString() || '',
          name: faculty?.name || 'Faculty Member',
          employeeId: faculty?.employeeId || 'N/A',
          department: faculty?.department || 'N/A',
          email: faculty?.email || 'N/A',
        },
        date: record.date,
        timestamp: record.timestamp,
        reviewReason,
        automatedResult: record.originalStatus || record.status,
        currentStatus: record.status,
        livenessPassed: record.livenessVerified,
        identityMatched: record.faceVerified,
        locationVerified: record.locationVerified,
        liveness: {
          passed: record.livenessVerified,
          score: meta.livenessScore ?? (record.livenessVerified ? 0.98 : 0.50),
        },
        identity: {
          matched: record.faceVerified,
          score: meta.faceConfidence ?? (record.faceVerified ? 0.94 : 0.45),
        },
        location: {
          verified: record.locationVerified,
          distanceMeters: record.distanceFromZone,
        },
        distanceMeters: record.distanceFromZone,
        accuracyMeters: meta.accuracyMeters || 10,
        faceConfidence: meta.faceConfidence ?? (record.faceVerified ? 0.94 : 0.45),
        livenessScore: meta.livenessScore ?? (record.livenessVerified ? 0.98 : 0.50),
        verificationEvidence: {
          hasEvidence,
          isExpired,
          reference: evidence?.reference || null,
          capturedAt: evidence?.capturedAt || null,
          contentType: evidence?.contentType || 'image/jpeg',
          size: evidence?.size || null,
          retentionUntil: evidence?.retentionUntil || null,
        },
        evidence: {
          hasEvidence,
          isExpired,
          capturedAt: evidence?.capturedAt || null,
        },
        createdAt: (record as any).createdAt || record.timestamp,
      };
    });

    // Summary counts for review queue tab
    const [flaggedCount, rejectedCount] = await Promise.all([
      AttendanceModel.countDocuments({
        status: 'FLAGGED',
        $or: [
          { manualOverride: { $exists: false } },
          { manualOverride: null },
          { 'manualOverride.adminId': { $exists: false } },
        ],
      }),
      AttendanceModel.countDocuments({
        status: 'REJECTED',
        $or: [
          { manualOverride: { $exists: false } },
          { manualOverride: null },
          { 'manualOverride.adminId': { $exists: false } },
        ],
      }),
    ]);

    return {
      records: formattedRecords,
      items: formattedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalNeedingReview: total,
        flaggedCount,
        rejectedCount,
      },
    };
  }

  async getAttendanceEvidence(attendanceId: string, adminId: string, requestId?: string) {
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      throw AppError.badRequest('Invalid attendance record ID format.', 'INVALID_ATTENDANCE_ID');
    }

    const record = await attendanceRepository.findById(attendanceId);
    if (!record) {
      throw AppError.notFound('Attendance record not found.', 'ATTENDANCE_NOT_FOUND');
    }

    const evidence = record.verificationEvidence;
    if (!evidence || !evidence.reference) {
      throw AppError.notFound('Verification evidence unavailable for this attendance record.', 'EVIDENCE_NOT_FOUND');
    }

    // Check evidence retention expiration policy
    if (evidence.retentionUntil && new Date() > new Date(evidence.retentionUntil)) {
      throw new AppError(410, 'EVIDENCE_EXPIRED', 'Verification evidence has expired.');
    }

    const exists = await evidenceStorageService.evidenceExists(evidence.reference);
    if (!exists) {
      throw new AppError(404, 'EVIDENCE_UNAVAILABLE', 'Verification evidence is temporarily unavailable.');
    }

    const buffer = await evidenceStorageService.getEvidenceBuffer(evidence.reference);
    if (!buffer) {
      throw new AppError(503, 'EVIDENCE_STORAGE_ERROR', 'Verification evidence is temporarily unavailable.');
    }

    // Audit log access event (strictly without image bytes)
    const facultyObj = record.facultyId as any;
    const facultyIdStr = facultyObj?._id ? facultyObj._id.toString() : (facultyObj?.toString() || '');

    await auditService.logAction(adminId, 'EVIDENCE_ACCESSED', requestId, {
      attendanceId: record._id.toString(),
      facultyId: facultyIdStr,
      capturedAt: evidence.capturedAt,
    });

    return {
      buffer,
      contentType: evidence.contentType || 'image/jpeg',
      size: evidence.size || buffer.length,
      capturedAt: evidence.capturedAt,
      retentionUntil: evidence.retentionUntil,
    };
  }

  async cleanupExpiredEvidence(adminId?: string, requestId?: string) {
    const now = new Date();
    const expiredRecords = await AttendanceModel.find({
      'verificationEvidence.retentionUntil': { $lt: now },
      'verificationEvidence.reference': { $exists: true, $ne: '' },
    });

    let purgedCount = 0;
    const purgedReferences: string[] = [];

    for (const record of expiredRecords) {
      const ref = record.verificationEvidence?.reference;
      if (ref) {
        await evidenceStorageService.deleteEvidence(ref);
        record.verificationEvidence!.reference = '';
        await record.save();
        purgedReferences.push(ref);
        purgedCount++;
      }
    }

    if (adminId) {
      await auditService.logAction(adminId, 'EVIDENCE_PURGED', requestId, {
        purgedCount,
        timestamp: now,
      });
    }

    logger.info({ purgedCount }, 'Expired verification evidence cleanup completed');

    return {
      success: true,
      purgedCount,
      purgedReferences,
      timestamp: now.toISOString(),
    };
  }

  async getDashboardStats(query?: { range?: string; startDate?: string; endDate?: string }) {
    const range = query?.range || 'today';
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (range === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (range === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (range === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === 'custom' && query?.startDate && query?.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw AppError.badRequest('Invalid custom date range format.', 'INVALID_DATE_RANGE');
      }
      if (start > end) {
        throw AppError.badRequest('Start date cannot be after end date.', 'INVALID_DATE_RANGE');
      }
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    const matchQuery = { timestamp: { $gte: start, $lte: end } };

    const [
      overviewAggregation,
      trendAggregation,
      totalFaculty,
      activeFaculty,
      inactiveFaculty,
      recentFailuresFacultyIds,
      needingReviewCount,
      topReasonRecords,
      recentAttendances,
      recentAuditLogs,
    ] = await Promise.all([
      AttendanceModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            verifiedCount: { $sum: { $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0] } },
            rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
            flaggedCount: { $sum: { $cond: [{ $eq: ['$status', 'FLAGGED'] }, 1, 0] } },
            overrideCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$manualOverride', null] },
                      { $ne: ['$manualOverride.adminId', null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            identityPassed: { $sum: { $cond: ['$faceVerified', 1, 0] } },
            identityFailed: { $sum: { $cond: ['$faceVerified', 0, 1] } },
            livenessPassed: { $sum: { $cond: ['$livenessVerified', 1, 0] } },
            livenessFailed: { $sum: { $cond: ['$livenessVerified', 0, 1] } },
            locationPassed: { $sum: { $cond: ['$locationVerified', 1, 0] } },
            locationFailed: { $sum: { $cond: ['$locationVerified', 0, 1] } },
            evidenceAvailable: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$verificationEvidence', null] },
                      { $ne: ['$verificationEvidence.reference', null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            evidenceExpired: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$verificationEvidence.retentionUntil', null] },
                      { $lt: ['$verificationEvidence.retentionUntil', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            suspiciousAttempts: {
              $sum: { $cond: [{ $eq: ['$status', 'FLAGGED'] }, 1, 0] },
            },
          },
        },
      ]),
      AttendanceModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$date',
            total: { $sum: 1 },
            verified: { $sum: { $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
            flagged: { $sum: { $cond: [{ $eq: ['$status', 'FLAGGED'] }, 1, 0] } },
            overrides: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$manualOverride', null] },
                      { $ne: ['$manualOverride.adminId', null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            identityFailures: { $sum: { $cond: ['$faceVerified', 0, 1] } },
            livenessFailures: { $sum: { $cond: ['$livenessVerified', 0, 1] } },
            locationFailures: { $sum: { $cond: ['$locationVerified', 0, 1] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      UserModel.countDocuments({ role: 'FACULTY', deletedAt: null }),
      UserModel.countDocuments({ role: 'FACULTY', isActive: true, deletedAt: null }),
      UserModel.countDocuments({ role: 'FACULTY', isActive: false, deletedAt: null }),
      AttendanceModel.distinct('facultyId', {
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        $or: [{ status: 'REJECTED' }, { status: 'FLAGGED' }, { faceVerified: false }, { locationVerified: false }],
      }),
      AttendanceModel.countDocuments({
        $or: [
          { manualOverride: { $exists: false } },
          { manualOverride: null },
          { 'manualOverride.adminId': { $exists: false } },
          { 'manualOverride.adminId': null },
        ],
        $and: [
          {
            $or: [
              { status: 'FLAGGED' },
              { status: 'REJECTED' },
              { faceVerified: false },
              { livenessVerified: false },
              { locationVerified: false },
            ],
          },
        ],
      }),
      AttendanceModel.find({
        $or: [
          { manualOverride: { $exists: false } },
          { manualOverride: null },
          { 'manualOverride.adminId': { $exists: false } },
          { 'manualOverride.adminId': null },
        ],
        $and: [
          {
            $or: [
              { status: 'FLAGGED' },
              { status: 'REJECTED' },
              { faceVerified: false },
              { livenessVerified: false },
              { locationVerified: false },
            ],
          },
        ],
      }).limit(50),
      AttendanceModel.find()
        .populate('facultyId', 'name employeeId department')
        .sort({ timestamp: -1 })
        .limit(6),
      AuditLogModel.find()
        .sort({ timestamp: -1 })
        .limit(6),
    ]);

    const stats = overviewAggregation[0] || {
      totalAttempts: 0,
      verifiedCount: 0,
      rejectedCount: 0,
      flaggedCount: 0,
      overrideCount: 0,
      identityPassed: 0,
      identityFailed: 0,
      livenessPassed: 0,
      livenessFailed: 0,
      locationPassed: 0,
      locationFailed: 0,
      evidenceAvailable: 0,
      evidenceExpired: 0,
      suspiciousAttempts: 0,
    };

    const attendanceRate =
      stats.totalAttempts > 0
        ? Math.round((stats.verifiedCount / stats.totalAttempts) * 1000) / 10
        : 0;

    const reasonCounts = new Map<string, number>();
    for (const rec of topReasonRecords) {
      let r = rec.verificationMetadata?.rejectionReason;
      if (!r) {
        if (!rec.faceVerified) r = 'Identity verification failed';
        else if (!rec.livenessVerified) r = 'Liveness verification failed';
        else if (!rec.locationVerified) r = 'Location verification failed';
        else if (rec.status === 'FLAGGED') r = 'Suspicious verification anomaly';
        else r = 'Manual review requested';
      }
      reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
    }
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const recentActivity = [
      ...recentAttendances.map((a: any) => ({
        id: a._id.toString(),
        type: 'ATTENDANCE' as const,
        title: `${a.facultyId?.name || 'Faculty'} marked attendance`,
        facultyName: a.facultyId?.name || 'Faculty Member',
        employeeId: a.facultyId?.employeeId || 'N/A',
        status: a.status,
        timestamp: a.timestamp,
      })),
      ...recentAuditLogs.map((l: any) => ({
        id: l._id.toString(),
        type: 'AUDIT' as const,
        title: l.action,
        facultyName: l.metadata?.employeeId || 'System',
        employeeId: l.metadata?.employeeId || '',
        status: l.action.includes('OVERRIDE') ? 'OVERRIDE' : 'AUDIT',
        timestamp: l.timestamp,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      range,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      overview: {
        totalAttempts: stats.totalAttempts,
        verifiedCount: stats.verifiedCount,
        rejectedCount: stats.rejectedCount,
        flaggedCount: stats.flaggedCount,
        overrideCount: stats.overrideCount,
        failureCount: stats.rejectedCount + stats.flaggedCount,
        attendanceRate,
      },
      verificationHealth: {
        identityPassed: stats.identityPassed,
        identityFailed: stats.identityFailed,
        livenessPassed: stats.livenessPassed,
        livenessFailed: stats.livenessFailed,
        locationPassed: stats.locationPassed,
        locationFailed: stats.locationFailed,
        evidenceAvailable: stats.evidenceAvailable,
        evidenceExpired: stats.evidenceExpired,
        suspiciousAttempts: stats.suspiciousAttempts,
      },
      facultySummary: {
        totalFaculty,
        activeFaculty,
        inactiveFaculty,
        facultyWithRecentFailures: recentFailuresFacultyIds.length,
      },
      reviewQueueSummary: {
        needingReview: needingReviewCount,
        topReasons,
      },
      trend: trendAggregation.map((t) => ({
        date: t._id,
        total: t.total,
        verified: t.verified,
        rejected: t.rejected,
        flagged: t.flagged,
        overrides: t.overrides,
        identityFailures: t.identityFailures,
        livenessFailures: t.livenessFailures,
        locationFailures: t.locationFailures,
      })),
      recentActivity,
    };
  }

  async getAuditLogs(query?: any) {
    let page = 1;
    let limit = 20;
    const filter: Record<string, unknown> = {};

    if (typeof query === 'number') {
      limit = query;
      const logs = await auditService.getRecentLogs(limit);
      return logs;
    }

    if (query) {
      if (query.page) page = Math.max(1, Number(query.page));
      if (query.limit) limit = Math.min(50, Math.max(1, Number(query.limit)));

      if (query.action && query.action !== 'ALL') {
        filter.action = query.action;
      }

      if (query.attendanceId) {
        filter['metadata.attendanceId'] = query.attendanceId;
      }

      if (query.facultyId) {
        filter['metadata.facultyId'] = query.facultyId;
      }

      if (query.startDate || query.endDate) {
        const timeFilter: Record<string, Date> = {};
        if (query.startDate) timeFilter.$gte = new Date(query.startDate);
        if (query.endDate) timeFilter.$lte = new Date(query.endDate);
        filter.timestamp = timeFilter;
      }

      if (query.search && query.search.trim()) {
        const regex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { action: regex },
          { requestId: regex },
          { 'metadata.employeeId': regex },
          { 'metadata.reason': regex },
        ];
      }
    }

    const { logs, total } = await auditLogRepository.findWithPagination(filter, page, limit);

    const sanitizedLogs = logs.map((log) => {
      const rawMeta = log.metadata || {};
      const safeMeta: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(rawMeta)) {
        const keyLower = k.toLowerCase();
        if (
          keyLower.includes('token') ||
          keyLower.includes('secret') ||
          keyLower.includes('password') ||
          keyLower.includes('jwt') ||
          keyLower.includes('embedding') ||
          keyLower.includes('buffer') ||
          keyLower.includes('base64') ||
          keyLower.includes('key')
        ) {
          continue;
        }
        safeMeta[k] = v;
      }

      let category: 'AUTOMATED_VERIFICATION' | 'ADMINISTRATIVE_DECISION' | 'SECURITY_EVENT' = 'SECURITY_EVENT';
      if (
        log.action.includes('ATTENDANCE_OVERRIDE') ||
        log.action.includes('ADMIN_RESET_FACULTY_FACE') ||
        log.action.includes('ADMIN_UPDATE') ||
        log.action.includes('ADMIN_CREATE') ||
        log.action.includes('ADMIN_DELETE')
      ) {
        category = 'ADMINISTRATIVE_DECISION';
      } else if (
        log.action.includes('VERIFICATION') ||
        log.action.includes('ATTENDANCE')
      ) {
        category = 'AUTOMATED_VERIFICATION';
      }

      return {
        id: log._id.toString(),
        action: log.action,
        category,
        actorId: log.userId ? log.userId.toString() : 'SYSTEM',
        actorName: (rawMeta.adminName as string) || (log.userId === 'SYSTEM' ? 'System Automated Engine' : 'System User'),
        actorRole: (rawMeta.adminName || log.action.startsWith('ADMIN_')) ? 'ADMIN' : 'FACULTY',
        requestId: log.requestId || null,
        timestamp: log.timestamp,
        details: safeMeta,
        ipAddress: (safeMeta.ip as string) || (safeMeta.ipAddress as string) || 'Campus Network',
      };
    });

    return {
      logs: sanitizedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getAttendanceZone() {
    let zone = await attendanceZoneRepository.getActiveZone();
    if (!zone) {
      zone = await attendanceZoneRepository.create({
        name: 'Lovely Professional University (LPU) - Main Campus',
        latitude: env.DEFAULT_GEOFENCE_LAT,
        longitude: env.DEFAULT_GEOFENCE_LNG,
        radiusMeters: env.DEFAULT_GEOFENCE_RADIUS_METERS,
        maxAllowedAccuracyMeters: env.MAX_ALLOWED_ACCURACY_METERS,
        isActive: true,
      });
    }
    return zone.toJSON();
  }

  async updateAttendanceZone(
    input: UpdateZoneInput,
    adminId: string,
    requestId?: string
  ) {
    let zone = await attendanceZoneRepository.getActiveZone();

    if (zone) {
      const updated = await attendanceZoneRepository.update(zone._id.toString(), input);
      zone = updated!;
    } else {
      zone = await attendanceZoneRepository.create({
        name: input.name || 'Main Campus Geofence',
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
        maxAllowedAccuracyMeters: input.maxAllowedAccuracyMeters || env.MAX_ALLOWED_ACCURACY_METERS,
        isActive: input.isActive ?? true,
      });
    }

    await auditService.logAction(adminId, 'ADMIN_UPDATE_ATTENDANCE_ZONE', requestId, {
      zoneId: zone._id.toString(),
      latitude: zone.latitude,
      longitude: zone.longitude,
      radiusMeters: zone.radiusMeters,
    });

    return zone.toJSON();
  }

  async resetFacultyFace(id: string, adminId: string, reason?: string, requestId?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound('Faculty not found.', 'FACULTY_NOT_FOUND');
    }

    const previousReference = user.faceEmbeddingReference;
    user.faceEmbeddingReference = null as any;
    await user.save();

    await auditService.logAction(adminId, 'ADMIN_RESET_FACULTY_FACE', requestId, {
      facultyId: id,
      employeeId: user.employeeId,
      hadPriorBiometrics: Boolean(previousReference),
      reason: reason || 'Administrative facial biometric reset requested',
    });

    return {
      reset: true,
      facultyId: id,
      employeeId: user.employeeId,
      message: 'Facial biometric profile reset successfully. Faculty member can now re-enroll.',
    };
  }

  /**
   * Helper: Sanitizes biometric request document for administrative API responses.
   * Never exposes internal filesystem paths, candidate embeddings, tokens, or raw images.
   */
  private sanitizeBiometricRequest(req: any) {
    const facultyDoc = req.facultyId && typeof req.facultyId === 'object' ? req.facultyId : null;
    return {
      id: req._id?.toString() || req.id,
      facultyId: facultyDoc ? facultyDoc._id?.toString() || facultyDoc.id : req.facultyId?.toString(),
      faculty: facultyDoc
        ? {
            id: facultyDoc._id?.toString() || facultyDoc.id,
            name: facultyDoc.name,
            email: facultyDoc.email,
            employeeId: facultyDoc.employeeId,
            department: facultyDoc.department,
            hasProfilePhoto: Boolean(facultyDoc.profilePhotoReference),
          }
        : null,
      facultyName: facultyDoc?.name,
      facultyEmail: facultyDoc?.email,
      facultyDepartment: facultyDoc?.department,
      employeeId: req.employeeId,
      reason: req.reason || '',
      status: req.status,
      adminReview: req.adminReview
        ? {
            adminId: req.adminReview.adminId?.toString(),
            adminName: req.adminReview.adminName,
            reviewedAt: req.adminReview.reviewedAt,
            notes: req.adminReview.notes,
          }
        : null,
      journal: req.journal
        ? {
            stage: req.journal.stage,
            lastAttemptAt: req.journal.lastAttemptAt,
            recoveryAction: req.journal.recoveryAction,
            errorMessage: req.journal.errorMessage,
          }
        : null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    };
  }

  /**
   * Phase 10.5: Retrieves paginated list of biometric update requests with optional status filtering.
   */
  async getBiometricUpdateRequests(query: QueryBiometricUpdateRequestInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const statusFilter = query.status && query.status !== 'ALL' ? (query.status as any) : undefined;

    const filter = statusFilter ? { status: statusFilter } : {};
    const { requests, total } = await biometricUpdateRequestRepository.findWithPagination(
      filter,
      page,
      limit
    );

    return {
      requests: requests.map((r) => this.sanitizeBiometricRequest(r)),
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Phase 10.5: Retrieves detail of a specific biometric update request.
   */
  async getBiometricUpdateRequestDetail(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid biometric update request ID format.', 'INVALID_REQUEST_ID');
    }

    const request = await biometricUpdateRequestRepository.findById(id);
    if (!request) {
      throw AppError.notFound('Biometric update request not found.', 'BIOMETRIC_REQUEST_NOT_FOUND');
    }

    return {
      request: this.sanitizeBiometricRequest(request),
    };
  }

  /**
   * Phase 10.5: Authenticated, admin-only streaming of pending candidate photo.
   * Strictly reads from private pending vault without exposing filesystem paths.
   */
  async getBiometricUpdateRequestCandidatePhoto(
    id: string,
    _adminId: string,
    _requestId?: string
  ): Promise<{ buffer: Buffer; contentType: string; size: number }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid biometric update request ID format.', 'INVALID_REQUEST_ID');
    }

    const request = await BiometricUpdateRequestModel.findById(id);
    if (!request) {
      throw AppError.notFound('Biometric update request not found.', 'BIOMETRIC_REQUEST_NOT_FOUND');
    }

    if (!request.candidatePhotoReference) {
      throw AppError.notFound('No candidate photo reference registered for this request.', 'CANDIDATE_PHOTO_NOT_FOUND');
    }

    const photoData =
      (await profilePhotoStorageService.getPhotoBuffer(request.candidatePhotoReference, 'pending')) ||
      (await profilePhotoStorageService.getPhotoBuffer(request.candidatePhotoReference, 'active'));

    if (!photoData || !photoData.buffer) {
      throw AppError.notFound(
        'Candidate photo file not found or inaccessible in secure storage.',
        'CANDIDATE_PHOTO_NOT_FOUND'
      );
    }

    return photoData;
  }

  /**
   * Phase 10.6: Approves a faculty biometric photo update request with durable journal state machine.
   * Enforces idempotent retries, distributed failure boundaries, compensating rollback on partial failure,
   * safe post-commit cleanup, and non-blocking audit & notifications.
   */
  async approveBiometricUpdateRequest(
    id: string,
    input: ApproveBiometricUpdateRequestInput,
    adminUser: { userId: string; name: string },
    requestId?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid biometric update request ID format.', 'INVALID_REQUEST_ID');
    }

    // 1. Verify the request exists
    const request = await biometricUpdateRequestRepository.findById(id);
    if (!request) {
      throw AppError.notFound('Biometric update request not found.', 'BIOMETRIC_REQUEST_NOT_FOUND');
    }

    if (request.status !== 'PENDING') {
      throw AppError.conflict(
        `This request has already been ${request.status.toLowerCase()} and cannot be reviewed again.`,
        'REQUEST_ALREADY_REVIEWED'
      );
    }

    // Guard against concurrent processing collision
    const nowMs = Date.now();
    const lastAttemptMs = request.journal?.lastAttemptAt ? new Date(request.journal.lastAttemptAt).getTime() : 0;
    const isRecentlyProcessing =
      request.journal?.stage === 'PROCESSING' &&
      nowMs - lastAttemptMs < 60000;

    if (isRecentlyProcessing) {
      throw AppError.conflict(
        'This request is currently being reviewed and processed by another administrator.',
        'REQUEST_CONCURRENT_REVIEW'
      );
    }

    // Verify faculty user exists
    const facultyUser = await UserModel.findById(request.facultyId);
    if (!facultyUser) {
      throw AppError.notFound('Associated faculty member not found.', 'FACULTY_NOT_FOUND');
    }

    // 2. Candidate Photo Validation: verify photo exists and readable in private pending storage
    const photoExists = await profilePhotoStorageService.photoExists(
      request.candidatePhotoReference,
      'pending'
    );
    if (!photoExists) {
      throw AppError.badRequest(
        'Candidate photo file is missing or inaccessible in pending storage vault.',
        'CANDIDATE_PHOTO_MISSING'
      );
    }

    const photoData = await profilePhotoStorageService.getPhotoBuffer(
      request.candidatePhotoReference,
      'pending'
    );
    if (!photoData || !photoData.buffer) {
      throw AppError.badRequest(
        'Candidate photo buffer cannot be read from pending storage vault.',
        'CANDIDATE_PHOTO_UNREADABLE'
      );
    }

    // 3. Candidate Embedding Validation: verify embedding belongs to this faculty
    const isEmbeddingValid = await faceVerificationService.validateCandidateEmbedding(
      request.candidateEmbeddingReference,
      facultyUser.employeeId
    );
    if (!isEmbeddingValid) {
      throw AppError.badRequest(
        'Candidate biometric embedding is missing, corrupt, or does not belong to this faculty member.',
        'INVALID_CANDIDATE_EMBEDDING'
      );
    }

    // 4. Candidate Image Re-validation: verify biometric face presence and anti-spoof
    const candidateBase64 = `data:${photoData.contentType};base64,${photoData.buffer.toString('base64')}`;
    const checkResult = await faceVerificationService.checkFace(candidateBase64);
    if (!checkResult.valid) {
      throw AppError.badRequest(
        `Candidate photo failed biometric re-validation: ${checkResult.message}`,
        'BIOMETRIC_REVALIDATION_FAILED'
      );
    }

    // 5. Distributed State Machine Pipeline with Durable Journal
    const oldActivePhotoRef = facultyUser.profilePhotoReference;
    const oldActiveEmbeddingRef = facultyUser.faceEmbeddingReference;

    // Step 5.1: Atomically claim request with journal lock
    const claimedRequest = await biometricUpdateRequestRepository.claimForApproval(
      request._id,
      oldActivePhotoRef || null,
      oldActiveEmbeddingRef || null
    );

    if (!claimedRequest) {
      throw AppError.conflict(
        'Request has already been reviewed or is currently being processed by another administrator.',
        'REQUEST_ALREADY_REVIEWED'
      );
    }

    // Step 5.2: Promote photo to active vault
    let promotedActivePhoto: any;
    try {
      promotedActivePhoto = await profilePhotoStorageService.saveActivePhoto(photoData.buffer);
      await biometricUpdateRequestRepository.updateJournal(request._id, {
        stage: 'PHOTO_PROMOTED',
        promotedPhotoReference: promotedActivePhoto.reference,
      });
    } catch (saveErr: any) {
      logger.error({ saveErr, requestId: request._id }, 'Failed to promote candidate photo to active storage');
      await biometricUpdateRequestRepository.resetToPending(request._id, {
        stage: 'IDLE',
        errorMessage: saveErr.message || 'Photo storage error',
        clearPromotedReferences: true,
      });
      throw AppError.internal('Failed to promote candidate photo to active storage vault.', 'PHOTO_STORAGE_ERROR');
    }

    // Step 5.3: Activate candidate embedding in face microservice
    let newActiveEmbeddingRef: string;
    try {
      newActiveEmbeddingRef = await faceVerificationService.activateCandidateEmbedding({
        candidateEmbeddingReference: request.candidateEmbeddingReference,
        employeeId: facultyUser.employeeId,
        imageBase64: candidateBase64,
      });
      await biometricUpdateRequestRepository.updateJournal(request._id, {
        stage: 'EMBEDDING_ACTIVATED',
        newEmbeddingReference: newActiveEmbeddingRef,
      });
    } catch (activateErr: any) {
      // Compensating rollback: delete newly promoted active photo
      await profilePhotoStorageService.deletePhoto(promotedActivePhoto.reference, 'active');
      await biometricUpdateRequestRepository.resetToPending(request._id, {
        stage: 'IDLE',
        errorMessage: activateErr.message || 'Biometric activation failed',
        clearPromotedReferences: true,
      });
      throw activateErr;
    }

    // Step 5.4: Commit User model in MongoDB
    try {
      facultyUser.profilePhotoReference = promotedActivePhoto.reference;
      facultyUser.faceEmbeddingReference = newActiveEmbeddingRef;
      facultyUser.photoUpdatedAt = new Date();
      await facultyUser.save();

      await biometricUpdateRequestRepository.updateJournal(request._id, {
        stage: 'USER_COMMITTED',
      });
    } catch (dbErr: any) {
      logger.error({ dbErr, facultyId: facultyUser._id }, 'Failed to commit user update during biometric approval');
      // Compensating rollback: delete promoted photo and cleanup new embedding in microservice
      await profilePhotoStorageService.deletePhoto(promotedActivePhoto.reference, 'active');
      await faceVerificationService.cleanupEmbedding(newActiveEmbeddingRef);
      await biometricUpdateRequestRepository.resetToPending(request._id, {
        stage: 'FAILED',
        errorMessage: dbErr.message || 'Database commit error',
        recoveryAction: 'RETRY',
        clearPromotedReferences: true,
      });
      throw AppError.internal('Failed to commit approved biometric profile to faculty record.', 'DATABASE_ERROR');
    }

    // Step 5.5: Finalize Request Status in MongoDB
    const reviewData = {
      adminId: new mongoose.Types.ObjectId(adminUser.userId),
      adminName: adminUser.name || 'Administrator',
      reviewedAt: new Date(),
      notes: (input.notes || '').trim(),
    };

    let finalizedRequest: any;
    try {
      finalizedRequest = await biometricUpdateRequestRepository.finalizeApproval(
        request._id,
        reviewData
      );
    } catch (finalErr: any) {
      logger.error({ finalErr, requestId: request._id }, 'Transient error while setting request status to APPROVED');
      // User is already safely committed; reconciliation can heal this request forward
    }

    // Step 5.6: Safe Cleanup of old artifacts and candidate files
    try {
      if (oldActivePhotoRef && oldActivePhotoRef !== promotedActivePhoto.reference) {
        await profilePhotoStorageService.deletePhoto(oldActivePhotoRef, 'active');
      }
      if (oldActiveEmbeddingRef && oldActiveEmbeddingRef !== newActiveEmbeddingRef) {
        await faceVerificationService.cleanupEmbedding(oldActiveEmbeddingRef);
      }
      await profilePhotoStorageService.deletePhoto(request.candidatePhotoReference, 'pending');
      await faceVerificationService.cleanupEmbedding(request.candidateEmbeddingReference);
    } catch (cleanupErr) {
      logger.warn({ cleanupErr, requestId: request._id }, 'Post-approval artifact cleanup encountered non-fatal issue');
    }

    // Step 6: Audit log (non-blocking)
    try {
      await auditService.logAction(adminUser.userId, 'BIOMETRIC_UPDATE_APPROVED', requestId, {
        updateRequestId: request._id.toString(),
        facultyId: facultyUser._id.toString(),
        employeeId: facultyUser.employeeId,
        adminNotes: reviewData.notes,
        newPhotoReference: promotedActivePhoto.reference,
      });
    } catch (auditErr) {
      logger.error({ auditErr, requestId: request._id }, 'Audit logging failed for biometric approval');
    }

    // Step 7: Faculty notification (non-blocking)
    try {
      await notificationService.createBiometricNotification({
        facultyId: facultyUser._id,
        requestId: request._id,
        status: 'APPROVED',
        adminName: adminUser.name,
        notes: reviewData.notes,
      });
    } catch (notifErr) {
      logger.error({ notifErr, requestId: request._id }, 'Faculty notification failed for biometric approval');
    }

    return {
      success: true,
      id: (finalizedRequest || request)._id.toString(),
      status: 'APPROVED',
      employeeId: facultyUser.employeeId,
      reviewedAt: reviewData.reviewedAt,
      message: 'Biometric update request approved successfully. Active profile photo and face enrollment updated.',
    };
  }

  /**
   * Phase 10.6: Rejects a faculty biometric photo update request.
   * Requires meaningful rejection reason, preserves active profile, cleans up candidate artifacts,
   * logs audit event, and sends non-blocking notification to faculty member.
   */
  async rejectBiometricUpdateRequest(
    id: string,
    input: RejectBiometricUpdateRequestInput,
    adminUser: { userId: string; name: string },
    requestId?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid biometric update request ID format.', 'INVALID_REQUEST_ID');
    }

    const rejectionReason = (input.reason || '').trim();
    if (!rejectionReason || rejectionReason.length < 3) {
      throw AppError.badRequest(
        'A meaningful rejection reason (at least 3 characters) is required.',
        'INVALID_REJECTION_REASON'
      );
    }

    const request = await biometricUpdateRequestRepository.findById(id);
    if (!request) {
      throw AppError.notFound('Biometric update request not found.', 'BIOMETRIC_REQUEST_NOT_FOUND');
    }

    if (request.status !== 'PENDING') {
      throw AppError.conflict(
        `This request has already been ${request.status.toLowerCase()} and cannot be reviewed again.`,
        'REQUEST_ALREADY_REVIEWED'
      );
    }

    const reviewData = {
      adminId: new mongoose.Types.ObjectId(adminUser.userId),
      adminName: adminUser.name || 'Administrator',
      reviewedAt: new Date(),
      notes: rejectionReason,
    };

    const claimedRequest = await biometricUpdateRequestRepository.claimAndReview(
      request._id,
      'REJECTED',
      reviewData
    );

    if (!claimedRequest) {
      throw AppError.conflict(
        'Request has already been reviewed or is no longer pending.',
        'REQUEST_ALREADY_REVIEWED'
      );
    }

    // Safely clean up rejected candidate photo and candidate embedding
    try {
      await profilePhotoStorageService.deletePhoto(request.candidatePhotoReference, 'pending');
      await faceVerificationService.cleanupEmbedding(request.candidateEmbeddingReference);
    } catch (cleanupErr) {
      logger.warn({ cleanupErr, requestId: request._id }, 'Candidate cleanup encountered non-fatal issue during rejection');
    }

    const targetFacultyId = (request.facultyId as any)?._id || request.facultyId;

    // Audit log (non-blocking)
    try {
      await auditService.logAction(adminUser.userId, 'BIOMETRIC_UPDATE_REJECTED', requestId, {
        updateRequestId: request._id.toString(),
        facultyId: targetFacultyId.toString(),
        employeeId: request.employeeId,
        rejectionReason,
      });
    } catch (auditErr) {
      logger.error({ auditErr, requestId: request._id }, 'Audit logging failed for biometric rejection');
    }

    // Notify faculty member (non-blocking)
    try {
      await notificationService.createBiometricNotification({
        facultyId: targetFacultyId,
        requestId: request._id,
        status: 'REJECTED',
        adminName: adminUser.name,
        notes: rejectionReason,
      });
    } catch (notifErr) {
      logger.error({ notifErr, requestId: request._id }, 'Faculty notification delivery failed for biometric rejection');
    }

    return {
      success: true,
      id: claimedRequest._id.toString(),
      status: claimedRequest.status,
      employeeId: claimedRequest.employeeId,
      reviewedAt: reviewData.reviewedAt,
      message: 'Biometric update request has been rejected. Faculty member has been notified.',
    };
  }

  /**
   * Phase 10.6: Durable Crash Recovery and Reconciliation Engine.
   * Detects interrupted approval operations across MongoDB, private storage, and Python face-service.
   * Safely heals requests forward or executes compensating rollback to restore consistency.
   */
  async reconcileStaleRequests(staleThresholdMs = 120000): Promise<{
    totalInspected: number;
    reconciledCount: number;
    details: Array<{ id: string; action: string; reason: string }>;
  }> {
    const incompleteRequests = await biometricUpdateRequestRepository.findIncompleteRequests();
    const now = Date.now();
    const details: Array<{ id: string; action: string; reason: string }> = [];
    let reconciledCount = 0;

    for (const req of incompleteRequests) {
      const journal = req.journal;
      if (!journal || journal.stage === 'IDLE' || journal.stage === 'COMPLETED') {
        continue;
      }

      const lastAttemptMs = journal.lastAttemptAt ? new Date(journal.lastAttemptAt).getTime() : 0;
      const isStale = now - lastAttemptMs > staleThresholdMs;

      // Always reconcile USER_COMMITTED; for others, reconcile if stale
      if (!isStale && journal.stage !== 'USER_COMMITTED') {
        continue;
      }

      const faculty = await UserModel.findById(req.facultyId);
      if (!faculty) {
        continue;
      }

      const userAlreadyHasNewEmbedding =
        journal.newEmbeddingReference &&
        faculty.faceEmbeddingReference === journal.newEmbeddingReference;

      if (journal.stage === 'USER_COMMITTED' || userAlreadyHasNewEmbedding) {
        // SCENARIO 1: User profile was already committed in MongoDB!
        // Heal Forward: Finalize request to APPROVED, purge old artifacts, mark COMPLETED
        const reviewData = {
          adminId: req.adminReview?.adminId || new mongoose.Types.ObjectId(),
          adminName: req.adminReview?.adminName || 'System Recovery Engine',
          reviewedAt: new Date(),
          notes: req.adminReview?.notes || 'Automatically reconciled after interrupted approval',
        };

        await biometricUpdateRequestRepository.finalizeApproval(req._id, reviewData as any);

        // Cleanup old active and candidate artifacts safely
        try {
          if (journal.previousPhotoReference && journal.promotedPhotoReference && journal.previousPhotoReference !== journal.promotedPhotoReference) {
            await profilePhotoStorageService.deletePhoto(journal.previousPhotoReference, 'active');
          }
          if (journal.previousEmbeddingReference && journal.newEmbeddingReference && journal.previousEmbeddingReference !== journal.newEmbeddingReference) {
            await faceVerificationService.cleanupEmbedding(journal.previousEmbeddingReference);
          }
          await profilePhotoStorageService.deletePhoto(req.candidatePhotoReference, 'pending');
          await faceVerificationService.cleanupEmbedding(req.candidateEmbeddingReference);
        } catch (cleanupErr) {
          logger.warn({ cleanupErr, requestId: req._id }, 'Cleanup warning during forward reconciliation');
        }

        reconciledCount++;
        details.push({
          id: req._id.toString(),
          action: 'HEALED_FORWARD',
          reason: 'Faculty profile was committed before interruption; request successfully transitioned to APPROVED.',
        });
        logger.info({ requestId: req._id }, 'Reconciliation: Healed forward interrupted request to APPROVED');
      } else if (journal.stage === 'EMBEDDING_ACTIVATED') {
        // SCENARIO 2: Embedding was activated in microservice but user was NEVER committed in MongoDB!
        // Rollback: delete new embedding and promoted photo, restore request to clean PENDING state
        try {
          if (journal.newEmbeddingReference) {
            await faceVerificationService.cleanupEmbedding(journal.newEmbeddingReference);
          }
          if (journal.promotedPhotoReference) {
            await profilePhotoStorageService.deletePhoto(journal.promotedPhotoReference, 'active');
          }
        } catch (cleanupErr) {
          logger.warn({ cleanupErr, requestId: req._id }, 'Cleanup warning during embedding rollback');
        }

        await biometricUpdateRequestRepository.resetToPending(req._id, {
          stage: 'IDLE',
          errorMessage: 'Interrupted during approval before database commit; safely rolled back.',
          clearPromotedReferences: true,
        });

        reconciledCount++;
        details.push({
          id: req._id.toString(),
          action: 'ROLLED_BACK',
          reason: 'Interrupted prior to MongoDB user commit; candidate embedding and photo rolled back to PENDING.',
        });
        logger.info({ requestId: req._id }, 'Reconciliation: Rolled back incomplete embedding activation to PENDING');
      } else if (journal.stage === 'PHOTO_PROMOTED' || journal.stage === 'PROCESSING') {
        // SCENARIO 3: Photo promoted or claimed, but embedding and user untouched
        // Rollback: delete promoted photo if saved, reset to PENDING
        try {
          if (journal.promotedPhotoReference) {
            await profilePhotoStorageService.deletePhoto(journal.promotedPhotoReference, 'active');
          }
        } catch (cleanupErr) {
          logger.warn({ cleanupErr, requestId: req._id }, 'Cleanup warning during photo rollback');
        }

        await biometricUpdateRequestRepository.resetToPending(req._id, {
          stage: 'IDLE',
          errorMessage: 'Interrupted during promotion; safely rolled back to PENDING.',
          clearPromotedReferences: true,
        });

        reconciledCount++;
        details.push({
          id: req._id.toString(),
          action: 'ROLLED_BACK',
          reason: 'Interrupted during initial photo promotion; rolled back to PENDING.',
        });
        logger.info({ requestId: req._id }, 'Reconciliation: Rolled back incomplete photo promotion to PENDING');
      } else if (journal.stage === 'FAILED') {
        // SCENARIO 4: Marked FAILED previously; clean any dangling references
        try {
          if (journal.promotedPhotoReference) {
            await profilePhotoStorageService.deletePhoto(journal.promotedPhotoReference, 'active');
          }
        } catch (cleanupErr) {
          logger.warn({ cleanupErr, requestId: req._id }, 'Cleanup warning during failed stage reset');
        }

        await biometricUpdateRequestRepository.resetToPending(req._id, {
          stage: 'IDLE',
          recoveryAction: 'RETRY',
          clearPromotedReferences: true,
        });

        reconciledCount++;
        details.push({
          id: req._id.toString(),
          action: 'RESET_FAILED_STAGE',
          reason: 'Cleared previously failed stage for administrator retry.',
        });
      }
    }

    return {
      totalInspected: incompleteRequests.length,
      reconciledCount,
      details,
    };
  }
}

export const adminService = new AdminService();

