'use client';

import { Users, UserCheck, UserX, AlertTriangle, MapPin } from 'lucide-react';
import { AdminStats } from '../../services/admin.service';
import { Card } from '../ui/Card';

export interface StatsOverviewProps {
  stats: AdminStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const cards = [
    {
      title: 'Total Enrolled Faculty',
      value: stats.totalFaculty,
      detail: `${stats.activeFaculty} Active Accounts`,
      icon: <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      detail: `${stats.attendanceRate}% Attendance Rate`,
      icon: <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      title: 'Absent / Unrecorded',
      value: stats.absentToday,
      detail: 'Pending check-in deadline',
      icon: <UserX className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      bg: 'bg-slate-100 dark:bg-slate-800',
    },
    {
      title: 'Verification Flag Rate',
      value: `${stats.verificationFailureRate}%`,
      detail: 'Location/biometric rejections',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      title: 'Active Geofences',
      value: stats.activeGeofences,
      detail: 'Enforced campus zones',
      icon: <MapPin className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
      bg: 'bg-sky-50 dark:bg-sky-950/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <Card key={i} padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
              {c.title}
            </span>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
              {c.icon}
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {c.value}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{c.detail}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
