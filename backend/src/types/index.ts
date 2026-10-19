import { Request } from 'express';
import { Types } from 'mongoose';

export type UserRole = 'FACULTY' | 'ADMIN';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  employeeId: string;
  passwordHash: string;
  role: UserRole;
  department: string;
  faceEmbeddingReference?: string | null; // Stored reference ID or serialized embedding vector
  faceEnrolled?: boolean;
  isFaceEnrolled?: boolean;
  profilePhotoReference?: string | null; // Stored private profile photo reference ID
  photoUpdatedAt?: Date | null;
  hasProfilePhoto?: boolean;
  isActive: boolean;
  deletedAt?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceStatus = 'VERIFIED' | 'REJECTED' | 'FLAGGED';

export type NotificationType =
  | 'ATTENDANCE_APPROVED'
  | 'ATTENDANCE_REJECTED'
  | 'ATTENDANCE_REVIEW_REQUIRED'
  | 'BIOMETRIC_UPDATE_APPROVED'
  | 'BIOMETRIC_UPDATE_REJECTED';

export interface INotification {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  attendanceId?: Types.ObjectId;
  biometricRequestId?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date | null;
  deduplicationKey?: string;
  metadata?: Record<string, unknown>;
}

export interface IAttendanceVerificationMetadata {
  faceConfidence?: number;
  livenessScore?: number;
  accuracyMeters?: number;
  zoneId?: string;
  zoneName?: string;
  ipAddress?: string;
  userAgent?: string;
  challengeToken?: string;
  challengeType?: string;
  rejectionReason?: string;
}

export interface IAttendanceManualOverride {
  adminId: Types.ObjectId | string;
  adminName: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  timestamp: Date;
}

export interface IVerificationEvidence {
  reference: string;
  capturedAt: Date;
  contentType: string;
  size: number;
  retentionUntil: Date;
}

export interface IAttendance {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  timestamp: Date;
  latitude: number;
  longitude: number;
  distanceFromZone: number;
  locationVerified: boolean;
  faceVerified: boolean;
  livenessVerified: boolean;
  status: AttendanceStatus;
  originalStatus?: AttendanceStatus;
  manualOverride?: IAttendanceManualOverride;
  verificationEvidence?: IVerificationEvidence;
  verificationMetadata: IAttendanceVerificationMetadata;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IAttendanceZone {
  _id: Types.ObjectId;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAllowedAccuracyMeters?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId | string;
  action: string;
  timestamp: Date;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  employeeId: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type BiometricUpdateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type BiometricUpdateJournalStage =
  | 'IDLE'
  | 'PROCESSING'
  | 'PHOTO_PROMOTED'
  | 'EMBEDDING_ACTIVATED'
  | 'USER_COMMITTED'
  | 'COMPLETED'
  | 'FAILED';

export interface IBiometricUpdateJournal {
  stage: BiometricUpdateJournalStage;
  promotedPhotoReference?: string | null;
  newEmbeddingReference?: string | null;
  previousPhotoReference?: string | null;
  previousEmbeddingReference?: string | null;
  startedAt?: Date | null;
  lastAttemptAt?: Date | null;
  errorMessage?: string | null;
  recoveryAction?: 'RETRY' | 'ROLLBACK' | 'REQUIRES_INTERVENTION' | 'NONE';
}

export interface IBiometricUpdateAdminReview {
  adminId: Types.ObjectId | string;
  adminName: string;
  reviewedAt: Date;
  notes?: string;
}

export interface IBiometricUpdateRequest {
  _id: Types.ObjectId;
  facultyId: Types.ObjectId;
  employeeId: string;
  candidatePhotoReference: string;
  candidateEmbeddingReference: string;
  reason?: string;
  status: BiometricUpdateStatus;
  adminReview?: IBiometricUpdateAdminReview;
  journal?: IBiometricUpdateJournal;
  createdAt: Date;
  updatedAt: Date;
}

