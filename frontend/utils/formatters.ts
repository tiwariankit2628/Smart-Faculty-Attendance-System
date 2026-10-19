import { AttendanceStatus } from '../types';

/**
 * Format ISO date string into readable Date (e.g. "Tuesday, Oct 6, 2026")
 */
export function formatDate(isoOrDateString?: string | Date): string {
  if (!isoOrDateString) return '--';
  const date = typeof isoOrDateString === 'string' ? new Date(isoOrDateString) : isoOrDateString;
  if (isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Format ISO date string into 12-hour local time (e.g. "09:14 AM")
 */
export function formatTime(isoOrDateString?: string | Date): string {
  if (!isoOrDateString) return '--';
  const date = typeof isoOrDateString === 'string' ? new Date(isoOrDateString) : isoOrDateString;
  if (isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Returns Tailwind color tokens and labels for attendance statuses
 */
export function getStatusBadgeConfig(status: AttendanceStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'VERIFIED':
      return {
        label: 'Verified Present',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
      };
    case 'FLAGGED':
      return {
        label: 'Flagged for Review',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        dotClass: 'bg-rose-500',
      };
    default:
      return {
        label: 'Unknown',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
      };
  }
}
