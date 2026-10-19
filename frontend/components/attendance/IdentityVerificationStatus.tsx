'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ScanFace,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';

export interface IdentityVerificationStatusProps {
  isChecking: boolean;
  faceDetected: boolean;
  faceMatching: boolean;
  identityVerified: boolean;
  faceFailed: boolean;
  confidenceScore: number | null;
  errorMessage: string | null;
  facultyName: string;
  onRetake: () => void;
}

export function IdentityVerificationStatus({
  isChecking,
  faceDetected,
  faceMatching,
  identityVerified,
  faceFailed,
  confidenceScore,
  errorMessage,
  facultyName,
  onRetake,
}: IdentityVerificationStatusProps) {
  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Biometric Identity Pipeline
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-500 truncate max-w-[140px]">
          {facultyName}
        </span>
      </div>

      {/* Checklist of Real-Time Identity Stages */}
      <div className="space-y-2.5 text-xs">
        {/* Stage 1: Face Detected */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            {faceDetected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : faceFailed && errorMessage?.includes('No face') ? (
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : isChecking ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span
              className={`font-semibold ${
                faceDetected
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-500'
              }`}
            >
              Face Detected
            </span>
          </div>
          {faceDetected && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Verified ✓
            </span>
          )}
        </div>

        {/* Stage 2: Face Matching */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            {identityVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : faceFailed ? (
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : faceMatching || isChecking ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span
              className={`font-semibold ${
                faceMatching
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : identityVerified
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-500'
              }`}
            >
              Face Matching...
            </span>
          </div>
          {faceMatching && (
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">
              Comparing...
            </span>
          )}
          {identityVerified && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Matched ✓
            </span>
          )}
          {faceFailed && (
            <span className="text-[11px] font-bold text-rose-500">
              Mismatch ✕
            </span>
          )}
        </div>

        {/* Stage 3: Identity Verification Outcome */}
        {identityVerified && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Identity verified successfully.</span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-6">
              Confirmed match for <strong className="font-semibold">{facultyName}</strong>
              {confidenceScore !== null && (
                <span> (Similarity: {typeof confidenceScore === 'number' ? confidenceScore.toFixed(4) : confidenceScore})</span>
              )}
            </p>
          </div>
        )}

        {/* Failure Callout with exact requested error text */}
        {faceFailed && errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Face Verification Failed</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
              {errorMessage}
            </p>

            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onRetake}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="w-full text-xs font-semibold"
              >
                Retake Photo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
