import { describe, it, expect, vi, beforeEach } from 'vitest';
import { facultyService } from '../services/faculty.service';
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

describe('Faculty Service - Biometric Update Requests (Phase 10.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should fetch biometric update requests and pending status', async () => {
    const mockStatusResponse = {
      hasPendingRequest: true,
      pendingRequest: {
        id: 'req_123',
        status: 'PENDING' as const,
        reason: 'Updated glasses and appearance',
        createdAt: '2026-10-09T10:00:00.000Z',
      },
      history: [
        {
          id: 'req_123',
          status: 'PENDING' as const,
          reason: 'Updated glasses and appearance',
          createdAt: '2026-10-09T10:00:00.000Z',
          adminReview: null,
        },
      ],
    };

    vi.mocked(apiClient).mockResolvedValueOnce(mockStatusResponse);

    const result = await facultyService.getBiometricUpdateRequests();

    expect(apiClient).toHaveBeenCalledWith('/faculty/biometric-update-requests');
    expect(result.hasPendingRequest).toBe(true);
    expect(result.pendingRequest?.id).toBe('req_123');
    expect(result.history).toHaveLength(1);
  });

  it('2. should submit biometric update request payload to POST endpoint', async () => {
    const payload = {
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      reason: 'New faculty ID card photograph requirement',
    };

    const mockSubmitResponse = {
      id: 'req_sub_456',
      employeeId: 'EMP-BIO-999',
      status: 'PENDING' as const,
      reason: 'New faculty ID card photograph requirement',
      createdAt: '2026-10-09T10:05:00.000Z',
      message: 'Biometric profile photo update submitted successfully and is pending administrator review.',
    };

    vi.mocked(apiClient).mockResolvedValueOnce(mockSubmitResponse);

    const result = await facultyService.submitBiometricUpdateRequest(payload);

    expect(apiClient).toHaveBeenCalledWith('/faculty/biometric-update-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result.id).toBe('req_sub_456');
    expect(result.status).toBe('PENDING');
  });

  it('3. should propagate ApiError on failure without crashing', async () => {
    vi.mocked(apiClient).mockRejectedValueOnce(
      new Error('A pending biometric update request is already under administrative review.')
    );

    await expect(
      facultyService.submitBiometricUpdateRequest({
        image: 'data:image/jpeg;base64,/9j/test',
      })
    ).rejects.toThrow('A pending biometric update request is already under administrative review.');
  });
});
