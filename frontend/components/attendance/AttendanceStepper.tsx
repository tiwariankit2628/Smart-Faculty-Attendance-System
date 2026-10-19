'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { VerificationProgress } from '../../types';

export interface AttendanceStepperProps {
  progress: VerificationProgress;
}

export function AttendanceStepper({ progress }: AttendanceStepperProps) {
  const steps = [
    {
      title: 'Location Verified',
      isComplete: progress.locationVerified,
      isInProgress: false,
    },
    {
      title: 'Face Verification',
      isComplete: progress.faceVerified,
      isInProgress: progress.faceVerifying && !progress.faceVerified,
    },
    {
      title: 'Liveness Verification',
      isComplete: progress.livenessVerified,
      isInProgress: progress.livenessVerifying && !progress.livenessVerified,
    },
    {
      title: 'Attendance Processing',
      isComplete: progress.attendanceProcessed,
      isInProgress: progress.attendanceProcessing && !progress.attendanceProcessed,
    },
  ];

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Multi-Gate Verification Progress
      </h3>

      <div className="space-y-3.5">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="shrink-0">
              {step.isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : step.isInProgress ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-700" />
              )}
            </div>

            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  step.isComplete
                    ? 'text-slate-900 dark:text-slate-100'
                    : step.isInProgress
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                {step.title}
              </p>
            </div>

            {step.isComplete && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Done
              </span>
            )}
            {step.isInProgress && (
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 animate-pulse">
                Evaluating...
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
