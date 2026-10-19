'use client';

import { CheckCircle2, Clock, Camera, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { User, TodayAttendanceStatus } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatTime } from '../../utils/formatters';

export interface AttendanceCardProps {
  user: User;
  todayStatus: TodayAttendanceStatus;
}

export function AttendanceCard({ user, todayStatus }: AttendanceCardProps) {
  const isCheckedIn = todayStatus.checkIn?.marked;

  return (
    <Card padding="lg" className="space-y-5 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/60">
      {/* Faculty Identity Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Faculty Profile
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {user.fullName}
          </h2>
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold text-slate-700 dark:text-slate-300">
              {user.employeeId}
            </span>
            <span>•</span>
            <span className="truncate max-w-[170px]">{user.department}</span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[11px] text-slate-400 font-medium">Monthly Rate</span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-baseline">
            {todayStatus.attendancePercentage}
            <span className="text-xs font-semibold text-slate-500 ml-0.5">%</span>
          </div>
        </div>
      </div>

      {/* Today's Verification Status Box */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isCheckedIn
            ? 'bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/60'
            : 'bg-slate-100/70 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCheckedIn
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {isCheckedIn ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Today&apos;s Status
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isCheckedIn
                  ? `Checked in at ${formatTime(todayStatus.checkIn?.time)}`
                  : 'Attendance not yet recorded today'}
              </p>
            </div>
          </div>

          <Badge variant={isCheckedIn ? 'emerald' : 'slate'} dot={isCheckedIn}>
            {isCheckedIn ? 'Verified Present' : 'Pending'}
          </Badge>
        </div>

        {isCheckedIn && todayStatus.checkIn?.geofenceName && (
          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {todayStatus.checkIn.geofenceName}
            </span>
            <span className="font-semibold">Bio-Verified</span>
          </div>
        )}
      </div>

      {/* High-Priority Mark Attendance CTA */}
      <div>
        {isCheckedIn ? (
          <div className="space-y-2">
            <div className="w-full py-3.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-center text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              ✓ Attendance already confirmed for today
            </div>
            <Link href="/faculty/attendance" className="block text-center">
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1">
                <span>View check-in telemetry</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        ) : (
          <Link href="/faculty/attendance" className="block w-full">
            <Button
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold shadow-md shadow-indigo-200/50 dark:shadow-none"
              icon={<Camera className="w-5 h-5" />}
            >
              Mark Today&apos;s Attendance
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
