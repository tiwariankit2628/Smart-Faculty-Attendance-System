'use client';

import { Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AttendanceRecord } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate, formatTime } from '../../utils/formatters';

export interface RecentHistoryCardProps {
  records: AttendanceRecord[];
}

export function RecentHistoryCard({ records }: RecentHistoryCardProps) {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Recent Attendance
          </h3>
        </div>
        <Link
          href="/faculty/history"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {records.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No attendance records found.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {records.slice(0, 5).map((record) => (
            <div key={record.id} className="py-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(record.date)}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{formatTime(record.timestamp)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {record.locationVerification.geofenceName || 'Campus Zone'}
                  </span>
                </div>
              </div>

              <div>
                <Badge
                  variant={
                    record.status === 'VERIFIED'
                      ? 'emerald'
                      : record.status === 'FLAGGED'
                      ? 'amber'
                      : 'rose'
                  }
                  dot
                >
                  {record.status === 'VERIFIED' ? 'Verified' : record.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
