import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../services/admin.service';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string, public code: string, public status: number) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('Admin Service - Biometric Update Requests Review & Approval (Phase 10.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should fetch paginated biometric update requests with query params', async () => {
    const mockListResponse = {
      requests: [
        {
          id: 'req_001',
          facultyId: 'fac_001',
          employeeId: 'EMP-101',
          facultyName: 'Dr. Alan Turing',
          facultyDepartment: 'Computer Science',
          status: 'PENDING' as const,
          reason: 'Updated prescription glasses.',
          createdAt: '2026-10-09T09:00:00.000Z',
        },
      ],
      total: 1,
      pagination: {
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    };

    vi.mocked(apiClient).mockResolvedValueOnce(mockListResponse);

    const result = await adminService.getBiometricUpdateRequests({
      page: 1,
      limit: 15,
      status: 'PENDING',
    });

    expect(apiClient).toHaveBeenCalledWith(
      expect.stringContaining('/admin/biometric-update-requests?page=1&limit=15&status=PENDING')
    );
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].employeeId).toBe('EMP-101');
    expect(result.total).toBe(1);
  });

  it('2. should fetch single biometric update request detail', async () => {
    const mockDetail = {
      id: 'req_002',
      facultyId: 'fac_002',
      employeeId: 'EMP-102',
      facultyName: 'Dr. Ada Lovelace',
      facultyDepartment: 'Mathematics',
      status: 'PENDING' as const,
      reason: 'Updated haircut.',
      createdAt: '2026-10-09T09:15:00.000Z',
    };

    vi.mocked(apiClient).mockResolvedValueOnce({ request: mockDetail });

    const result = await adminService.getBiometricUpdateRequestDetail('req_002');

    expect(apiClient).toHaveBeenCalledWith('/admin/biometric-update-requests/req_002');
    expect(result.id).toBe('req_002');
    expect(result.facultyName).toBe('Dr. Ada Lovelace');
  });

  it('3. should approve biometric update request with notes', async () => {
    const mockApproveResponse = {
      success: true,
      id: 'req_001',
      status: 'APPROVED',
      message: 'Biometric update request approved successfully.',
    };

    vi.mocked(apiClient).mockResolvedValueOnce(mockApproveResponse);

    const result = await adminService.approveBiometricUpdateRequest('req_001', 'Face clearly visible.');

    expect(apiClient).toHaveBeenCalledWith('/admin/biometric-update-requests/req_001/approve', {
      method: 'POST',
      body: JSON.stringify({ notes: 'Face clearly visible.' }),
    });
    expect(result.success).toBe(true);
  });

  it('4. should reject biometric update request with mandatory reason', async () => {
    const mockRejectResponse = {
      success: true,
      id: 'req_001',
      status: 'REJECTED',
      message: 'Biometric update request has been rejected.',
    };

    vi.mocked(apiClient).mockResolvedValueOnce(mockRejectResponse);

    const result = await adminService.rejectBiometricUpdateRequest(
      'req_001',
      'Lighting too dim for face match.'
    );

    expect(apiClient).toHaveBeenCalledWith('/admin/biometric-update-requests/req_001/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Lighting too dim for face match.' }),
    });
    expect(result.success).toBe(true);
  });

  it('5. should fetch candidate photo blob and return object URL', async () => {
    const mockBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    global.fetch = mockFetch;

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:http://localhost/test-blob');

    const result = await adminService.getBiometricUpdateRequestCandidatePhotoUrl('req_001');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/biometric-update-requests/req_001/photo'),
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(result).toBe('blob:http://localhost/test-blob');

    createObjectURLSpy.mockRestore();
  });
});
