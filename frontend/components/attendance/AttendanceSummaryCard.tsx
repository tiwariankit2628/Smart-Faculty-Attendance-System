'use client';

import React from 'react';
import {
  MapPin,
  UserCheck,
  Activity,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';

export interface AttendanceSummaryCardProps {
  locationVerified: boolean;
  identityVerified: boolean;
  livenessVerified: boolean;
  zoneName?: string;
  distanceMeters?: number | null;
  facultyName: string;
  challengeType?: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onBackToCamera?: () => void;
}

export function AttendanceSummaryCard({
  locationVerified,
  identityVerified,
  livenessVerified,
  zoneName = 'Campus Geofence',
  distanceMeters,
  facultyName,
  challengeType,
  isSubmitting,
  onSubmit,
  onBackToCamera,
}: AttendanceSummaryCardProps) {
  const allChecksPassed = locationVerified && identityVerified && livenessVerified;

  const renderCheckItem = (
    title: string,
    isPassed: boolean,
    detailText: string,
    icon: React.ReactNode
  ) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isPassed
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}
          >
            {icon}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{detailText}</p>
          </div>
        </div>

        <div className="shrink-0">
          {isPassed ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
              <span>Failed</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 pt-1">
          Attendance Verification
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Review validated credentials before final submission
        </p>
      </div>

      {/* 3 Verification Checks */}
      <div className="space-y-2.5">
        {renderCheckItem(
          'Campus Location Verified',
          locationVerified,
          distanceMeters !== null && distanceMeters !== undefined
            ? `${zoneName} (${Math.round(distanceMeters)}m)`
            : zoneName,
          <MapPin className="w-4 h-4" />
        )}

        {renderCheckItem(
          'Identity Verified',
          identityVerified,
          `Enrolled profile: ${facultyName}`,
          <UserCheck className="w-4 h-4" />
        )}

        {renderCheckItem(
          'Live Presence Verified',
          livenessVerified,
          challengeType ? `Challenge passed: ${challengeType}` : 'Active challenge confirmed',
          <Activity className="w-4 h-4" />
        )}
      </div>

      {/* Submission Button: Strictly disabled if ANY check fails */}
      <div className="space-y-2 pt-1">
        <Button
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={!allChecksPassed || isSubmitting}
          className={`w-full font-bold shadow-md ${
            allChecksPassed
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none'
              : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          icon={
            isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )
          }
        >
          {isSubmitting ? 'Recording Attendance...' : 'Mark Attendance'}
        </Button>

        {!allChecksPassed && (
          <p className="text-[11px] text-center text-rose-500 dark:text-rose-400 font-medium">
            Attendance submission is unavailable because one or more security checks have not passed.
          </p>
        )}

        {onBackToCamera && !isSubmitting && (
          <button
            type="button"
            onClick={onBackToCamera}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors pt-1"
          >
            ← Back to Camera View
          </button>
        )}
      </div>
    </div>
  );
}
