import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../services/notification.service';
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

describe('Frontend Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch notifications with pagination parameters', async () => {
    const mockApiClient = vi.mocked(apiClient);
    mockApiClient.mockResolvedValueOnce({
      notifications: [
        {
          id: 'notif_1',
          facultyId: 'fac_123',
          attendanceId: 'att_456',
          type: 'ATTENDANCE_APPROVED',
          title: 'Attendance Verification Approved',
          message: 'Your attendance verification for 8 October 2026 has been approved.',
          read: false,
          createdAt: '2026-10-08T10:00:00.000Z',
          readAt: null,
        },
      ],
      unreadCount: 1,
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const result = await notificationService.getNotifications(1, 20);

    expect(mockApiClient).toHaveBeenCalledWith('/faculty/notifications?page=1&limit=20');
    expect(result.notifications.length).toBe(1);
    expect(result.unreadCount).toBe(1);
    expect(result.notifications[0].type).toBe('ATTENDANCE_APPROVED');
  });

  it('should fetch unread notification count', async () => {
    const mockApiClient = vi.mocked(apiClient);
    mockApiClient.mockResolvedValueOnce({ unreadCount: 3 });

    const count = await notificationService.getUnreadCount();

    expect(mockApiClient).toHaveBeenCalledWith('/faculty/notifications/unread-count');
    expect(count).toBe(3);
  });

  it('should mark a single notification as read', async () => {
    const mockApiClient = vi.mocked(apiClient);
    mockApiClient.mockResolvedValueOnce({
      notification: {
        id: 'notif_1',
        facultyId: 'fac_123',
        attendanceId: 'att_456',
        type: 'ATTENDANCE_REJECTED',
        title: 'Attendance Verification Rejected',
        message: 'Your attendance was rejected.',
        read: true,
        createdAt: '2026-10-08T10:00:00.000Z',
        readAt: '2026-10-08T10:05:00.000Z',
      },
    });

    const updated = await notificationService.markAsRead('notif_1');

    expect(mockApiClient).toHaveBeenCalledWith('/faculty/notifications/notif_1/read', {
      method: 'PATCH',
    });
    expect(updated).not.toBeNull();
    expect(updated?.read).toBe(true);
    expect(updated?.readAt).toBe('2026-10-08T10:05:00.000Z');
  });

  it('should mark all notifications as read', async () => {
    const mockApiClient = vi.mocked(apiClient);
    mockApiClient.mockResolvedValueOnce({ updatedCount: 4 });

    const count = await notificationService.markAllAsRead();

    expect(mockApiClient).toHaveBeenCalledWith('/faculty/notifications/read-all', {
      method: 'PATCH',
    });
    expect(count).toBe(4);
  });

  it('should gracefully handle network errors without crashing', async () => {
    const mockApiClient = vi.mocked(apiClient);
    mockApiClient.mockRejectedValueOnce(new Error('Network error'));

    const result = await notificationService.getNotifications();
    expect(result.notifications).toEqual([]);
    expect(result.unreadCount).toBe(0);

    mockApiClient.mockRejectedValueOnce(new Error('Network error'));
    const unread = await notificationService.getUnreadCount();
    expect(unread).toBe(0);
  });
});
