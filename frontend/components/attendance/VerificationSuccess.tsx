'use client';

import { CheckCircle2, Calendar, Clock, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AttendanceRecord } from '../../types';
import { formatDate, formatTime } from '../../utils/formatters';
import { Button } from '../ui/Button';

export interface VerificationSuccessProps {
  record: AttendanceRecord;
  onDone?: () => void;
}

export function VerificationSuccess({ record, onDone }: VerificationSuccessProps) {
  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
      {/* Success Badge */}
      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Attendance Marked Successfully
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Biometric identity and location verified by server
        </p>
      </div>

      {/* Telemetry Receipt Box */}
      <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 text-xs space-y-2.5 text-left">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Date
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatDate(record.date)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Time
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatTime(record.timestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Zone
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
            {record.locationVerification.geofenceName || 'Main Campus'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Status
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            {record.status}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-2 pt-2">
        <Link href="/faculty/dashboard" className="w-full block">
          <Button variant="primary" size="lg" className="w-full" onClick={onDone}>
            Return to Dashboard
          </Button>
        </Link>
        <Link href="/faculty/history" className="w-full block">
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5">
            <span>View Attendance Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
