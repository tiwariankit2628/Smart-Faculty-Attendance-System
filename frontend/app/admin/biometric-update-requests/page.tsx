'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { adminService } from '../../../services/admin.service';
import { BiometricUpdateRequestAdminItem } from '../../../types';
import { BiometricUpdateDetailModal } from '../../../components/admin/BiometricUpdateDetailModal';

export default function BiometricUpdateRequestsPage() {
  const [requests, setRequests] = useState<BiometricUpdateRequestAdminItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal inspection state
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Summary counts
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.getBiometricUpdateRequests({
        page,
        limit,
        status: statusFilter,
      });

      setRequests(res.requests || []);
      setTotal(res.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);

      // Also fetch overview counts in background
      adminService
        .getBiometricUpdateRequests({ page: 1, limit: 1, status: 'PENDING' })
        .then((r) => setPendingCount(r.total || 0))
        .catch(() => {});
      adminService
        .getBiometricUpdateRequests({ page: 1, limit: 1, status: 'APPROVED' })
        .then((r) => setApprovedCount(r.total || 0))
        .catch(() => {});
      adminService
        .getBiometricUpdateRequests({ page: 1, limit: 1, status: 'REJECTED' })
        .then((r) => setRejectedCount(r.total || 0))
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to load biometric update requests.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDetail = (id: string) => {
    setSelectedRequestId(id);
    setIsModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsModalOpen(false);
    setSelectedRequestId(null);
  };

  const handleActionSuccess = () => {
    fetchRequests();
  };

  // Filter requests locally by search query (Name or Employee ID)
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (r.facultyName || r.faculty?.name || '').toLowerCase();
    const empId = (r.employeeId || '').toLowerCase();
    const dept = (r.facultyDepartment || r.faculty?.department || '').toLowerCase();
    return name.includes(query) || empId.includes(query) || dept.includes(query);
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Biometric Update Requests"
        subtitle="Review, audit, and approve faculty biometric photo replacement submissions before promoting to live attendance enrollment"
      />

      <div className="p-6 space-y-6">
        {/* Policy & Safeguard Banner */}
        <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-900/60 flex items-start gap-3.5 text-xs text-sky-900 dark:text-sky-200 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
              <span>Dual-Vault Biometric Governance Architecture</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200">
                Phase 10.5
              </span>
            </p>
            <p className="text-sky-700 dark:text-sky-300 leading-relaxed">
              Proposed faculty photographs remain safely isolated in an encrypted private vault. Approving a request promotes the photo and atomically replaces the active facial biometric vector. Rejection immediately purges candidate artifacts while strictly preserving the faculty member&apos;s current enrollment.
            </p>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setStatusFilter('PENDING');
              setPage(1);
            }}
            className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'PENDING'
                ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                : 'border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pending Review
              </span>
              <span className="relative flex h-2.5 w-2.5">
                {pendingCount > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {pendingCount}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Awaiting approval
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('APPROVED');
              setPage(1);
            }}
            className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'APPROVED'
                ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-md'
                : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Approved Updates
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {approvedCount}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Active & Enrolled
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('REJECTED');
              setPage(1);
            }}
            className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'REJECTED'
                ? 'border-rose-400 ring-2 ring-rose-400/20 shadow-md'
                : 'border-slate-200 dark:border-slate-800 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rejected Requests
              </span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {rejectedCount}
              </span>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Artifacts Purged
              </span>
            </div>
          </div>

          <div
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'ALL'
                ? 'border-indigo-400 ring-2 ring-indigo-400/20 shadow-md'
                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Submissions
              </span>
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {pendingCount + approvedCount + rejectedCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">All History</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'PENDING' && 'Pending'}
                {tab === 'APPROVED' && 'Approved'}
                {tab === 'REJECTED' && 'Rejected'}
                {tab === 'ALL' && 'All Requests'}
              </button>
            ))}
          </div>

          {/* Search Box and Refresh Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search faculty name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              variant="secondary"
              onClick={fetchRequests}
              disabled={loading}
              className="text-xs px-3 py-2 shrink-0"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Loading biometric update requests...
              </p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3 px-4">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{error}</p>
              <Button variant="secondary" onClick={fetchRequests} className="text-xs">
                Try Again
              </Button>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-20 text-center space-y-2 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Biometric Update Requests Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusFilter === 'PENDING'
                  ? 'All faculty biometric update requests have been reviewed.'
                  : 'No submissions match the selected filter or search term.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Candidate Photo</th>
                    <th className="py-3 px-4">Explanation</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Faculty Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {req.facultyName?.charAt(0) || req.faculty?.name?.charAt(0) || (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {req.facultyName || req.faculty?.name || 'Faculty'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {req.employeeId} • {req.facultyDepartment || req.faculty?.department || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </td>

                      {/* Candidate Photo Badge */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(req.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-sky-500" />
                          <span>Inspect Vault Photo</span>
                        </button>
                      </td>

                      {/* Faculty Explanation */}
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {req.reason ? (
                          <span className="italic">&ldquo;{req.reason}&rdquo;</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {req.status === 'PENDING' && (
                          <Badge variant="amber" dot className="font-semibold text-[11px]">
                            Pending
                          </Badge>
                        )}
                        {req.status === 'APPROVED' && (
                          <Badge variant="emerald" dot className="font-semibold text-[11px]">
                            Approved
                          </Badge>
                        )}
                        {req.status === 'REJECTED' && (
                          <Badge variant="rose" dot className="font-semibold text-[11px]">
                            Rejected
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {req.status === 'PENDING' ? (
                          <Button
                            variant="primary"
                            onClick={() => handleOpenDetail(req.id)}
                            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                          >
                            Review & Decide
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenDetail(req.id)}
                            className="text-xs px-2.5 py-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {filteredRequests.length} of {total} requests (Page {page} of {totalPages})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 text-xs"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail & Decision Inspection Modal */}
      <BiometricUpdateDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseDetail}
        requestId={selectedRequestId}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
}
