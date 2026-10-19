'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Globe,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Lock,
} from 'lucide-react';
import { AuditLogEvent } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface AuditLogViewerProps {
  logs: AuditLogEvent[];
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  actionFilter: string;
  setActionFilter: (a: string) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  onPageChange: (newPage: number) => void;
  onSelectLog: (log: AuditLogEvent) => void;
}

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'ATTENDANCE_OVERRIDE_VERIFIED', label: 'Override: Verify Present' },
  { value: 'ATTENDANCE_OVERRIDE_REJECTED', label: 'Override: Reject' },
  { value: 'ADMIN_RESET_FACULTY_FACE', label: 'Facial Biometric Reset' },
  { value: 'ADMIN_CREATE_FACULTY', label: 'Create Faculty Account' },
  { value: 'ADMIN_UPDATE_FACULTY', label: 'Update Faculty Account' },
  { value: 'ADMIN_DELETE_FACULTY', label: 'Delete Faculty Account' },
  { value: 'ADMIN_UPDATE_ATTENDANCE_ZONE', label: 'Geofence Zone Update' },
  { value: 'EVIDENCE_ACCESSED', label: 'Verification Evidence Accessed' },
  { value: 'EVIDENCE_PURGED', label: 'Verification Evidence Purged' },
  { value: 'SUSPICIOUS_ATTENDANCE_ATTEMPT', label: 'Suspicious Attendance Anomaly' },
  { value: 'ATTENDANCE_VERIFICATION_FAILED', label: 'Verification Failure' },
];

export function AuditLogViewer({
  logs,
  isLoading,
  pagination,
  searchTerm,
  setSearchTerm,
  actionFilter,
  setActionFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onPageChange,
  onSelectLog,
}: AuditLogViewerProps) {
  const getCategoryBadge = (category: AuditLogEvent['category']) => {
    switch (category) {
      case 'ADMINISTRATIVE_DECISION':
        return (
          <Badge variant="indigo" dot>
            Administrative Decision
          </Badge>
        );
      case 'AUTOMATED_VERIFICATION':
        return (
          <Badge variant="indigo" dot>
            Automated Verification
          </Badge>
        );
      case 'SECURITY_EVENT':
      default:
        return (
          <Badge variant="amber" dot>
            Security Telemetry
          </Badge>
        );
    }
  };

  return (
    <Card padding="none" className="overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Immutable Security & Operational Audit Center
          </h3>
          <p className="text-[11px] text-slate-500">
            Server-side verified compliance audit trail with cryptographic tamper deterrence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            {pagination.total} Total Audits Recorded
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, reason, actor, faculty ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Category & Action</th>
              <th className="px-5 py-3.5">Actor / Role</th>
              <th className="px-5 py-3.5">Associated Target</th>
              <th className="px-5 py-3.5">Timestamp</th>
              <th className="px-5 py-3.5">Network IP</th>
              <th className="px-5 py-3.5 text-right">Inspection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading audit records...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                  No audit log entries found matching criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const targetRef =
                  (log.details?.attendanceId as string) ||
                  (log.details?.employeeId as string) ||
                  (log.details?.facultyId as string) ||
                  (log.details?.zoneId as string) ||
                  '—';

                return (
                  <tr
                    key={log.id}
                    onClick={() => onSelectLog(log)}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(log.category)}
                        </div>
                        <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {log.action}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {log.actorName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Role: {log.actorRole}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 max-w-[150px] truncate">
                      {targetRef}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                      {log.ipAddress}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLog(log);
                        }}
                        icon={<Eye className="w-3.5 h-3.5" />}
                        className="text-xs text-indigo-600 dark:text-indigo-400"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Page <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.page}</span> of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.totalPages}</span> ({pagination.total} total events)
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page <= 1 || isLoading}
            onClick={() => onPageChange(pagination.page - 1)}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page >= pagination.totalPages || isLoading}
            onClick={() => onPageChange(pagination.page + 1)}
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
