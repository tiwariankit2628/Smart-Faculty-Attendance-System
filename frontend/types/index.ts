export type UserRole = 'FACULTY' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
  designation: string;
  phone?: string;
  faceEnrolled: boolean;
  status: UserStatus;
  lastLoginAt?: string;
  profilePhotoReference?: string | null;
  photoUpdatedAt?: string | null;
  hasProfilePhoto?: boolean;
}

export type GeofenceType = 'CIRCLE' | 'POLYGON';

export interface Geofence {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: GeofenceType;
  center?: {
    latitude: number;
    longitude: number;
  };
  radiusMeters?: number;
  polygon?: Array<{ latitude: number; longitude: number }>;
  maxAllowedAccuracyMeters: number;
  isActive: boolean;
  allowedDepartments?: string[];
  createdAt: string;
  updatedAt: string;
}

export type AttendanceSession = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceStatus = 'VERIFIED' | 'REJECTED' | 'FLAGGED';

export type NotificationType =
  | 'ATTENDANCE_APPROVED'
  | 'ATTENDANCE_REJECTED'
  | 'ATTENDANCE_REVIEW_REQUIRED';

export interface FacultyNotification {
  id: string;
  facultyId: string;
  attendanceId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  metadata?: {
    attendanceDate?: string;
    status?: string;
    decisionTimestamp?: string;
  };
}

export interface NotificationsResponse {
  notifications: FacultyNotification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AttendanceRecord {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeId: string;
  department: string;
  date: string; // YYYY-MM-DD
  sessionType: AttendanceSession;
  status: AttendanceStatus;
  timestamp: string; // ISO 8601
  locationVerification: {
    verified: boolean;
    geofenceId?: string;
    geofenceName?: string;
    distanceMeters: number;
    accuracyMeters: number;
    isMockedSuspicion: boolean;
  };
  faceVerification: {
    verified: boolean;
    confidenceScore: number;
    matchThreshold: number;
    livenessPassed: boolean;
    livenessScore: number;
  };
  deviceAudit: {
    ipAddress: string;
    userAgent: string;
    clientTimestamp: string;
  };
  rejectionReason?: string;
  manualOverride?: {
    overriddenBy: string;
    overriddenByName: string;
    reason: string;
    overriddenAt: string;
  };
  evidenceAvailable?: boolean;
  evidenceExpired?: boolean;
  verificationEvidence?: {
    reference?: string;
    capturedAt?: string;
    contentType?: string;
    size?: number;
    retentionUntil?: string;
    hasEvidence: boolean;
    isExpired: boolean;
  };
}

export interface TodayAttendanceStatus {
  date: string;
  attendancePercentage: number;
  totalWorkingDays: number;
  presentDays: number;
  checkIn?: {
    marked: boolean;
    time?: string;
    status?: AttendanceStatus;
    geofenceName?: string;
  };
  checkOut?: {
    marked: boolean;
    time?: string;
    status?: AttendanceStatus;
  };
}

export interface AuditLog {
  id: string;
  action:
    | 'GEOFENCE_CREATED'
    | 'GEOFENCE_MODIFIED'
    | 'FACULTY_ONBOARDED'
    | 'ATTENDANCE_OVERRIDE'
    | 'SUSPICIOUS_ATTENDANCE_ATTEMPT'
    | 'ADMIN_LOGIN';
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  targetEntity: 'User' | 'Geofence' | 'AttendanceRecord';
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export type VerificationStep =
  | 'AUTH_CHECK'
  | 'LOCATION_REQUEST'
  | 'LOCATION_CHECKING'
  | 'LOCATION_VERIFIED'
  | 'CAMERA_ACTIVE'
  | 'CHALLENGE_READY'
  | 'LIVENESS_CAPTURING'
  | 'LIVENESS_ANALYZING'
  | 'LIVENESS_VERIFIED'
  | 'IDENTITY_MATCHING'
  | 'IDENTITY_VERIFIED'
  | 'ATTENDANCE_READY'
  | 'CHALLENGE_ACTIVE'
  | 'BIOMETRIC_PROCESSING'
  | 'PHOTO_CAPTURED'
  | 'ATTENDANCE_SUMMARY'
  | 'VERIFYING_MULTI_GATE'
  | 'COMPLETED_SUCCESS'
  | 'FAILED_ERROR';

export type VerificationErrorCode =
  | 'AUTH_REQUIRED'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_TIMEOUT'
  | 'LOCATION_INACCURATE'
  | 'OUTSIDE_GEOFENCE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'IMAGE_TOO_POOR'
  | 'IMAGE_TOO_BLURRY'
  | 'IMAGE_TOO_DARK'
  | 'INSUFFICIENT_LIGHTING'
  | 'FACE_MISMATCH'
  | 'FACE_NOT_REGISTERED'
  | 'FACE_VERIFICATION_FAILED'
  | 'LIVENESS_FAILED'
  | 'STATIC_OR_REPLAY_ATTACK_DETECTED'
  | 'CHALLENGE_EXPIRED'
  | 'ALREADY_MARKED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export type BiometricItemStatus = 'idle' | 'evaluating' | 'passed' | 'failed';

export interface BiometricStatusState {
  faceDetected: BiometricItemStatus;
  faceQuality: BiometricItemStatus;
  livenessCheck: BiometricItemStatus;
  identityMatch: BiometricItemStatus;
  failureTitle?: string | null;
  failureMessage?: string | null;
  errorCode?: string | null;
}

export interface LivenessChallengeInfo {
  token: string;
  type: string;
  instruction: string;
  expiresInSeconds: number;
  expiresAt: number;
}

export interface VerificationError {
  code: VerificationErrorCode;
  title: string;
  message: string;
  detail?: string;
  retryable: boolean;
  actionLabel?: string;
}

export interface VerificationProgress {
  locationVerified: boolean;
  faceVerifying: boolean;
  faceVerified: boolean;
  livenessVerifying: boolean;
  livenessVerified: boolean;
  attendanceProcessing: boolean;
  attendanceProcessed: boolean;
}

export interface VerifyLocationResponse {
  locationVerified: boolean;
  distanceFromZone: number;
  zoneName: string;
  allowedRadiusMeters: number;
  locationToken: string;
}

export interface VerifyFaceResponse {
  faceVerified: boolean;
  identityMatched: boolean;
  livenessVerified: boolean;
  livenessStatus: string;
  similarity?: number;
  distance?: number;
  faceConfidence?: number;
  livenessScore?: number;
  challengeType?: string;
  faceToken: string;
  message?: string;
}

export interface MarkAttendancePayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationToken: string;
  faceToken: string;
  faceVerified?: boolean;
  faceConfidence?: number;
  livenessPassed?: boolean;
  challengeToken?: string;
  idempotencyKey?: string;
}

export interface AttendanceDetailRecord {
  id: string;
  attendanceId: string;
  date: string;
  timestamp: string;
  status: AttendanceStatus;
  originalStatus: AttendanceStatus;
  faculty: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
    email: string;
    isActive: boolean;
    status: 'ACTIVE' | 'INACTIVE';
  };
  locationVerification: {
    verified: boolean;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters: number;
    zoneName: string;
    networkTrust: string;
    ipAddress: string;
    timestamp: string;
  };
  identityVerification: {
    faceDetected: boolean;
    identityMatched: boolean;
    confidenceScore?: number;
    verified: boolean;
    timestamp: string;
  };
  livenessVerification: {
    livenessPassed: boolean;
    livenessScore?: number;
    challengeType: string;
    captureDurationSeconds: number;
    validFrameCount: number;
    totalFrameCount: number;
    timestamp: string;
  };
  verificationEvidence: {
    hasEvidence: boolean;
    reference: string | null;
    capturedAt: string | null;
    contentType: string;
    size: number | null;
    retentionUntil: string | null;
    isExpired: boolean;
  };
  manualOverride: {
    adminId?: string;
    adminName: string;
    previousStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    reason: string;
    timestamp: string;
  } | null;
  auditHistory: Array<{
    id: string;
    action: string;
    timestamp: string;
    actorId: string;
    details: Record<string, unknown>;
  }>;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewQueueItem {
  id: string;
  attendanceId: string;
  faculty: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
    email: string;
  };
  date: string;
  timestamp: string;
  reviewReason: string;
  automatedResult: AttendanceStatus;
  currentStatus: AttendanceStatus;
  liveness: {
    passed: boolean;
    score?: number;
  };
  identity: {
    matched: boolean;
    score?: number;
  };
  location: {
    verified: boolean;
    distanceMeters: number;
  };
  evidence: {
    hasEvidence: boolean;
    isExpired: boolean;
  };
  createdAt: string;
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardOverview {
  totalAttempts: number;
  verifiedCount: number;
  rejectedCount: number;
  flaggedCount: number;
  overrideCount: number;
  failureCount: number;
  attendanceRate: number;
}

export interface VerificationHealth {
  identityPassed: number;
  identityFailed: number;
  livenessPassed: number;
  livenessFailed: number;
  locationPassed: number;
  locationFailed: number;
  evidenceAvailable: number;
  evidenceExpired: number;
  suspiciousAttempts: number;
}

export interface FacultySummary {
  totalFaculty: number;
  activeFaculty: number;
  inactiveFaculty: number;
  facultyWithRecentFailures: number;
}

export interface ReviewQueueSummary {
  needingReview: number;
  topReasons: Array<{ reason: string; count: number }>;
}

export interface TrendItem {
  date: string;
  total: number;
  verified: number;
  rejected: number;
  flagged: number;
  overrides: number;
  identityFailures: number;
  livenessFailures: number;
  locationFailures: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'ATTENDANCE' | 'AUDIT';
  title: string;
  facultyName: string;
  employeeId: string;
  status: string;
  timestamp: string;
}

export interface DashboardStatsResponse {
  range: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  overview: DashboardOverview;
  verificationHealth: VerificationHealth;
  facultySummary: FacultySummary;
  reviewQueueSummary: ReviewQueueSummary;
  trend: TrendItem[];
  recentActivity: RecentActivityItem[];
}

export interface FacultyListItem {
  id: string;
  _id?: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  role: string;
  isActive: boolean;
  status?: string;
  faceEmbeddingReference?: string | null;
  recentAttendance?: {
    status: AttendanceStatus;
    timestamp: string;
    date: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FacultyListResponse {
  faculty: FacultyListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FacultyDetailBiometricStatus {
  isFaceEnrolled: boolean;
  enrolledAt: string | null;
  lastResetAt: string | null;
  resetCount: number;
}

export interface FacultyDetailAttendanceSummary {
  totalAttempts: number;
  verifiedCount: number;
  rejectedCount: number;
  flaggedCount: number;
  overrideCount: number;
  attendanceRate: number;
}

export interface FacultyDetailAttendanceHistoryItem {
  id: string;
  attendanceId: string;
  date: string;
  timestamp: string;
  status: AttendanceStatus;
  originalStatus: AttendanceStatus;
  locationVerified: boolean;
  faceVerified: boolean;
  livenessVerified: boolean;
  distanceFromZone?: number;
  manualOverride: {
    adminName: string;
    previousStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    reason: string;
    timestamp: string;
  } | null;
}

export interface FacultyDetailResponse {
  faculty: {
    id: string;
    name: string;
    employeeId: string;
    email: string;
    department: string;
    status: 'ACTIVE' | 'INACTIVE';
    isActive: boolean;
    role: string;
    createdAt: string;
    biometricStatus: FacultyDetailBiometricStatus;
  };
  attendanceSummary: FacultyDetailAttendanceSummary;
  recentAttendance: FacultyDetailAttendanceHistoryItem[];
}

export interface AuditLogEvent {
  id: string;
  action: string;
  category: 'AUTOMATED_VERIFICATION' | 'ADMINISTRATIVE_DECISION' | 'SECURITY_EVENT';
  actorId: string;
  actorName: string;
  actorRole: 'ADMIN' | 'FACULTY';
  requestId: string | null;
  timestamp: string;
  details: Record<string, unknown>;
  ipAddress: string;
}

export interface AuditLogResponse {
  logs: AuditLogEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BiometricUpdateRequestAdminItem {
  id: string;
  facultyId: string;
  faculty?: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    hasProfilePhoto: boolean;
  } | null;
  facultyName?: string;
  facultyEmail?: string;
  facultyDepartment?: string;
  employeeId: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminReview?: {
    adminId?: string;
    adminName?: string;
    reviewedAt?: string;
    notes?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface BiometricUpdateRequestListResponse {
  requests: BiometricUpdateRequestAdminItem[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}



