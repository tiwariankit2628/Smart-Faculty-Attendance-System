import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../services/admin.service';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: string, public statusCode: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('Admin Service — Dashboard, Faculty Management & Audit Center (Phase 8.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should query /admin/dashboard/stats with date range filters', async () => {
      const mockStats = {
        range: '7d',
        overview: {
          totalAttempts: 150,
          verifiedCount: 130,
          rejectedCount: 15,
          flaggedCount: 5,
          overrideCount: 3,
          failureCount: 20,
          attendanceRate: 86.7,
        },
        verificationHealth: {
          identityPassed: 135,
          identityFailed: 15,
          livenessPassed: 140,
          livenessFailed: 10,
          locationPassed: 142,
          locationFailed: 8,
          evidenceAvailable: 150,
          evidenceExpired: 0,
          suspiciousAttempts: 5,
        },
        facultySummary: {
          totalFaculty: 45,
          activeFaculty: 42,
          inactiveFaculty: 3,
          facultyWithRecentFailures: 4,
        },
        reviewQueueSummary: {
          needingReview: 8,
          topReasons: [{ reason: 'Biometric confidence low', count: 5 }],
        },
        trend: [],
        recentActivity: [],
      };

      vi.mocked(apiClient).mockResolvedValueOnce({ data: mockStats });

      const res = await adminService.getDashboardStats({ range: '7d' });
      expect(apiClient).toHaveBeenCalledWith('/admin/dashboard/stats?range=7d');
      expect(res.overview.totalAttempts).toBe(150);
      expect(res.overview.attendanceRate).toBe(86.7);
      expect(res.verificationHealth.identityPassed).toBe(135);
    });
  });

  describe('getFacultyListPaginated', () => {
    it('should query /admin/faculty with pagination and filters', async () => {
      const mockListResponse = {
        faculty: [
          {
            id: 'fac_1',
            name: 'Prof. John Doe',
            employeeId: 'LPU-001',
            email: 'john@lpu.in',
            department: 'Computer Science & Engineering',
            role: 'FACULTY',
            isActive: true,
            faceEmbeddingReference: 'emb_1',
            recentAttendance: {
              status: 'VERIFIED',
              date: '2026-10-09',
              timestamp: '2026-10-09T09:00:00Z',
            },
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 15,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(apiClient).mockResolvedValueOnce({ data: mockListResponse });

      const res = await adminService.getFacultyListPaginated({
        page: 1,
        limit: 15,
        search: 'John',
        department: 'Computer Science & Engineering',
        status: 'ACTIVE',
        faceEnrolled: 'true',
      });

      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('/admin/faculty?')
      );
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('page=1')
      );
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('search=John')
      );
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('faceEnrolled=true')
      );
      expect(res.faculty.length).toBe(1);
      expect(res.faculty[0].name).toBe('Prof. John Doe');
    });
  });

  describe('getFacultyDetail', () => {
    it('should query /admin/faculty/:id/detail and return full investigation data', async () => {
      const mockDetail = {
        faculty: {
          id: 'fac_123',
          name: 'Dr. Jane Smith',
          employeeId: 'LPU-002',
          email: 'jane@lpu.in',
          department: 'Electronics & Communication',
          status: 'ACTIVE',
          isActive: true,
          role: 'FACULTY',
          createdAt: '2026-02-01T00:00:00Z',
          biometricStatus: {
            isFaceEnrolled: true,
            enrolledAt: '2026-02-02T00:00:00Z',
            lastResetAt: null,
            resetCount: 0,
          },
        },
        attendanceSummary: {
          totalAttempts: 50,
          verifiedCount: 48,
          rejectedCount: 2,
          flaggedCount: 0,
          overrideCount: 1,
          attendanceRate: 96,
        },
        recentAttendance: [],
      };

      vi.mocked(apiClient).mockResolvedValueOnce({ data: mockDetail });

      const res = await adminService.getFacultyDetail('fac_123');
      expect(apiClient).toHaveBeenCalledWith('/admin/faculty/fac_123/detail');
      expect(res.faculty.name).toBe('Dr. Jane Smith');
      expect(res.faculty.biometricStatus.isFaceEnrolled).toBe(true);
      expect(res.attendanceSummary.attendanceRate).toBe(96);
    });
  });

  describe('resetFacultyFace', () => {
    it('should send POST to /admin/faculty/:id/reset-face with reason', async () => {
      const mockResetResponse = {
        reset: true,
        facultyId: 'fac_123',
        employeeId: 'LPU-002',
        message: 'Facial biometric profile reset successfully.',
      };

      vi.mocked(apiClient).mockResolvedValueOnce({ data: mockResetResponse });

      const res = await adminService.resetFacultyFace(
        'fac_123',
        'Optical prescription lens update'
      );

      expect(apiClient).toHaveBeenCalledWith('/admin/faculty/fac_123/reset-face', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Optical prescription lens update' }),
      });
      expect(res.reset).toBe(true);
      expect(res.message).toBe('Facial biometric profile reset successfully.');
    });
  });

  describe('getAuditLogsPaginated', () => {
    it('should query /admin/audit-logs with server-side filters', async () => {
      const mockAuditResponse = {
        logs: [
          {
            id: 'aud_1',
            action: 'ADMIN_RESET_FACULTY_FACE',
            category: 'ADMINISTRATIVE_DECISION',
            actorId: 'adm_1',
            actorName: 'System Administrator',
            actorRole: 'ADMIN',
            requestId: 'req_123',
            timestamp: '2026-10-09T01:00:00Z',
            details: { reason: 'Biometric update' },
            ipAddress: '10.0.0.1',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(apiClient).mockResolvedValueOnce({ data: mockAuditResponse });

      const res = await adminService.getAuditLogsPaginated({
        page: 1,
        limit: 20,
        action: 'ADMIN_RESET_FACULTY_FACE',
        search: 'Biometric',
      });

      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('/admin/audit-logs?')
      );
      expect(apiClient).toHaveBeenCalledWith(
        expect.stringContaining('action=ADMIN_RESET_FACULTY_FACE')
      );
      expect(res.logs.length).toBe(1);
      expect(res.logs[0].category).toBe('ADMINISTRATIVE_DECISION');
    });
  });
});
