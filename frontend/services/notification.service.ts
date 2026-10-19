import { FacultyNotification, NotificationsResponse } from '../types';
import { apiClient } from '../lib/api-client';

export const notificationService = {
  /**
   * Retrieves paginated notifications for the authenticated faculty member.
   */
  async getNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
    try {
      const res = await apiClient<NotificationsResponse>(
        `/faculty/notifications?page=${page}&limit=${limit}`
      );
      return {
        notifications: res?.notifications || [],
        unreadCount: res?.unreadCount || 0,
        pagination: res?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
        },
      };
    } catch (err) {
      console.error('Failed to fetch faculty notifications:', err);
      return {
        notifications: [],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    }
  },

  /**
   * Retrieves the unread notification count for badge display.
   */
  async getUnreadCount(): Promise<number> {
    try {
      const res = await apiClient<{ unreadCount: number }>('/faculty/notifications/unread-count');
      return res?.unreadCount ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * Marks a single notification as read for the authenticated faculty member.
   */
  async markAsRead(id: string): Promise<FacultyNotification | null> {
    try {
      const res = await apiClient<{ notification: FacultyNotification }>(
        `/faculty/notifications/${id}/read`,
        { method: 'PATCH' }
      );
      return res?.notification || null;
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
      return null;
    }
  },

  /**
   * Marks all unread notifications as read for the authenticated faculty member.
   */
  async markAllAsRead(): Promise<number> {
    try {
      const res = await apiClient<{ updatedCount: number }>(
        '/faculty/notifications/read-all',
        { method: 'PATCH' }
      );
      return res?.updatedCount ?? 0;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      return 0;
    }
  },
};
