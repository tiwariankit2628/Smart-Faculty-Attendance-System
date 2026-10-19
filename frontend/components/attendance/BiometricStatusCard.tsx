'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  ShieldCheck,
  ScanFace,
  Sun,
  Activity,
  UserCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { BiometricStatusState } from '../../types';
import { Button } from '../ui/Button';

export interface BiometricStatusCardProps {
  status: BiometricStatusState;
  facultyName: string;
  isProcessing: boolean;
  onRetry?: () => void;
}

export function BiometricStatusCard({
  status,
  facultyName,
  isProcessing,
  onRetry,
}: BiometricStatusCardProps) {
  const isOverallPassed =
    status.faceDetected === 'passed' &&
    status.faceQuality === 'passed' &&
    status.livenessCheck === 'passed' &&
    status.identityMatch === 'passed';

  const isFailed =
    status.faceDetected === 'failed' ||
    status.faceQuality === 'failed' ||
    status.livenessCheck === 'failed' ||
    status.identityMatch === 'failed';

  const renderItemStatus = (
    label: string,
    itemStatus: 'idle' | 'evaluating' | 'passed' | 'failed',
    passedText: string,
    icon: React.ReactNode
  ) => {
    return (
      <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="text-slate-400 dark:text-slate-500">{icon}</div>
          <span
            className={`text-xs font-medium ${
              itemStatus === 'passed'
                ? 'text-slate-900 dark:text-slate-100 font-semibold'
                : itemStatus === 'failed'
                ? 'text-rose-700 dark:text-rose-400 font-semibold'
                : itemStatus === 'evaluating'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {itemStatus === 'passed' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{passedText}</span>
            </span>
          )}

          {itemStatus === 'evaluating' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Evaluating...</span>
            </span>
          )}

          {itemStatus === 'failed' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </span>
          )}

          {itemStatus === 'idle' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Circle className="w-3 h-3" />
              <span>Pending</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Biometric Verification
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px]">
          {facultyName}
        </span>
      </div>

      {/* 4 Required Status Items */}
      <div className="space-y-2">
        {renderItemStatus(
          'Face Detected',
          status.faceDetected,
          'Detected',
          <ScanFace className="w-4 h-4" />
        )}

        {renderItemStatus(
          'Face Quality',
          status.faceQuality,
          'Acceptable',
          <Sun className="w-4 h-4" />
        )}

        {renderItemStatus(
          'Liveness Check',
          status.livenessCheck,
          'Passed',
          <Activity className="w-4 h-4" />
        )}

        {renderItemStatus(
          'Identity Match',
          status.identityMatch,
          'Confirmed',
          <UserCheck className="w-4 h-4" />
        )}
      </div>

      {/* Success State: Strictly displayed ONLY after backend confirmation */}
      {isOverallPassed && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Identity Verified</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 pl-6 font-medium">
            Welcome, <strong className="font-semibold">{facultyName}</strong>
          </p>
        </div>
      )}

      {/* Failure Callout: Clear user-friendly failure explanations without technical leaks */}
      {isFailed && status.failureMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{status.failureTitle || 'Verification Failed'}</span>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium pl-6">
            {status.failureMessage}
          </p>
          {onRetry && (
            <div className="pt-1 pl-6">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs font-semibold w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
