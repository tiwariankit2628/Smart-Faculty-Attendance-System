import mongoose from 'mongoose';
import { notificationRepository } from '../repositories/notification.repository';
import { AttendanceDocument } from '../models/Attendance';
import { AttendanceStatus, NotificationType } from '../types';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export function formatNotificationDate(dateStr: string | Date): string {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return String(dateStr);
}

export function formatNotificationTimestamp(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export interface CreateOverrideNotificationParams {
  attendance: AttendanceDocument | any;
  newStatus: AttendanceStatus;
  reason: string;
  adminId: string;
  adminName?: string;
  timestamp?: Date;
  requestId?: string;
}

export class NotificationService {
  async createOverrideNotification(params: CreateOverrideNotificationParams) {
    const { attendance, newStatus, reason, timestamp = new Date() } = params;

    const attendanceIdStr = attendance._id?.toString() || attendance.id?.toString();
    const facultyObj = attendance.facultyId as any;
    const facultyIdStr = facultyObj?._id ? facultyObj._id.toString() : (facultyObj?.toString() || '');

    if (!attendanceIdStr || !facultyIdStr) {
      throw AppError.badRequest('Missing attendance or faculty reference for notification.', 'INVALID_NOTIFICATION_TARGET');
    }

    let type: NotificationType;
    let title: string;
    let message: string;

    const formattedDate = formatNotificationDate(attendance.date);
    const decisionTimeFormatted = formatNotificationTimestamp(timestamp);
    const sanitizedReason = reason.trim();

    if (newStatus === 'VERIFIED') {
      type = 'ATTENDANCE_APPROVED';
      title = 'Attendance Verification Approved';
      message = `Your attendance verification for ${formattedDate} has been approved by the administration.\n\nReason:\n${sanitizedReason}`;
    } else if (newStatus === 'REJECTED') {
      type = 'ATTENDANCE_REJECTED';
      title = 'Attendance Verification Rejected';
      message = `Your attendance verification for ${formattedDate} has been rejected.\n\nReason:\n${sanitizedReason}\n\nDecision Timestamp: ${decisionTimeFormatted}`;
    } else {
      type = 'ATTENDANCE_REVIEW_REQUIRED';
      title = 'Attendance Review Required';
      message = `Your attendance verification for ${formattedDate} requires administrative review.\n\nReason:\n${sanitizedReason}\n\nDecision Timestamp: ${decisionTimeFormatted}`;
    }

    // Deduplication Key: prevent repeated clicks or network retries from duplicating notifications
    // based on attendance ID + decision + timestamp second
    const deduplicationKey = `dedup_${attendanceIdStr}_${type}_${Math.floor(timestamp.getTime() / 1000)}`;

    // Check if duplicate notification exists
    const existing = await notificationRepository.findByDeduplicationKey(deduplicationKey);
    if (existing) {
      logger.info({ deduplicationKey, attendanceId: attendanceIdStr }, 'Duplicate notification prevented via deduplicationKey');
      return existing.toJSON();
    }

    try {
      const created = await notificationRepository.create({
        facultyId: new mongoose.Types.ObjectId(facultyIdStr),
        attendanceId: new mongoose.Types.ObjectId(attendanceIdStr),
        type,
        title,
        message,
        read: false,
        createdAt: timestamp,
        deduplicationKey,
        metadata: {
          attendanceDate: attendance.date,
          status: newStatus,
          decisionTimestamp: timestamp.toISOString(),
        },
      });

      logger.info(
        {
          notificationId: created._id.toString(),
          attendanceId: attendanceIdStr,
          facultyId: facultyIdStr,
          type,
        },
        'Faculty attendance notification created successfully'
      );

      return created.toJSON();
    } catch (err: any) {
      // Graceful idempotency handling if duplicate key race occurred
      if (err.code === 11000) {
        logger.info({ deduplicationKey, attendanceId: attendanceIdStr }, 'Idempotent duplicate notification caught on constraint 11000');
        const duplicate = await notificationRepository.findByDeduplicationKey(deduplicationKey);
        if (duplicate) return duplicate.toJSON();
      }
      logger.error({ err, attendanceId: attendanceIdStr }, 'Failed to create faculty notification in MongoDB');
      throw err;
    }
  }

  async createBiometricNotification(params: {
    facultyId: string | mongoose.Types.ObjectId;
    requestId: string | mongoose.Types.ObjectId;
    status: 'APPROVED' | 'REJECTED';
    adminName?: string;
    notes?: string;
    timestamp?: Date;
  }) {
    const { facultyId, requestId, status, adminName = 'Administrator', notes, timestamp = new Date() } = params;

    const facultyIdStr =
      (facultyId as any)?._id?.toString() || (facultyId as any)?.id?.toString() || facultyId.toString();
    const requestIdStr =
      (requestId as any)?._id?.toString() || (requestId as any)?.id?.toString() || requestId.toString();

    const type: NotificationType =
      status === 'APPROVED' ? 'BIOMETRIC_UPDATE_APPROVED' : 'BIOMETRIC_UPDATE_REJECTED';
    const title =
      status === 'APPROVED'
        ? 'Biometric Photo Update Approved'
        : 'Biometric Photo Update Rejected';
    const decisionTimeFormatted = formatNotificationTimestamp(timestamp);
    const sanitizedNotes = (notes || '').trim();

    const message =
      status === 'APPROVED'
        ? `Your biometric photo update request has been approved by ${adminName}.${sanitizedNotes ? `\n\nRemarks:\n${sanitizedNotes}` : ''}\n\nYour active profile photo and biometric identity have been successfully updated.`
        : `Your biometric photo update request has been rejected by ${adminName}.\n\nReason:\n${sanitizedNotes || 'No specific reason provided.'}\n\nDecision Timestamp: ${decisionTimeFormatted}`;

    const deduplicationKey = `dedup_bio_${requestIdStr}_${status}_${Math.floor(timestamp.getTime() / 1000)}`;

    try {
      const created = await notificationRepository.create({
        facultyId: new mongoose.Types.ObjectId(facultyIdStr),
        biometricRequestId: new mongoose.Types.ObjectId(requestIdStr),
        type,
        title,
        message,
        read: false,
        createdAt: timestamp,
        deduplicationKey,
        metadata: {
          requestId: requestIdStr,
          status,
          adminName,
          notes: sanitizedNotes,
          decisionTimestamp: timestamp.toISOString(),
        },
      });

      logger.info(
        {
          notificationId: created._id.toString(),
          requestId: requestIdStr,
          facultyId: facultyIdStr,
          type,
        },
        'Biometric update notification persisted successfully'
      );

      return created.toJSON();
    } catch (err: any) {
      if (err.code === 11000) {
        const duplicate = await notificationRepository.findByDeduplicationKey(deduplicationKey);
        if (duplicate) return duplicate.toJSON();
      }
      logger.error({ err, requestId: requestIdStr }, 'Failed to create biometric update notification');
      throw err;
    }
  }

  async getFacultyNotifications(facultyId: string, page = 1, limit = 20) {
    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const [{ notifications, total }, unreadCount] = await Promise.all([
      notificationRepository.findByFacultyId(facultyId, safePage, safeLimit),
      notificationRepository.countUnreadByFacultyId(facultyId),
    ]);

    return {
      notifications: notifications.map((n) => n.toJSON()),
      unreadCount,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  async getUnreadCount(facultyId: string) {
    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }
    const unreadCount = await notificationRepository.countUnreadByFacultyId(facultyId);
    return { unreadCount };
  }

  async markAsRead(notificationId: string, facultyId: string) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw AppError.badRequest('Invalid notification ID format.', 'INVALID_NOTIFICATION_ID');
    }

    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const updated = await notificationRepository.markAsRead(notificationId, facultyId);
    if (!updated) {
      throw AppError.notFound('Notification not found.', 'NOTIFICATION_NOT_FOUND');
    }

    return updated.toJSON();
  }

  async markAllAsRead(facultyId: string) {
    if (!mongoose.Types.ObjectId.isValid(facultyId)) {
      throw AppError.badRequest('Invalid faculty ID format.', 'INVALID_FACULTY_ID');
    }

    const updatedCount = await notificationRepository.markAllAsRead(facultyId);
    return { updatedCount };
  }
}

export const notificationService = new NotificationService();
