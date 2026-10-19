'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { ReviewQueueTable } from '../../../components/admin/ReviewQueueTable';

export default function AdminReviewQueuePage() {
  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Attendance Review Queue"
        subtitle="Unresolved attendance exceptions requiring administrator biometric inspection and final regularisation"
      />

      <div className="p-6 space-y-6">
        <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/60 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
          <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-indigo-950 dark:text-indigo-100">
              Institutional Attendance Integrity Protocol
            </p>
            <p className="text-indigo-700 dark:text-indigo-300">
              This queue lists attendance attempts flagged for review due to biometric mismatches, liveness test anomalies, or off-perimeter location telemetry. Inspect evidence snapshots and full telemetry before executing administrative regularisation.
            </p>
          </div>
        </div>

        <ReviewQueueTable />
      </div>
    </div>
  );
}
