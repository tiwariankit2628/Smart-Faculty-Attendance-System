import { User } from '../types';
import { apiClient } from '../lib/api-client';

interface BackendUser {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  email: string;
  employeeId: string;
  role: 'FACULTY' | 'ADMIN';
  department?: string;
  designation?: string;
  phone?: string;
  faceEmbeddingReference?: string | null;
  faceEnrolled?: boolean;
  profilePhotoReference?: string | null;
  photoUpdatedAt?: string | null;
  hasProfilePhoto?: boolean;
  isActive?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt?: string;
}

interface AuthResponse {
  user: BackendUser;
  token?: string;
  message?: string;
}

interface MeResponse {
  user: BackendUser;
}

export interface RegisterFacultyPayload {
  name: string;
  email: string;
  employeeId: string;
  password: string;
  department: string;
  faceImage?: string;
}

export function normalizeUser(raw: BackendUser): User {
  return {
    id: raw.id || raw._id || '',
    employeeId: raw.employeeId,
    fullName: raw.fullName || raw.name || 'Faculty Member',
    email: raw.email,
    role: raw.role,
    department: raw.department || 'General',
    designation:
      raw.designation ||
      (raw.role === 'ADMIN' ? 'Administrator' : 'Faculty Member'),
    phone: raw.phone || '+91 98765 43210',
    faceEnrolled: raw.faceEnrolled ?? Boolean(raw.faceEmbeddingReference),
    status: raw.status || (raw.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
    lastLoginAt: raw.lastLoginAt || new Date().toISOString(),
    profilePhotoReference: raw.profilePhotoReference || null,
    photoUpdatedAt: raw.photoUpdatedAt || null,
    hasProfilePhoto: Boolean(raw.profilePhotoReference || raw.hasProfilePhoto),
  };
}

export const authService = {
  /**
   * Pre-registration face validation check
   */
  async checkFace(imageBase64: string): Promise<{ valid: boolean; qualityScore: number; message: string }> {
    return await apiClient<{ valid: boolean; qualityScore: number; message: string }>('/auth/check-face', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
    });
  },

  /**
   * Register a new faculty account
   */
  async register(payload: RegisterFacultyPayload): Promise<User> {
    const result = await apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        employeeId: payload.employeeId.trim().toUpperCase(),
        password: payload.password,
        department: payload.department.trim(),
        faceImage: payload.faceImage,
      }),
    });

    const userPayload = result.user || result;
    return normalizeUser(userPayload as BackendUser);
  },

  /**
   * Authenticate against the backend using credentials.
   * The backend sets an HTTP-only secure cookie ('access_token').
   */
  async login(email: string, password: string): Promise<User> {
    const result = await apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const userPayload = result.user || result;
    return normalizeUser(userPayload as BackendUser);
  },

  /**
   * Request password reset verification code
   */
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    return await apiClient<{ message: string; resetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
    });
  },

  /**
   * Reset password with verification code
   */
  async resetPassword(payload: {
    email: string;
    resetToken: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    return await apiClient<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        resetToken: payload.resetToken.trim(),
        newPassword: payload.newPassword,
      }),
    });
  },

  /**
   * Fetch current session profile using the browser's HTTP-only cookie.
   * If cookie is missing or invalid, returns null without throwing.
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const result = await apiClient<MeResponse>('/auth/me');
      const userPayload = result.user || result;
      if (!userPayload || !userPayload.email) {
        return null;
      }
      return normalizeUser(userPayload as BackendUser);
    } catch {
      return null;
    }
  },

  /**
   * Invalidate session and instruct the backend to clear the HTTP-only cookie.
   */
  async logout(): Promise<void> {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Clean up even if network error happens
    }
  },
};
