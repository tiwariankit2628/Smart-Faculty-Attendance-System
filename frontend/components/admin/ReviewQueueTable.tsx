'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  AlertOctagon,
  Eye,
  CheckCircle2,
  XCircle,
  Camera,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { adminService } from '../../services/admin.service';
import { ReviewQueueItem, ReviewQueueResponse } from '../../types';
import { AttendanceDetailModal } from './AttendanceDetailModal';

export function ReviewQueueTable() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters state
  const [search, setSearch] = useState<string>('');
  const [department, setDepartment] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [hasEvidence, setHasEvidence] = useState<string>('ALL');

  // Modal investigation state
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: ReviewQueueResponse = await adminService.getReviewQueue({
        page,
        limit,
        search: search.trim() || undefined,
        department: department !== 'ALL' ? department : undefined,
        status: status !== 'ALL' ? status : undefined,
        hasEvidence: hasEvidence !== 'ALL' ? hasEvidence : undefined,
      });

      setItems(response.items || []);
      setTotal(response.pagination?.total ?? 0);
      setTotalPages(response.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || 'Unable to load review queue. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, department, status, hasEvidence]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQueue();
  };

  const handleOpenReview = (attendanceId: string) => {
    setSelectedAttendanceId(attendanceId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAttendanceId(null);
  };

  const handleDecisionSuccess = () => {
    // When an override decision is made, record leaves active review queue
    fetchQueue();
  };

  const formatTime = (ts?: string) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const departments = [
    'ALL',
    'Computer Science & Engineering',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Management Studies',
    'Biotechnology',
  ];

  return (
    <>
      <div className="space-y-4">
        {/* Filter Controls Bar */}
        <Card padding="none" className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
          >
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Department Filter */}
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'ALL' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses (Flagged / Rejected)</option>
                <option value="FLAGGED">Flagged for Review</option>
                <option value="REJECTED">Automated Rejected</option>
              </select>

              {/* Evidence Filter */}
              <select
                value={hasEvidence}
                onChange={(e) => {
                  setHasEvidence(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Evidence States</option>
                <option value="true">Evidence Available</option>
                <option value="false">No Evidence</option>
              </select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="text-xs"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={fetchQueue}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
                className="text-xs"
              >
                Refresh
              </Button>
            </div>
          </form>
        </Card>

        {/* Queue Table */}
        <Card padding="none" className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Review Reason</th>
                  <th className="py-3 px-4 text-center">Telemetry Checks</th>
                  <th className="py-3 px-4 text-center">Evidence</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32 mb-1" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24 mb-1" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-28" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-4 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <AlertOctagon className="w-8 h-8 text-rose-500 mx-auto" />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {error}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={fetchQueue}
                          className="mt-2"
                        >
                          Retry Connection
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 px-4 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          All caught up!
                        </h4>
                        <p className="text-xs text-slate-500">
                          No attendance records currently require administrator review.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Faculty Info */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.faculty?.name || 'Unknown Faculty'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.faculty?.department || 'N/A'}
                          </p>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.faculty?.employeeId || 'N/A'}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                          {formatDate(item.date)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatTime(item.timestamp)}
                        </div>
                      </td>

                      {/* Derived Review Reason */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <AlertOctagon className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{item.reviewReason}</span>
                        </span>
                      </td>

                      {/* Telemetry Status Summary (Liveness, Identity, Location) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          {/* Liveness Check */}
                          <span
                            title={`Liveness: ${item.liveness?.passed ? 'Passed' : 'Failed'}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.liveness?.passed
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            Live:{item.liveness?.passed ? '✓' : '✕'}
                          </span>

                          {/* Identity Check */}
                          <span
                            title={`Identity: ${item.identity?.matched ? 'Matched' : 'Mismatch'}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.identity?.matched
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            Bio:{item.identity?.matched ? '✓' : '✕'}
                          </span>

                          {/* Location Check */}
                          <span
                            title={`Location: ${item.location?.verified ? 'Verified' : 'Out of bounds'}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.location?.verified
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            Geo:{item.location?.verified ? '✓' : '✕'}
                          </span>
                        </div>
                      </td>

                      {/* Evidence Badge */}
                      <td className="py-3 px-4 text-center">
                        {item.evidence?.hasEvidence ? (
                          <span
                            title={item.evidence.isExpired ? 'Evidence Expired' : 'Snapshot Available'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              item.evidence.isExpired
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            }`}
                          >
                            <Camera className="w-3 h-3" />
                            <span>{item.evidence.isExpired ? 'Expired' : 'Available'}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">None</span>
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            item.currentStatus === 'VERIFIED'
                              ? 'emerald'
                              : item.currentStatus === 'FLAGGED'
                              ? 'amber'
                              : 'rose'
                          }
                          size="sm"
                          dot
                        >
                          {item.currentStatus}
                        </Badge>
                      </td>

                      {/* Action: Review Button */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenReview(item.attendanceId || item.id)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                          className="text-xs"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {items.length > 0 ? (page - 1) * limit + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(page * limit, total)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> records
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <span className="px-2 text-slate-600 dark:text-slate-400 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                icon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Investigation Modal */}
      <AttendanceDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        attendanceId={selectedAttendanceId}
        onOverrideSuccess={handleDecisionSuccess}
      />
    </>
  );
}
