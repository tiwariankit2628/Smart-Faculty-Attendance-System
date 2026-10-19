'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Clock,
  MapPin,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Camera,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Building,
  Mail,
  Smartphone,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { adminService } from '../../services/admin.service';
import { AttendanceDetailRecord, AttendanceStatus } from '../../types';

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceId: string | null;
  onOverrideSuccess?: () => void;
}

export function AttendanceDetailModal({
  isOpen,
  onClose,
  attendanceId,
  onOverrideSuccess,
}: AttendanceDetailModalProps) {
  const [detail, setDetail] = useState<AttendanceDetailRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Evidence state
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceErrorCode, setEvidenceErrorCode] = useState<string | null>(null);
  const [isFullSizeOpen, setIsFullSizeOpen] = useState<boolean>(false);

  // Override action state
  const [overrideStatus, setOverrideStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccessMessage, setOverrideSuccessMessage] = useState<string | null>(null);

  // Fetch full detail when modal opens
  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl: string | null = null;

    if (!isOpen || !attendanceId) {
      setDetail(null);
      setLoadError(null);
      setEvidenceUrl(null);
      setEvidenceError(null);
      setEvidenceErrorCode(null);
      setIsFullSizeOpen(false);
      setOverrideError(null);
      setOverrideSuccessMessage(null);
      setOverrideReason('');
      return;
    }

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      setOverrideError(null);
      setOverrideSuccessMessage(null);

      try {
        const data = await adminService.getAttendanceDetail(attendanceId!);
        if (!isMounted) return;
        setDetail(data);

        // Set default override target status
        setOverrideStatus(data.status === 'VERIFIED' ? 'REJECTED' : 'VERIFIED');

        // Fetch secure verification evidence
        if (data.verificationEvidence?.hasEvidence) {
          setEvidenceLoading(true);
          try {
            const blobUrl = await adminService.getAttendanceEvidenceUrl(attendanceId!);
            if (!isMounted) {
              URL.revokeObjectURL(blobUrl);
              return;
            }
            createdBlobUrl = blobUrl;
            setEvidenceUrl(blobUrl);
          } catch (err: any) {
            if (!isMounted) return;
            setEvidenceErrorCode(err.code || 'UNKNOWN_ERROR');
            setEvidenceError(err.message || 'Evidence unavailable');
          } finally {
            if (isMounted) setEvidenceLoading(false);
          }
        } else {
          setEvidenceUrl(null);
          setEvidenceError('No verification evidence recorded for this attempt');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setLoadError(err.message || 'Attendance record is no longer available.');
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
  }, [isOpen, attendanceId]);

  const handleConfirmOverride = async () => {
    if (!attendanceId || !overrideReason.trim() || overrideReason.trim().length < 3) {
      setOverrideError('Please provide a descriptive audit reason (at least 3 characters).');
      return;
    }

    setIsSubmittingOverride(true);
    setOverrideError(null);

    try {
      await adminService.overrideAttendance(attendanceId, {
        status: overrideStatus,
        reason: overrideReason.trim(),
      });

      setOverrideSuccessMessage(`Attendance successfully updated to ${overrideStatus}.`);

      // Refresh detail data
      const updated = await adminService.getAttendanceDetail(attendanceId);
      setDetail(updated);
      setOverrideReason('');

      if (onOverrideSuccess) {
        onOverrideSuccess();
      }
    } catch (err: any) {
      setOverrideError(err.message || 'Failed to complete administrative override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const formatDateTime = (ts?: string) => {
    if (!ts) return 'Not available';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Investigation & Regularisation"
      maxWidth="3xl"
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            Loading comprehensive attendance telemetry...
          </p>
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            Attendance Record Unavailable
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto">
            {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : detail ? (
        <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
          {/* SECTION A: FACULTY INFORMATION */}
          <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <User className="w-4 h-4 text-indigo-500" />
                <span>FACULTY INFORMATION</span>
              </div>
              <Badge
                variant={detail.faculty.status === 'ACTIVE' ? 'emerald' : 'slate'}
                dot
              >
                Account: {detail.faculty.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Faculty Name
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {detail.faculty.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Employee ID
                </span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {detail.faculty.employeeId}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Department
                </span>
                <span className="text-slate-800 dark:text-slate-200">
                  {detail.faculty.department}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Email
                </span>
                <span className="text-slate-800 dark:text-slate-200 truncate block">
                  {detail.faculty.email}
                </span>
              </div>
            </div>
          </section>

          {/* SECTION B: ATTENDANCE INFORMATION & AUTOMATED VS ADMIN STATUS */}
          <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>ATTENDANCE RECORD & STATUS</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {detail.attendanceId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Attendance Date & Time
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateTime(detail.timestamp)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Original Automated Result
                </span>
                <Badge
                  variant={
                    detail.originalStatus === 'VERIFIED'
                      ? 'emerald'
                      : detail.originalStatus === 'FLAGGED'
                      ? 'amber'
                      : 'rose'
                  }
                  dot
                >
                  {detail.originalStatus}
                </Badge>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                  Current Status
                </span>
                <Badge
                  variant={
                    detail.status === 'VERIFIED'
                      ? 'emerald'
                      : detail.status === 'FLAGGED'
                      ? 'amber'
                      : 'rose'
                  }
                  dot
                >
                  {detail.status}
                </Badge>
              </div>
            </div>

            {/* Clear distinction: Automated vs Admin */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Status Classification
                </span>
                <p className="text-slate-700 dark:text-slate-300">
                  {detail.manualOverride ? (
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      Administrative Decision Overrode Original Automated Result
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Verification: <strong>Automatic</strong> (Governed by Automated Biometric & Geofence Engine — Admin approval not required)</span>
                    </span>
                  )}
                </p>
              </div>
              {detail.manualOverride && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Decision by:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {detail.manualOverride.adminName}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 3-COLUMN TELEMETRY GRID: LOCATION, IDENTITY, LIVENESS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SECTION C: LOCATION VERIFICATION */}
            <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span>LOCATION</span>
                  </div>
                  <Badge
                    variant={detail.locationVerification.verified ? 'emerald' : 'rose'}
                  >
                    {detail.locationVerification.verified ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Perimeter / Zone
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate block">
                      {detail.locationVerification.zoneName || 'Not available'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Zone Distance
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {Math.round(detail.locationVerification.distanceMeters ?? 0)}m
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        GPS Accuracy
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        ±{Math.round(detail.locationVerification.accuracyMeters ?? 0)}m
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Network Trust
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {detail.locationVerification.networkTrust || 'Not available'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                Verified: {formatDateTime(detail.locationVerification.timestamp)}
              </div>
            </section>

            {/* SECTION D: IDENTITY VERIFICATION */}
            <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <ScanFace className="w-3.5 h-3.5 text-indigo-500" />
                    <span>IDENTITY</span>
                  </div>
                  <Badge
                    variant={detail.identityVerification.identityMatched ? 'emerald' : 'rose'}
                  >
                    {detail.identityVerification.identityMatched ? 'MATCHED' : 'FAILED'}
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Face Detected
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {detail.identityVerification.faceDetected ? '✓ Detected' : '✕ Not detected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Identity Match
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {detail.identityVerification.identityMatched ? '✓ Verified' : '✕ Failed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Match Confidence
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                      {detail.identityVerification.confidenceScore !== undefined
                        ? `${Math.round(detail.identityVerification.confidenceScore * 100)}% similarity`
                        : 'Not available'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                Verified: {formatDateTime(detail.identityVerification.timestamp)}
              </div>
            </section>

            {/* SECTION E: LIVENESS VERIFICATION */}
            <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>LIVENESS</span>
                  </div>
                  <Badge
                    variant={detail.livenessVerification.livenessPassed ? 'emerald' : 'rose'}
                  >
                    {detail.livenessVerification.livenessPassed ? 'PASSED' : 'FAILED'}
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Challenge Type
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                      {detail.livenessVerification.challengeType || 'TURN_RIGHT'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Duration
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {detail.livenessVerification.captureDurationSeconds ?? 5.0}s
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Valid Frames
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {detail.livenessVerification.validFrameCount ?? 10} / {detail.livenessVerification.totalFrameCount ?? 10}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Anti-Spoof Score
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {detail.livenessVerification.livenessScore !== undefined
                        ? `${Math.round(detail.livenessVerification.livenessScore * 100)}%`
                        : 'Not available'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                Verified: {formatDateTime(detail.livenessVerification.timestamp)}
              </div>
            </section>
          </div>

          {/* SECTION F: VERIFICATION EVIDENCE (REUSES PHASE 8.2 SECURE ENDPOINT) */}
          <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Camera className="w-4 h-4 text-indigo-500" />
                <span>SECURE VERIFICATION EVIDENCE</span>
              </div>
              <Badge
                variant={
                  evidenceUrl
                    ? 'emerald'
                    : detail.verificationEvidence.isExpired
                    ? 'amber'
                    : 'slate'
                }
              >
                {evidenceUrl
                  ? 'Evidence Available'
                  : detail.verificationEvidence.isExpired
                  ? 'Evidence Expired'
                  : 'Evidence Unavailable'}
              </Badge>
            </div>

            {evidenceLoading ? (
              <div className="flex items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs">
                    Retrieving authorized verification snapshot...
                  </span>
                </div>
              </div>
            ) : evidenceUrl ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 flex items-center justify-center max-h-56 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidenceUrl}
                    alt="Biometric Verification Snapshot"
                    className="object-cover w-full h-56 rounded-lg transition-transform duration-200 group-hover:scale-105 cursor-pointer"
                    onClick={() => setIsFullSizeOpen(true)}
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
                    Verification Snapshot
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFullSizeOpen(true)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors text-xs flex items-center gap-1 shadow-sm"
                    title="View Full Size Snapshot"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Full Size</span>
                  </button>
                </div>

                <div className="space-y-3 text-[11px] p-2">
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Snapshot Metadata
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">Captured:</span> {formatDateTime(detail.verificationEvidence?.capturedAt || detail.timestamp)}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400">Evidence Status:</span>{' '}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Available</span>
                    </p>
                    {detail.verificationEvidence?.contentType && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <span className="text-slate-400">Format:</span> {detail.verificationEvidence.contentType}
                      </p>
                    )}
                    {detail.verificationEvidence?.size && (
                      <p className="text-slate-600 dark:text-slate-400 font-mono">
                        <span className="text-slate-400">File Size:</span> {Math.round(detail.verificationEvidence.size / 1024)} KB
                      </p>
                    )}
                  </div>

                  {detail.verificationEvidence?.retentionUntil && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                      Retention Policy: Eligible for automatic purge after{' '}
                      {new Date(detail.verificationEvidence.retentionUntil).toLocaleDateString()}
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsFullSizeOpen(true)}
                      className="w-full text-xs flex items-center justify-center gap-1.5"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>View Full Size</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
                <AlertTriangle
                  className={`w-5 h-5 ${
                    evidenceErrorCode === 'EVIDENCE_EXPIRED' || detail.verificationEvidence?.isExpired
                      ? 'text-amber-500'
                      : 'text-slate-400'
                  }`}
                />
                <div className="text-xs">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {detail.verificationEvidence?.isExpired || evidenceErrorCode === 'EVIDENCE_EXPIRED'
                      ? 'Evidence Expired'
                      : 'Evidence Unavailable'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    {detail.verificationEvidence?.isExpired || evidenceErrorCode === 'EVIDENCE_EXPIRED'
                      ? 'The 90-day retention period has elapsed and the evidence file was securely purged. Historical attendance verification remains valid.'
                      : 'No biometric verification snapshot was persisted for this historical attendance attempt.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* SECTION G: ADMINISTRATIVE HISTORY */}
          <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <History className="w-4 h-4 text-indigo-500" />
                <span>ADMINISTRATIVE DECISION HISTORY</span>
              </div>
            </div>

            {detail.manualOverride ? (
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="rose" size="sm">
                      {detail.manualOverride.previousStatus}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <Badge variant="emerald" size="sm">
                      {detail.manualOverride.newStatus}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatDateTime(detail.manualOverride.timestamp)}
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Authorized Administrator
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {detail.manualOverride.adminName}
                  </p>
                </div>

                <div className="text-xs bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Audit Justification
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 italic">
                    &quot;{detail.manualOverride.reason}&quot;
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                No administrative override has been executed for this attendance record.
              </p>
            )}
          </section>

          {/* SECTION H: AUDIT HISTORY */}
          <section className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <ShieldAlert className="w-4 h-4 text-indigo-500" />
                <span>AUDIT EVENT TIMELINE</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {detail.auditHistory?.length || 0} events recorded
              </span>
            </div>

            {detail.auditHistory && detail.auditHistory.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {detail.auditHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.action}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Actor: {item.actorId}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                No audit events currently linked to this record.
              </p>
            )}
          </section>

          {/* PART 3: ADMIN ACTIONS (EXISTING PHASE 8.1 OVERRIDE FLOW) */}
          <section className="bg-slate-100 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                Administrative Decision Action
              </span>
              <span className="text-[10px] text-slate-500">
                Requires mandatory audit justification
              </span>
            </div>

            {overrideSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{overrideSuccessMessage}</span>
              </div>
            )}

            {overrideError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{overrideError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOverrideStatus('VERIFIED');
                  setOverrideError(null);
                }}
                className={`py-2.5 px-3 rounded-xl font-semibold border text-center transition-all text-xs flex items-center justify-center gap-2 ${
                  overrideStatus === 'VERIFIED'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify Present
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverrideStatus('REJECTED');
                  setOverrideError(null);
                }}
                className={`py-2.5 px-3 rounded-xl font-semibold border text-center transition-all text-xs flex items-center justify-center gap-2 ${
                  overrideStatus === 'REJECTED'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <XCircle className="w-4 h-4" />
                Reject Attendance
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  Mandatory Audit Justification:
                </label>
                <span className="text-[10px] text-slate-400">
                  {overrideReason.trim().length} chars (min 3)
                </span>
              </div>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  setOverrideError(null);
                }}
                placeholder="Authorized off-campus duty, biometric hardware re-scan verified, emergency duty..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmittingOverride}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmOverride}
                isLoading={isSubmittingOverride}
                disabled={
                  !overrideReason.trim() ||
                  overrideReason.trim().length < 3 ||
                  isSubmittingOverride
                }
              >
                Confirm & Log Override
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </Modal>

    {/* Full Size Evidence Lightbox Modal */}
    {isFullSizeOpen && evidenceUrl && (
      <Modal
        isOpen={isFullSizeOpen}
        onClose={() => setIsFullSizeOpen(false)}
        title={`Verification Evidence Snapshot${detail ? ` — ${detail.faculty.name} (${detail.faculty.employeeId})` : ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 max-h-[75vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={evidenceUrl}
              alt="Full Size Verification Snapshot"
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
            <div>
              Captured: {formatDateTime(detail?.verificationEvidence?.capturedAt || detail?.timestamp || '')}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsFullSizeOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
}
