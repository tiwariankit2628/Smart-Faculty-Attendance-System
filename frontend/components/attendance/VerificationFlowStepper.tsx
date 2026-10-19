'use client';

import React from 'react';
import { CheckCircle2, Loader2, Circle, Camera, ScanFace, Activity, ShieldCheck, CheckCheck, Send } from 'lucide-react';

export interface VerificationFlowStepperProps {
  currentStep: number; // 1 to 6
  isFailed?: boolean;
}

const STEPS = [
  { step: 1, title: 'Camera Prep', fullTitle: 'Camera Preparation', icon: Camera },
  { step: 2, title: 'Positioning', fullTitle: 'Face Detection & Positioning', icon: ScanFace },
  { step: 3, title: 'Challenge', fullTitle: 'Liveness Challenge', icon: Activity },
  { step: 4, title: 'Identity', fullTitle: 'Identity Matching', icon: ShieldCheck },
  { step: 5, title: 'Verified', fullTitle: 'Verification Complete', icon: CheckCheck },
  { step: 6, title: 'Attendance', fullTitle: 'Attendance Submission', icon: Send },
];

export function VerificationFlowStepper({ currentStep, isFailed = false }: VerificationFlowStepperProps) {
  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Verification Flow
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
          Step {Math.min(currentStep, 6)} of 6
        </span>
      </div>

      {/* Responsive Step Progress Bar */}
      <div className="grid grid-cols-6 gap-1 sm:gap-1.5 items-center">
        {STEPS.map((s) => {
          const isComplete = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const isUpcoming = currentStep < s.step;
          const StepIcon = s.icon;

          return (
            <div
              key={s.step}
              className="flex flex-col items-center text-center group"
              title={s.fullTitle}
            >
              {/* Step indicator node */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isComplete
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isCurrent
                    ? isFailed
                      ? 'bg-rose-500 text-white ring-2 ring-rose-200 dark:ring-rose-900/40'
                      : 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:ring-indigo-900/50 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  isFailed ? (
                    <span className="text-xs font-bold">✕</span>
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )
                ) : (
                  <StepIcon className="w-3.5 h-3.5 opacity-70" />
                )}
              </div>

              {/* Title label */}
              <span
                className={`text-[10px] mt-1 font-medium truncate max-w-full ${
                  isComplete
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : isCurrent
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {s.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
