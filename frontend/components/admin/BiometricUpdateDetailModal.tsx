'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Clock,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Camera,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building,
  Mail,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { adminService } from '../../services/admin.service';
import { BiometricUpdateRequestAdminItem } from '../../types';

interface BiometricUpdateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string | null;
  onActionSuccess?: () => void;
}

export function BiometricUpdateDetailModal({
  isOpen,
  onClose,
  requestId,
  onActionSuccess,
}: BiometricUpdateDetailModalProps) {
  const [request, setRequest] = useState<BiometricUpdateRequestAdminItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Photo streaming state
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Review action state
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'inspect' | 'approve' | 'reject'>('inspect');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) {
      setRequest(null);
      setCandidatePhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLoadError(null);
      setPhotoError(null);
      setActionError(null);
      setActionSuccess(null);
      setApprovalNotes('');
      setRejectionReason('');
      setActiveTab('inspect');
      return;
    }

    let isMounted = true;
    let createdBlobUrl: string | null = null;

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      setActionError(null);
      setActionSuccess(null);

      try {
        const data = await adminService.getBiometricUpdateRequestDetail(requestId!);
        if (!isMounted) return;
        setRequest(data);

        // Fetch candidate photo stream securely
        setPhotoLoading(true);
        setPhotoError(null);
        try {
          const blobUrl = await adminService.getBiometricUpdateRequestCandidatePhotoUrl(requestId!);
          if (!isMounted) {
            URL.revokeObjectURL(blobUrl);
            return;
          }
          createdBlobUrl = blobUrl;
          setCandidatePhotoUrl(blobUrl);
        } catch (err: any) {
          if (!isMounted) return;
          setPhotoError(err.message || 'Unable to stream candidate photo from private vault.');
        } finally {
          if (isMounted) setPhotoLoading(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setLoadError(err.message || 'Failed to load biometric update request detail.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [isOpen, requestId]);

  const handleApprove = async () => {
    if (!requestId) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await adminService.approveBiometricUpdateRequest(requestId, approvalNotes);
      setActionSuccess(res.message || 'Biometric update request approved successfully.');
      if (onActionSuccess) onActionSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve biometric update request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!requestId) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed || trimmed.length < 3) {
      setActionError('A meaningful rejection reason (at least 3 characters) is required.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await adminService.rejectBiometricUpdateRequest(requestId, trimmed);
      setActionSuccess(res.message || 'Biometric update request rejected.');
      if (onActionSuccess) onActionSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject biometric update request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Biometric Photo Update Request"
      maxWidth="2xl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Fetching secure biometric request details...
          </p>
        </div>
      ) : loadError ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Request Unavailable
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{loadError}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : request ? (
        <div className="space-y-6">
          {/* Top Faculty Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {request.facultyName || request.faculty?.name || 'Faculty Member'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    ID: {request.employeeId}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    {request.facultyDepartment || request.faculty?.department || 'Department N/A'}
                  </span>
                  {request.facultyEmail && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {request.facultyEmail}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {request.status === 'PENDING' && (
                <Badge variant="amber" className="text-xs font-semibold px-2.5 py-1">
                  PENDING REVIEW
                </Badge>
              )}
              {request.status === 'APPROVED' && (
                <Badge variant="emerald" className="text-xs font-semibold px-2.5 py-1">
                  APPROVED
                </Badge>
              )}
              {request.status === 'REJECTED' && (
                <Badge variant="rose" className="text-xs font-semibold px-2.5 py-1">
                  REJECTED
                </Badge>
              )}
            </div>
          </div>

          {/* Submission Timing & Faculty Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Submission Date & Time
              </span>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>{formatDate(request.createdAt)}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Faculty Justification / Notes
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                {request.reason ? `"${request.reason}"` : 'No additional reason provided by faculty.'}
              </p>
            </div>
          </div>

          {/* Candidate Photo Streaming Vault */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Proposed Biometric Profile Photo
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Encrypted Private Vault
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              {photoLoading ? (
                <div className="py-16 flex flex-col items-center space-y-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                  <span className="text-xs">Streaming image from private storage...</span>
                </div>
              ) : photoError ? (
                <div className="py-12 flex flex-col items-center space-y-2 text-rose-500 text-center px-4">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="text-xs font-medium">{photoError}</span>
                </div>
              ) : candidatePhotoUrl ? (
                <div className="relative group max-w-xs sm:max-w-sm rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={candidatePhotoUrl}
                    alt="Candidate Biometric Photograph"
                    className="w-full h-auto max-h-72 object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="text-white text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 rounded-full backdrop-blur-xs">
                      <ZoomIn className="w-3.5 h-3.5" />
                      Audited Biometric Face Photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-xs text-slate-400">No candidate photo available.</div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 text-center">
                Candidate photo is streamed securely through an authenticated admin endpoint. Internal paths and vectors are never exposed.
              </p>
            </div>
          </div>

          {/* Historical Review Details (if already reviewed) */}
          {request.status !== 'PENDING' && request.adminReview && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center gap-2">
                {request.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Administrative Review Decision
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">Reviewer: </span>
                  <span className="font-semibold">{request.adminReview.adminName || 'Administrator'}</span>
                </div>
                <div>
                  <span className="text-slate-400">Reviewed At: </span>
                  <span>{formatDate(request.adminReview.reviewedAt)}</span>
                </div>
              </div>
              {request.adminReview.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-400 block mb-0.5">Decision Notes / Reason:</span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium">
                    {request.adminReview.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Review Decision Actions (Pending Requests Only) */}
          {request.status === 'PENDING' && (
            <div className="space-y-4 pt-2">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('inspect')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'inspect'
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('approve')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'approve'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Update
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reject')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'reject'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Request
                </button>
              </div>

              {/* Action Feedback Alerts */}
              {actionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Review Error: </span>
                    {actionError}
                  </div>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{actionSuccess}</span>
                </div>
              )}

              {/* Approve Tab Content */}
              {activeTab === 'approve' && (
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Administrative Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="e.g. Identity verified against institutional records. Lighting and resolution verified."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Promotes candidate photo and atomically updates biometric enrollment vector.
                    </span>
                    <Button
                      variant="primary"
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Committing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Confirm Approval
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Reject Tab Content */}
              {activeTab === 'reject' && (
                <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Rejection Reason <span className="text-rose-500">* (Required, min 3 characters)</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Photo resolution is blurry. Please provide a well-lit frontal headshot."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Discards candidate photo and notifies faculty. Active biometric profile is preserved.
                    </span>
                    <Button
                      variant="danger"
                      onClick={handleReject}
                      disabled={isSubmitting || rejectionReason.trim().length < 3}
                      className="text-xs px-4 py-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Confirm Rejection
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
