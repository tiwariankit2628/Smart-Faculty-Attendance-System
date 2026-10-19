'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Activity,
  FileCheck,
  ChevronRight,
  UserX,
  Camera,
} from 'lucide-react';
import { adminService } from '../../../services/admin.service';
import { DashboardStatsResponse } from '../../../types';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<string>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const loadStats = useCallback(
    async (selectedRange = range) => {
      setIsLoading(true);
      try {
        const params: { range?: string; startDate?: string; endDate?: string } = {
          range: selectedRange,
        };
        if (selectedRange === 'custom' && customStart && customEnd) {
          params.startDate = new Date(customStart).toISOString();
          params.endDate = new Date(customEnd + 'T23:59:59.999Z').toISOString();
        }

        const res = await adminService.getDashboardStats(params);
        if (res && res.overview) {
          setStats(res);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [range, customStart, customEnd]
  );

  useEffect(() => {
    loadStats();
  }, [range, loadStats]);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
  };

  const overview = stats?.overview || {
    totalAttempts: 0,
    verifiedCount: 0,
    rejectedCount: 0,
    flaggedCount: 0,
    overrideCount: 0,
    failureCount: 0,
    attendanceRate: 0,
  };

  const health = stats?.verificationHealth || {
    identityPassed: 0,
    identityFailed: 0,
    livenessPassed: 0,
    livenessFailed: 0,
    locationPassed: 0,
    locationFailed: 0,
    evidenceAvailable: 0,
    evidenceExpired: 0,
    suspiciousAttempts: 0,
  };

  const facultySummary = stats?.facultySummary || {
    totalFaculty: 0,
    activeFaculty: 0,
    inactiveFaculty: 0,
    facultyWithRecentFailures: 0,
  };

  const reviewQueue = stats?.reviewQueueSummary || {
    needingReview: 0,
    topReasons: [],
  };

  const trend = stats?.trend || [];
  const recentActivity = stats?.recentActivity || [];

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Institutional Attendance Intelligence & Command Center"
        subtitle="Lovely Professional University • Real-time telemetry, facial biometric audit & spatial validation"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 text-xs">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'custom', label: 'Custom' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => handleRangeChange(pill.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    range === pill.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => loadStats(range)}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              className="text-xs"
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Custom Date Range Picker if range === 'custom' */}
        {range === 'custom' && (
          <Card padding="sm" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Custom Range:
            </span>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => loadStats('custom')}
                disabled={!customStart || !customEnd}
                className="text-xs"
              >
                Apply Range
              </Button>
            </div>
          </Card>
        )}

        {/* SECTION A: Attendance Overview Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance Overview ({range.toUpperCase()})
            </h3>
            {stats?.dateRange && (
              <span className="text-[11px] font-mono text-slate-400">
                Period: {new Date(stats.dateRange.startDate).toLocaleDateString()} —{' '}
                {new Date(stats.dateRange.endDate).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Attempts */}
            <Card padding="md" className="space-y-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Attempts</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {overview.totalAttempts}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">All gate verification checks</p>
            </Card>

            {/* Verified / Present */}
            <Card padding="md" className="space-y-1.5 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Verified / Present</span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  {overview.attendanceRate}%
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200 tracking-tight">
                {overview.verifiedCount}
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500/80">Valid biometric & spatial</p>
            </Card>

            {/* Rejected */}
            <Card padding="md" className="space-y-1.5 border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20">
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">Rejected</span>
              <div className="text-2xl font-black text-rose-800 dark:text-rose-200 tracking-tight">
                {overview.rejectedCount}
              </div>
              <p className="text-[10px] text-rose-600 dark:text-rose-500/80">Failed security gates</p>
            </Card>

            {/* Flagged / Needs Review */}
            <Card padding="md" className="space-y-1.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Flagged For Review</span>
              <div className="text-2xl font-black text-amber-800 dark:text-amber-200 tracking-tight">
                {overview.flaggedCount}
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500/80">Anomalies or telemetry drift</p>
            </Card>

            {/* Manually Overridden */}
            <Card padding="md" className="space-y-1.5 border border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/20">
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400">Admin Overrides</span>
              <div className="text-2xl font-black text-purple-800 dark:text-purple-200 tracking-tight">
                {overview.overrideCount}
              </div>
              <p className="text-[10px] text-purple-600 dark:text-purple-500/80">Manual decisions logged</p>
            </Card>

            {/* Total Gate Failures */}
            <Card padding="md" className="space-y-1.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Failure Count</span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-300 tracking-tight">
                {overview.failureCount}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Rejected + Flagged</p>
            </Card>
          </div>
        </div>

        {/* SECTION B: Verification Health & Multi-Gate Telemetry */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Multi-Gate Verification Health & Telemetry
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Identity Gate */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Face Recognition</span>
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Match Pass
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {health.identityPassed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" /> Match Fail
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {health.identityFailed}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{
                    width: `${
                      health.identityPassed + health.identityFailed > 0
                        ? (health.identityPassed / (health.identityPassed + health.identityFailed)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Card>

            {/* Liveness Gate */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Liveness Gate</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Liveness Pass
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {health.livenessPassed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" /> Liveness Fail
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {health.livenessFailed}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      health.livenessPassed + health.livenessFailed > 0
                        ? (health.livenessPassed / (health.livenessPassed + health.livenessFailed)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Card>

            {/* Location Geofence */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Campus Geofence</span>
                <MapPin className="w-4 h-4 text-sky-500" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Inside Zone
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {health.locationPassed}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" /> Outside Zone
                  </span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {health.locationFailed}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{
                    width: `${
                      health.locationPassed + health.locationFailed > 0
                        ? (health.locationPassed / (health.locationPassed + health.locationFailed)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Card>

            {/* Evidence Availability */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Evidence Vault</span>
                <Camera className="w-4 h-4 text-purple-500" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" /> Available
                  </span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-300">
                    {health.evidenceAvailable}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Expired / Purged
                  </span>
                  <span className="font-mono font-bold text-slate-400">
                    {health.evidenceExpired}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{
                    width: `${
                      health.evidenceAvailable + health.evidenceExpired > 0
                        ? (health.evidenceAvailable /
                            (health.evidenceAvailable + health.evidenceExpired)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </Card>

            {/* Suspicious / Flagged Attempts */}
            <Card padding="md" className="border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Suspicious Drift</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-amber-800 dark:text-amber-200 tracking-tight">
                  {health.suspiciousAttempts}
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400/80">
                  Anomalous spatial coordinates or biometric edge thresholds
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* SECTION C & D: Trend Analytics & Queue / Faculty Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Breakdown */}
          <Card padding="md" className="lg:col-span-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                  Attendance Volume Trend & Gate Distribution
                </h3>
                <p className="text-[11px] text-slate-500">
                  Daily breakdown across verified, rejected, flagged, and overrides
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {trend.length} recorded day(s)
              </span>
            </div>

            {trend.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No attendance trend data recorded for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {trend.map((t) => (
                  <div
                    key={t.date}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{t.date}</span>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-emerald-600 dark:text-emerald-400">{t.verified} Ver</span>
                        <span className="text-rose-600 dark:text-rose-400">{t.rejected} Rej</span>
                        <span className="text-amber-600 dark:text-amber-400">{t.flagged} Flag</span>
                        <span className="text-purple-600 dark:text-purple-400">{t.overrides} Ovr</span>
                        <span className="text-slate-600 dark:text-slate-400 font-bold">Total: {t.total}</span>
                      </div>
                    </div>
                    {/* Visual proportion bar */}
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full flex overflow-hidden">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(t.verified / Math.max(t.total, 1)) * 100}%` }}
                        title={`Verified: ${t.verified}`}
                      />
                      <div
                        className="bg-rose-500"
                        style={{ width: `${(t.rejected / Math.max(t.total, 1)) * 100}%` }}
                        title={`Rejected: ${t.rejected}`}
                      />
                      <div
                        className="bg-amber-500"
                        style={{ width: `${(t.flagged / Math.max(t.total, 1)) * 100}%` }}
                        title={`Flagged: ${t.flagged}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Right Column: Review Queue Summary & Faculty Summary */}
          <div className="space-y-6">
            {/* Review Queue Summary */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                    Review Queue Status
                  </h3>
                </div>
                <Badge variant={reviewQueue.needingReview > 0 ? 'amber' : 'emerald'} dot>
                  {reviewQueue.needingReview} Pending
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Highest-Priority Review Reasons:</p>
                {reviewQueue.topReasons.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No records requiring review.</p>
                ) : (
                  <div className="space-y-1.5">
                    {reviewQueue.topReasons.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[190px]">{item.reason}</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-900/60 text-[10px]">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/admin/review-queue"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <span>Open Review Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Card>

            {/* Faculty Health Summary */}
            <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                    Faculty Roster Health
                  </h3>
                </div>
                <Link
                  href="/admin/faculty"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Manage Roster <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Total Faculty</span>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    {facultySummary.totalFaculty}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Active Accounts</span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {facultySummary.activeFaculty}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Inactive / Suspended</span>
                  <p className="text-lg font-black text-slate-600 dark:text-slate-400 mt-0.5">
                    {facultySummary.inactiveFaculty}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                  <span className="text-rose-600 dark:text-rose-400 text-[11px]">Recent Failures</span>
                  <p className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">
                    {facultySummary.facultyWithRecentFailures}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* SECTION E: Recent Activity Feed */}
        <Card padding="md" className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                Recent Institutional Activity Stream
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Live operational & audit events</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentActivity.length === 0 ? (
              <p className="py-6 text-center text-slate-400 text-xs">No recent activity logged.</p>
            ) : (
              recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        item.type === 'ATTENDANCE'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50'
                          : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50'
                      }`}
                    >
                      {item.type === 'ATTENDANCE' ? (
                        <FileCheck className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.facultyName} {item.employeeId ? `(${item.employeeId})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <Badge
                      variant={
                        item.status === 'VERIFIED'
                          ? 'emerald'
                          : item.status === 'REJECTED'
                          ? 'rose'
                          : item.status === 'FLAGGED'
                          ? 'amber'
                          : item.status === 'OVERRIDE'
                          ? 'indigo'
                          : 'slate'
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
