import {
  User,
  Geofence,
  AttendanceRecord,
  AuditLog,
  AttendanceDetailRecord,
  ReviewQueueResponse,
  DashboardStatsResponse,
  FacultyDetailResponse,
  FacultyListResponse,
  AuditLogResponse,
  BiometricUpdateRequestAdminItem,
  BiometricUpdateRequestListResponse,
} from '../types';
import { apiClient, ApiError } from '../lib/api-client';
import { normalizeUser } from './auth.service';
import { normalizeAttendanceRecord } from './attendance.service';

export interface AdminStats {
  totalFaculty: number;
  activeFaculty: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
  verificationFailureRate: number;
  activeGeofences: number;
}

export const adminService = {
  /**
   * Fetch live roster of faculty from backend
   */
  async getFacultyList(): Promise<User[]> {
    try {
      const res = await apiClient<{ faculty: any[] }>('/admin/faculty');
      const list = res?.faculty || (Array.isArray(res) ? res : []);
      return list.map(normalizeUser);
    } catch {
      return [];
    }
  },

  /**
   * Toggle faculty active/inactive status via backend PATCH
   */
  async toggleFacultyStatus(id: string, currentlyActive?: boolean): Promise<User> {
    const res = await apiClient<{ faculty: any }>(`/admin/faculty/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        isActive: currentlyActive !== undefined ? !currentlyActive : true,
      }),
    });
    return normalizeUser(res.faculty || res);
  },

  /**
   * Admin-created faculty account onboarding
   */
  async createFaculty(payload: {
    name: string;
    email: string;
    employeeId: string;
    password: string;
    department: string;
  }): Promise<User> {
    const res = await apiClient<any>('/admin/faculty', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeUser(res.faculty || res);
  },

  /**
   * Delete / deactivate faculty account
   */
  async deleteFaculty(id: string): Promise<void> {
    await apiClient(`/admin/faculty/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Fetch active campus geofence configuration from backend
   */
  async getGeofences(): Promise<Geofence[]> {
    try {
      const res = await apiClient<{ zone: any }>('/admin/attendance-zone');
      const zone = res?.zone || res;
      if (zone) {
        const mappedZone: Geofence = {
          id: zone.id || zone._id || 'geo_lpu_01',
          name: zone.name || 'Lovely Professional University (LPU) - Main Campus',
          code: 'LPU-MAIN-01',
          description: 'Official academic perimeter at Lovely Professional University',
          type: 'CIRCLE',
          center: {
            latitude: zone.latitude ?? 31.2536,
            longitude: zone.longitude ?? 75.7037,
          },
          radiusMeters: zone.radiusMeters ?? 500,
          maxAllowedAccuracyMeters: zone.maxAllowedAccuracyMeters ?? 35,
          isActive: zone.isActive ?? true,
          allowedDepartments: [],
          createdAt: zone.createdAt || new Date().toISOString(),
          updatedAt: zone.updatedAt || new Date().toISOString(),
        };
        return [mappedZone];
      }
      return [];
    } catch {
      return [
        {
          id: 'geo_lpu_01',
          name: 'Lovely Professional University (LPU) - Main Campus',
          code: 'LPU-MAIN-01',
          description: 'Official campus geofence zone',
          type: 'CIRCLE',
          center: { latitude: 31.2536, longitude: 75.7037 },
          radiusMeters: 500,
          maxAllowedAccuracyMeters: 35,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
  },

  /**
   * Update active campus geofence coordinates, radius, or precision tolerance
   */
  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence> {
    const payload: Record<string, unknown> = {};
    if (updates.name) payload.name = updates.name;
    if (updates.center?.latitude !== undefined) payload.latitude = updates.center.latitude;
    if (updates.center?.longitude !== undefined) payload.longitude = updates.center.longitude;
    if (updates.radiusMeters !== undefined) payload.radiusMeters = updates.radiusMeters;
    if (updates.maxAllowedAccuracyMeters !== undefined)
      payload.maxAllowedAccuracyMeters = updates.maxAllowedAccuracyMeters;
    if (updates.isActive !== undefined) payload.isActive = updates.isActive;

    const res = await apiClient<{ zone: any }>('/admin/attendance-zone', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const zone = res?.zone || res;
    return {
      id: zone.id || zone._id || id,
      name: zone.name || updates.name || 'LPU Main Campus',
      code: 'LPU-MAIN-01',
      type: 'CIRCLE',
      center: {
        latitude: zone.latitude ?? updates.center?.latitude ?? 31.2536,
        longitude: zone.longitude ?? updates.center?.longitude ?? 75.7037,
      },
      radiusMeters: zone.radiusMeters ?? updates.radiusMeters ?? 500,
      maxAllowedAccuracyMeters:
        zone.maxAllowedAccuracyMeters ?? updates.maxAllowedAccuracyMeters ?? 35,
      isActive: zone.isActive ?? updates.isActive ?? true,
      createdAt: zone.createdAt || new Date().toISOString(),
      updatedAt: zone.updatedAt || new Date().toISOString(),
    };
  },

  /**
   * Fetch all institutional attendance records from backend
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      const res = await apiClient<{ records: any[] }>('/admin/attendance');
      const list = res?.records || (Array.isArray(res) ? res : []);
      return list.map(normalizeAttendanceRecord);
    } catch {
      return [];
    }
  },

  /**
   * Administrative override for attendance records
   */
  async overrideAttendance(
    recordId: string,
    overrideData: {
      reason: string;
      status: 'VERIFIED' | 'REJECTED';
      expectedPreviousStatus?: 'VERIFIED' | 'REJECTED' | 'FLAGGED';
      lastUpdatedAt?: string;
    }
  ): Promise<AttendanceRecord> {
    const res = await apiClient<{ record: any } | any>(`/admin/attendance/${recordId}/override`, {
      method: 'POST',
      body: JSON.stringify(overrideData),
    });
    const recordData = res?.record || res;
    return normalizeAttendanceRecord(recordData);
  },

  /**
   * Fetch biometric verification evidence snapshot for an attendance record (Admin only)
   * Returns a local object URL to display the image securely.
   */
  async getAttendanceEvidenceUrl(recordId: string): Promise<string> {
    const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
    const res = await fetch(`${API_BASE_URL}/admin/attendance/${recordId}/evidence`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const code = errJson?.error?.code || `HTTP_${res.status}`;
      const message = errJson?.error?.message || 'Failed to retrieve evidence.';
      throw new ApiError(message, code, res.status);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Fetch complete 8-section investigation detail for an attendance record
   */
  async getAttendanceDetail(id: string): Promise<AttendanceDetailRecord> {
    const res = await apiClient<any>(`/admin/attendance/${id}/detail`);
    return res?.data?.detail || res?.data || res?.detail || res;
  },

  /**
   * Fetch Needs Review queue with server-side filters and pagination
   */
  async getReviewQueue(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    status?: string;
    hasEvidence?: string;
  }): Promise<ReviewQueueResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.department) query.set('department', params.department);
    if (params?.status) query.set('status', params.status);
    if (params?.hasEvidence) query.set('hasEvidence', params.hasEvidence);

    const qs = query.toString();
    const endpoint = `/admin/attendance/review-queue${qs ? `?${qs}` : ''}`;
    const res = await apiClient<{ success: boolean; data: ReviewQueueResponse }>(endpoint);
    return res.data || (res as any);
  },

  /**
   * Fetch security audit logs from backend
   */
  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const res = await apiClient<{ logs: any[] }>('/admin/audit-logs');
      const list = res?.logs || (Array.isArray(res) ? res : []);
      return list.map((log: any) => ({
        id: log.id || log._id || `aud_${Date.now()}`,
        action: log.action || 'SUSPICIOUS_ATTENDANCE_ATTEMPT',
        actorId: typeof log.userId === 'object' ? log.userId?._id : log.userId || '',
        actorName: typeof log.userId === 'object' ? log.userId?.name : 'System User',
        actorRole: typeof log.userId === 'object' ? log.userId?.role : 'FACULTY',
        targetEntity: 'AttendanceRecord',
        targetId: log.details?.attendanceId || '',
        details: log.details || {},
        ipAddress: log.ip || log.details?.ip || '127.0.0.1',
        userAgent: log.userAgent || log.details?.userAgent || 'Browser Client',
        timestamp: log.createdAt || log.timestamp || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  /**
   * Aggregate high-level institutional stats from live records
   */
  async getStats(): Promise<AdminStats> {
    const today = new Date().toISOString().split('T')[0];
    const [facultyList, records, geofences] = await Promise.all([
      this.getFacultyList(),
      this.getAttendanceRecords(),
      this.getGeofences(),
    ]);

    const totalFaculty = Math.max(facultyList.length, 1);
    const activeFaculty = facultyList.filter((f) => f.status === 'ACTIVE').length;
    const presentToday = records.filter(
      (r) => r.date === today && r.status === 'VERIFIED'
    ).length;
    const absentToday = Math.max(0, totalFaculty - presentToday);
    const attendanceRate = Math.round((presentToday / totalFaculty) * 100);
    const failureCount = records.filter(
      (r) => r.date === today && r.status === 'REJECTED'
    ).length;
    const verificationFailureRate = records.length
      ? Math.round((failureCount / records.length) * 100)
      : 0;

    return {
      totalFaculty,
      activeFaculty,
      presentToday,
      absentToday,
      attendanceRate,
      verificationFailureRate,
      activeGeofences: geofences.filter((g) => g.isActive).length,
    };
  },

  /**
   * Fetch comprehensive real aggregated dashboard metrics and trends
   */
  async getDashboardStats(params?: {
    range?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<DashboardStatsResponse> {
    const query = new URLSearchParams();
    if (params?.range) query.set('range', params.range);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString();
    const endpoint = `/admin/dashboard/stats${qs ? `?${qs}` : ''}`;
    const res = await apiClient<any>(endpoint);
    return res?.data || res;
  },

  /**
   * Fetch paginated faculty directory with search and filters
   */
  async getFacultyListPaginated(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    status?: string;
    faceEnrolled?: string;
  }): Promise<FacultyListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.department) query.set('department', params.department);
    if (params?.status) query.set('status', params.status);
    if (params?.faceEnrolled) query.set('faceEnrolled', params.faceEnrolled);

    const qs = query.toString();
    const endpoint = `/admin/faculty${qs ? `?${qs}` : ''}`;
    const res = await apiClient<any>(endpoint);
    return res?.data || res;
  },

  /**
   * Fetch detailed faculty investigation profile with attendance summary & recent history
   */
  async getFacultyDetail(id: string): Promise<FacultyDetailResponse> {
    const res = await apiClient<any>(`/admin/faculty/${id}/detail`);
    return res?.data || res;
  },

  /**
   * Securely reset a faculty member's facial biometric embedding with audit reason
   */
  async resetFacultyFace(id: string, reason?: string): Promise<{ reset: boolean; message: string }> {
    const res = await apiClient<any>(`/admin/faculty/${id}/reset-face`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res?.data || res;
  },

  /**
   * Fetch paginated security & verification audit logs with filters
   */
  async getAuditLogsPaginated(params?: {
    page?: number;
    limit?: number;
    action?: string;
    search?: string;
    facultyId?: string;
    attendanceId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLogResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.action) query.set('action', params.action);
    if (params?.search) query.set('search', params.search);
    if (params?.facultyId) query.set('facultyId', params.facultyId);
    if (params?.attendanceId) query.set('attendanceId', params.attendanceId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString();
    const endpoint = `/admin/audit-logs${qs ? `?${qs}` : ''}`;
    const res = await apiClient<any>(endpoint);
    return res?.data || res;
  },

  /**
   * Phase 10.5: Fetch Biometric Update Requests with pagination and status filter
   */
  async getBiometricUpdateRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<BiometricUpdateRequestListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);

    const qs = query.toString();
    const endpoint = `/admin/biometric-update-requests${qs ? `?${qs}` : ''}`;
    const res = await apiClient<any>(endpoint);
    return res?.data || res;
  },

  /**
   * Phase 10.5: Fetch single biometric update request detail
   */
  async getBiometricUpdateRequestDetail(id: string): Promise<BiometricUpdateRequestAdminItem> {
    const res = await apiClient<any>(`/admin/biometric-update-requests/${id}`);
    const data = res?.data?.request || res?.request || res?.data || res;
    return data;
  },

  /**
   * Phase 10.5: Fetch candidate photo blob URL securely (admin only, credentials included)
   */
  async getBiometricUpdateRequestCandidatePhotoUrl(id: string): Promise<string> {
    const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
    const res = await fetch(`${API_BASE_URL}/admin/biometric-update-requests/${id}/photo`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const code = errJson?.error?.code || `HTTP_${res.status}`;
      const message = errJson?.error?.message || 'Failed to retrieve candidate photo.';
      throw new ApiError(message, code, res.status);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Phase 10.5: Approve biometric update request
   */
  async approveBiometricUpdateRequest(
    id: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient<any>(`/admin/biometric-update-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes: notes || '' }),
    });
    return res?.data || res;
  },

  /**
   * Phase 10.5: Reject biometric update request with required reason
   */
  async rejectBiometricUpdateRequest(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient<any>(`/admin/biometric-update-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res?.data || res;
  },
};
