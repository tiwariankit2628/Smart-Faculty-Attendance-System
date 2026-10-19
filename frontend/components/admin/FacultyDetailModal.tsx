'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Building,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  Power,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { adminService } from '../../services/admin.service';
import { FacultyDetailResponse } from '../../types';
import { AttendanceDetailModal } from './AttendanceDetailModal';

export interface FacultyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  facultyId: string | null;
  onFacultyUpdated?: () => void;
}

export function FacultyDetailModal({
  isOpen,
  onClose,
  facultyId,
  onFacultyUpdated,
}: FacultyDetailModalProps) {
  const [data, setData] = useState<FacultyDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status toggle
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Reset face action state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Attendance detail modal nested state
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!facultyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminService.getFacultyDetail(facultyId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load faculty investigation profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && facultyId) {
      loadDetail();
      setShowResetConfirm(false);
      setResetReason('');
      setActionSuccess(null);
      setActionError(null);
    } else {
      setData(null);
    }
  }, [isOpen, facultyId]);

  const handleToggleStatus = async () => {
    if (!data?.faculty) return;
    setIsTogglingStatus(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminService.toggleFacultyStatus(data.faculty.id, data.faculty.isActive);
      setActionSuccess(
        `Account ${data.faculty.isActive ? 'deactivated' : 'activated'} successfully.`
      );
      await loadDetail();
      onFacultyUpdated?.();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update account status.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleResetFace = async () => {
    if (!data?.faculty) return;
    setIsResetting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await adminService.resetFacultyFace(
        data.faculty.id,
        resetReason.trim() || 'Administrative biometric reset by security audit'
      );
      setActionSuccess(res.message || 'Facial biometrics reset successfully.');
      setShowResetConfirm(false);
      setResetReason('');
      await loadDetail();
      onFacultyUpdated?.();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reset biometric profile.');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" title="Faculty Profile & Investigation">
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading faculty profile and audit metrics...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Notification banners */}
              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <span>{actionSuccess}</span>
                  <button
                    onClick={() => setActionSuccess(null)}
                    className="text-slate-400 hover:text-slate-600 ml-2"
                  >
                    ×
                  </button>
                </div>
              )}
              {actionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                  <span>{actionError}</span>
                  <button
                    onClick={() => setActionError(null)}
                    className="text-slate-400 hover:text-slate-600 ml-2"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Section A: Profile Header & Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-lg">
                    {data.faculty.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                      {data.faculty.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-300">
                        {data.faculty.employeeId}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {data.faculty.email}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        {data.faculty.department}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    size="sm"
                    variant={data.faculty.isActive ? 'outline' : 'primary'}
                    onClick={handleToggleStatus}
                    disabled={isTogglingStatus}
                    className="text-xs"
                    icon={<Power className="w-3.5 h-3.5" />}
                  >
                    {isTogglingStatus
                      ? 'Processing...'
                      : data.faculty.isActive
                      ? 'Deactivate'
                      : 'Activate Account'}
                  </Button>
                </div>
              </div>

              {/* Section B: Biometric Profile Status */}
              <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.faculty.biometricStatus.isFaceEnrolled ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                      Biometric Enrollment Status
                    </h4>
                  </div>
                  <div>
                    {data.faculty.biometricStatus.isFaceEnrolled ? (
                      <Badge variant="emerald" dot>
                        Enrolled & Active
                      </Badge>
                    ) : (
                      <Badge variant="amber" dot>
                        Pending Facial Enrollment
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Enrollment Timestamp</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {data.faculty.biometricStatus.enrolledAt
                        ? new Date(data.faculty.biometricStatus.enrolledAt).toLocaleString()
                        : 'Not Enrolled Yet'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Last Biometric Reset</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {data.faculty.biometricStatus.lastResetAt
                        ? new Date(data.faculty.biometricStatus.lastResetAt).toLocaleString()
                        : 'Never Reset'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Total Reset Audits</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {data.faculty.biometricStatus.resetCount} event(s) logged
                    </p>
                  </div>
                </div>

                {/* Reset Action Confirmation Area */}
                {data.faculty.biometricStatus.isFaceEnrolled && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    {!showResetConfirm ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowResetConfirm(true)}
                        icon={<RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
                        className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      >
                        Reset Biometric Facial Profile
                      </Button>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-3">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Confirm Facial Biometric Profile Reset</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Resetting will erase the active facial descriptor reference and require the faculty member to complete biometric re-enrollment on their next login.
                        </p>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Audit Justification (Required):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Identity mismatch dispute / Faculty requested re-enrollment"
                            value={resetReason}
                            onChange={(e) => setResetReason(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleResetFace}
                            disabled={isResetting || !resetReason.trim()}
                            className="bg-amber-600 hover:bg-amber-500 text-xs"
                          >
                            {isResetting ? 'Resetting...' : 'Confirm & Log Reset'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowResetConfirm(false);
                              setResetReason('');
                            }}
                            className="text-xs text-slate-500 dark:text-slate-400"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Section C: Attendance Summary Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Attendance Metrics Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Attempts</p>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {data.attendanceSummary.totalAttempts}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Verified</p>
                    <p className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                      {data.attendanceSummary.verifiedCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">Rejected</p>
                    <p className="text-xl font-black text-rose-800 dark:text-rose-200 mt-0.5">
                      {data.attendanceSummary.rejectedCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">Flagged</p>
                    <p className="text-xl font-black text-amber-800 dark:text-amber-200 mt-0.5">
                      {data.attendanceSummary.flaggedCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40">
                    <p className="text-[11px] text-purple-700 dark:text-purple-400">Overrides</p>
                    <p className="text-xl font-black text-purple-800 dark:text-purple-200 mt-0.5">
                      {data.attendanceSummary.overrideCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section D: Recent Attendance History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recent Verification History
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Last {data.recentAttendance.length} attendance attempts
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Identity</th>
                        <th className="px-4 py-3">Liveness</th>
                        <th className="px-4 py-3">Override Note</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {data.recentAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                            No attendance records recorded for this faculty member yet.
                          </td>
                        </tr>
                      ) : (
                        data.recentAttendance.map((rec) => (
                          <tr
                            key={rec.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-slate-700 dark:text-slate-300"
                          >
                            <td className="px-4 py-3 font-mono text-[11px]">
                              <div>{rec.date}</div>
                              <div className="text-slate-400">
                                {new Date(rec.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  rec.status === 'VERIFIED'
                                    ? 'emerald'
                                    : rec.status === 'REJECTED'
                                    ? 'rose'
                                    : 'amber'
                                }
                              >
                                {rec.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {rec.locationVerified ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[11px]">
                                  <XCircle className="w-3.5 h-3.5" /> Fail
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {rec.faceVerified ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Match
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[11px]">
                                  <XCircle className="w-3.5 h-3.5" /> Fail
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {rec.livenessVerified ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[11px]">
                                  <XCircle className="w-3.5 h-3.5" /> Fail
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[11px] max-w-[160px] truncate text-slate-500 dark:text-slate-400">
                              {rec.manualOverride ? (
                                <span className="text-purple-600 dark:text-purple-300">
                                  {rec.manualOverride.adminName}: {rec.manualOverride.reason}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedAttendanceId(rec.attendanceId || rec.id)}
                                icon={<Eye className="w-3.5 h-3.5" />}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                              >
                                Detail
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* Nested Attendance Detail Modal */}
      {selectedAttendanceId && (
        <AttendanceDetailModal
          isOpen={Boolean(selectedAttendanceId)}
          onClose={() => setSelectedAttendanceId(null)}
          attendanceId={selectedAttendanceId}
          onOverrideSuccess={() => {
            loadDetail();
            onFacultyUpdated?.();
          }}
        />
      )}
    </>
  );
}
