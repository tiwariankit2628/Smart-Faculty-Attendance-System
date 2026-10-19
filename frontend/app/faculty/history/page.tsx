'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AttendanceRecord } from '../../../types';
import { attendanceService } from '../../../services/attendance.service';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatTime } from '../../../utils/formatters';

export default function FacultyHistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      try {
        const data = await attendanceService.getAttendanceHistory();
        if (mounted) setRecords(data);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadHistory();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = records.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  return (
    <div className="space-y-4 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pt-1 pb-6 transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <Link
          href="/faculty/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-[#A7B4CC] hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Attendance Log
        </h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-[#151F33] border border-slate-200/80 dark:border-[#2A3850] rounded-2xl text-xs font-semibold">
        {(['ALL', 'VERIFIED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              filter === tab
                ? 'bg-white dark:bg-[#1C2940] text-[#5B45F5] dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab === 'ALL' ? 'All Records' : tab === 'VERIFIED' ? 'Verified' : 'Flagged/Rejected'}
          </button>
        ))}
      </div>

      {/* Record Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white/70 dark:bg-[#151F33]/70 rounded-3xl border border-slate-200 dark:border-[#2A3850] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center py-12 text-xs text-slate-500 dark:text-[#A7B4CC]">
          No attendance records match the selected filter.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <Card key={record.id} padding="md" className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {formatDate(record.date)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] mt-0.5">
                    Time: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatTime(record.timestamp)}</span>
                  </p>
                </div>

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
                  {record.status}
                </Badge>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-[#2A3850] grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-[#A7B4CC]">
                <div>
                  <span>Campus Zone:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {record.locationVerification?.geofenceName || 'Main Campus'}
                  </p>
                </div>
                <div>
                  <span>Biometric Match:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {Math.round((record.faceVerification?.confidenceScore ?? 0) * 100)}% Match
                  </p>
                </div>
              </div>

              {record.manualOverride ? (
                <div
                  className={`p-2.5 rounded-2xl text-[11px] border ${
                    record.status === 'VERIFIED'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>Administrative Decision: {record.status === 'VERIFIED' ? 'Approved (Present)' : 'Rejected'}</span>
                    <span className="text-[10px] opacity-75">{formatTime(record.manualOverride.overriddenAt)}</span>
                  </div>
                  <p className="mt-1 font-medium">{record.manualOverride.reason}</p>
                </div>
              ) : record.rejectionReason ? (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-2.5 rounded-2xl text-[11px] text-rose-800 dark:text-rose-300">
                  <p className="font-semibold">Verification Note:</p>
                  <p className="mt-0.5">{record.rejectionReason}</p>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
