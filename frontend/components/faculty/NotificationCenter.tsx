'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CheckCheck,
  X,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { FacultyNotification } from '../../types';
import { notificationService } from '../../services/notification.service';
import { formatTime, formatDate } from '../../utils/formatters';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<FacultyNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<FacultyNotification | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications and unread count
  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationService.getNotifications(1, 20);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently ignore background count polling errors
    }
  }, []);

  // Initial load and lightweight polling (every 45s)
  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 45000);

    const onFocus = () => {
      refreshUnreadCount();
      if (isOpen) {
        loadNotifications();
      }
    };

    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadNotifications, refreshUnreadCount, isOpen]);

  // Close panel on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSelectedNotification(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Handle open toggle
  const toggleOpen = () => {
    if (!isOpen) {
      setIsLoading(true);
      loadNotifications().finally(() => setIsLoading(false));
    }
    setIsOpen((prev) => !prev);
  };

  // Mark single notification as read
  const handleMarkAsRead = async (notif: FacultyNotification) => {
    if (!notif.read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Backend persist
      await notificationService.markAsRead(notif.id);
    }
    setSelectedNotification(notif);
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    // Backend persist
    await notificationService.markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ATTENDANCE_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'ATTENDANCE_REJECTED':
        return <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'ATTENDANCE_REVIEW_REQUIRED':
      default:
        return <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'ATTENDANCE_APPROVED':
        return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300';
      case 'ATTENDANCE_REJECTED':
        return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300';
      case 'ATTENDANCE_REVIEW_REQUIRED':
      default:
        return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2940] transition-colors cursor-pointer"
        title="Notifications"
        aria-label="Faculty notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-xs ring-2 ring-white dark:ring-[#151F33] animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#151F33] rounded-3xl shadow-xl border border-slate-200 dark:border-[#2A3850] z-50 overflow-hidden flex flex-col max-h-[540px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-50/80 dark:bg-[#1C2940]/80 border-b border-slate-200 dark:border-[#2A3850] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-semibold text-[#5B45F5] dark:text-indigo-400 hover:underline px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2940] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#2A3850]">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 dark:bg-[#1C2940] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">You&apos;re all caught up!</p>
                <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] mt-1">No attendance notifications right now.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read;
                const formattedDate = new Date(notif.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                });
                const formattedTime = formatTime(notif.createdAt);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif)}
                    className={`p-3.5 transition-colors cursor-pointer text-left flex gap-3 relative ${
                      isUnread
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1C2940]/60'
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-[#5B45F5] dark:bg-indigo-400" />
                    )}

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1C2940] flex items-center justify-center">
                        {getNotificationIcon(notif.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <p
                          className={`text-xs truncate ${
                            isUnread
                              ? 'font-bold text-slate-900 dark:text-slate-100'
                              : 'font-semibold text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                          {formattedDate} • {formattedTime}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-[#A7B4CC] line-clamp-3 whitespace-pre-line leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${getNotificationBadgeColor(
                            notif.type
                          )}`}
                        >
                          {notif.type.replace('ATTENDANCE_', '')}
                        </span>

                        <span className="text-[10px] font-medium text-[#5B45F5] dark:text-indigo-400 flex items-center gap-0.5 hover:underline">
                          <span>View details</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 px-4 bg-slate-50/80 dark:bg-[#1C2940]/80 border-t border-slate-200 dark:border-[#2A3850] flex items-center justify-between text-[11px]">
            <Link
              href="/faculty/history"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[#5B45F5] dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Full Attendance History</span>
            </Link>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Secure LPU Biometrics</span>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#151F33] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-[#2A3850] space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1C2940] flex items-center justify-center">
                  {getNotificationIcon(selectedNotification.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedNotification.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatDate(selectedNotification.createdAt)} at {formatTime(selectedNotification.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2940]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-200 dark:border-[#2A3850] text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-sans">
              {selectedNotification.message}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="/faculty/history"
                onClick={() => {
                  setSelectedNotification(null);
                  setIsOpen(false);
                }}
                className="text-xs font-bold text-[#5B45F5] dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Go to Attendance History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2940] hover:bg-slate-200 dark:hover:bg-[#23334E] text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#2A3850] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
