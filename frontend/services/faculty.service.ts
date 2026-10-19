import { apiClient } from '../lib/api-client';

export interface BiometricUpdateRequestItem {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  createdAt: string;
  updatedAt?: string;
  adminReview?: {
    adminName?: string;
    reviewedAt?: string;
    notes?: string;
  } | null;
}

export interface BiometricUpdateStatusResponse {
  hasPendingRequest: boolean;
  pendingRequest: {
    id: string;
    status: 'PENDING';
    reason?: string;
    createdAt: string;
    updatedAt?: string;
  } | null;
  history: BiometricUpdateRequestItem[];
}

export interface SubmitBiometricUpdatePayload {
  image: string;
  reason?: string;
}

export interface SubmitBiometricUpdateResponse {
  id: string;
  employeeId: string;
  status: 'PENDING';
  reason: string;
  createdAt: string;
  message: string;
}

export const facultyService = {
  /**
   * Retrieves the current faculty member's biometric photo update requests & pending status.
   */
  async getBiometricUpdateRequests(): Promise<BiometricUpdateStatusResponse> {
    return await apiClient<BiometricUpdateStatusResponse>('/faculty/biometric-update-requests');
  },

  /**
   * Submits a candidate biometric profile photo for administrative review.
   */
  async submitBiometricUpdateRequest(
    payload: SubmitBiometricUpdatePayload
  ): Promise<SubmitBiometricUpdateResponse> {
    return await apiClient<SubmitBiometricUpdateResponse>('/faculty/biometric-update-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
