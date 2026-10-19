'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  KeyRound,
  LogOut,
  Camera,
  Check,
  Copy,
  Clock,
  Info,
  CalendarCheck,
  FileText,
  Sparkles,
  History,
  CheckCircle2,
  ChevronRight,
  Settings,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  facultyService,
  BiometricUpdateStatusResponse,
} from '../../../services/faculty.service';
import { BiometricUpdateModal } from '../../../components/faculty/BiometricUpdateModal';
import { CampusIllustration } from '../../../components/faculty/CampusIllustration';

export default function FacultyProfilePage() {
  const { user, logout } = useAuth();
  const [copiedEmpId, setCopiedEmpId] = useState(false);
  const [showUpdatePolicyModal, setShowUpdatePolicyModal] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [statusData, setStatusData] = useState<BiometricUpdateStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadRequestsStatus = async () => {
    try {
      const data = await facultyService.getBiometricUpdateRequests();
      setStatusData(data);
    } catch (err) {
      console.error('Failed to load biometric update status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadRequestsStatus();
  }, []);

  if (!user) {
    return (
      <div className="space-y-4 animate-pulse pt-2">
        <div className="h-44 bg-white/70 dark:bg-[#151F33]/70 rounded-3xl border border-slate-200 dark:border-[#2A3850]" />
        <div className="h-56 bg-white/70 dark:bg-[#151F33]/70 rounded-3xl border border-slate-200 dark:border-[#2A3850]" />
      </div>
    );
  }

  const handleCopyEmpId = async () => {
    try {
      await navigator.clipboard.writeText(user.employeeId);
      setCopiedEmpId(true);
      setTimeout(() => setCopiedEmpId(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  // Extract initials for avatar
  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'DA';

  const hasPending = Boolean(statusData?.hasPendingRequest && statusData.pendingRequest);
  const pendingReq = statusData?.pendingRequest;

  return (
    <div className="space-y-5 pb-8 pt-1">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3.5 rounded-2xl bg-[#E7FAF1] dark:bg-emerald-950/60 border border-[#BFF0D7] dark:border-emerald-800/80 flex items-start justify-between gap-3 text-xs text-[#065F46] dark:text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-[#059669] dark:text-emerald-400 hover:text-[#065F46] text-sm font-bold leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. FACULTY IDENTITY HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#EAF3FF] via-[#F4EFFF] to-[#FFFFFF] dark:from-[#17223D] dark:via-[#1D1B36] dark:to-[#151F33] p-6 border border-slate-200 dark:border-[#2A3850] shadow-xs transition-colors duration-150">
        {/* Decorative Campus Building Illustration on Right */}
        <div className="absolute -bottom-2 -right-4 w-52 sm:w-72 h-auto opacity-75 sm:opacity-90 dark:opacity-30 pointer-events-none">
          <CampusIllustration className="w-full h-auto" />
        </div>

        <div className="relative z-10 space-y-4">
          {/* Top Status Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 border border-[#E0D7FF] dark:border-indigo-800/80">
              Faculty Member
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] border border-[#BFF0D7] dark:border-emerald-800/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Active Account
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] border border-[#BFF0D7] dark:border-emerald-800/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              {user.faceEnrolled ? 'Biometrics Enrolled' : 'Pending Enrollment'}
            </span>
            {hasPending && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF3E5] dark:bg-amber-950/60 text-[#F97316] dark:text-amber-400 border border-[#FFE2C2] dark:border-amber-800/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                Photo Update Pending
              </span>
            )}
          </div>

          {/* Profile Identity Details */}
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar with Circular Purple Gradient & Green Verification Pin */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-[#2E1896] via-[#5B45F5] to-[#7865FF] text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-md select-none ring-4 ring-white dark:ring-[#151F33]">
                {initials}
              </div>
              <div
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center border-2 border-white dark:border-[#151F33] shadow-xs"
                title="Verified Account"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            {/* Name, Designation & Department */}
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug truncate">
                {user.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A7B4CC] font-medium leading-tight">
                {user.designation || 'Faculty Member'}
              </p>
              <p className="text-xs text-[#5B45F5] dark:text-indigo-400 font-semibold truncate">
                {user.department || 'School of Computer Science & Engineering (SCSE)'}
              </p>
            </div>
          </div>

          {/* Micro Metadata Bar */}
          <div className="pt-1 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="inline-flex items-center gap-1.5 bg-white/95 dark:bg-[#151F33]/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A3850] shadow-2xs">
              <KeyRound className="w-3.5 h-3.5 text-[#5B45F5] dark:text-indigo-400" />
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {user.employeeId}
              </span>
              <button
                type="button"
                onClick={handleCopyEmpId}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-0.5 cursor-pointer"
                title="Copy Employee ID"
                aria-label="Copy Employee ID"
              >
                {copiedEmpId ? (
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/95 dark:bg-[#151F33]/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A3850] shadow-2xs text-slate-800 dark:text-slate-200 font-medium max-w-xs truncate">
              <Mail className="w-3.5 h-3.5 text-[#5B45F5] dark:text-indigo-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. RESPONSIVE TWO-COLUMN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* COLUMN A: INSTITUTIONAL INFORMATION */}
        <div className="bg-white dark:bg-[#151F33] rounded-3xl p-6 border border-slate-200 dark:border-[#2A3850] shadow-xs space-y-4 transition-colors duration-150">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-[#2A3850]">
            <div className="w-9 h-9 rounded-xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Institutional Information
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] mt-0.5">
                Verified campus credentials
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Row 1: Official Employee ID */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] dark:bg-sky-950/60 text-[#2563EB] dark:text-sky-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 block">
                    Official Employee ID
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {user.employeeId}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF3FF] dark:bg-sky-950/60 text-[#2563EB] dark:text-sky-400 border border-[#CDE1FF] dark:border-sky-800/80 shrink-0">
                Primary Key
              </span>
            </div>

            {/* Row 2: Academic Department */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850]">
              <div className="w-9 h-9 rounded-xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 block">
                  Academic Department
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-snug block">
                  {user.department || 'School of Computer Science & Engineering (SCSE)'}
                </span>
              </div>
            </div>

            {/* Row 3: Institutional Email */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850]">
              <div className="w-9 h-9 rounded-xl bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 block">
                  Institutional Email
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate block">
                  {user.email}
                </span>
              </div>
            </div>

            {/* Row 4: Contact Phone */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850]">
              <div className="w-9 h-9 rounded-xl bg-[#FFF3E5] dark:bg-amber-950/60 text-[#F97316] dark:text-amber-400 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 block">
                  Contact Phone
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block">
                  {user.phone || '+91 98765 43210'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN B: BIOMETRIC PROFILE & RENEWAL */}
        <div className="space-y-5">
          {/* CARD B1: BIOMETRIC PROFILE CARD */}
          <div className="bg-white dark:bg-[#151F33] rounded-3xl p-6 border border-slate-200 dark:border-[#2A3850] shadow-xs space-y-4 transition-colors duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2A3850]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] flex items-center justify-center shrink-0">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Biometric Profile
                  </h2>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] border border-[#BFF0D7] dark:border-emerald-800/80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Enrolled
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#A7B4CC] leading-relaxed">
              Facial recognition vector calibrated as a 128-dimensional vector (OpenCV SFace).
            </p>

            {/* Soft Green Biometrics Active Panel */}
            <div className="p-3.5 rounded-2xl bg-[#E7FAF1] dark:bg-emerald-950/40 border border-[#BFF0D7] dark:border-emerald-800/80 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#151F33] text-[#10B981] flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#065F46] dark:text-emerald-300">Biometrics Active</p>
                <p className="text-[11px] text-[#047857] dark:text-emerald-400 mt-0.5 leading-snug">
                  Your biometric profile is enrolled and working properly.
                </p>
              </div>
            </div>

            {/* Profile Photo Storage Status */}
            <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Profile Photo Storage
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF3FF] dark:bg-sky-950/60 text-[#2563EB] dark:text-sky-400 border border-[#CDE1FF] dark:border-sky-800/80">
                  {user.hasProfilePhoto ? 'Photo On File' : 'No Photo Archived'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] leading-relaxed">
                Active profile uses initials avatar. Attendance snapshots are restricted to compliance audits.
              </p>
            </div>
          </div>

          {/* CARD B2: BIOMETRIC PHOTO RENEWAL CARD */}
          <div className="bg-gradient-to-b from-[#FBF9FF] to-[#F7F4FF] dark:from-[#1D1B36] dark:to-[#151F33] rounded-3xl p-5 border border-[#E4DCFF] dark:border-[#2A3850] shadow-xs space-y-3 transition-colors duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Biometric Photo Renewal
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 border border-[#E0D7FF] dark:border-indigo-800/80">
                {hasPending ? 'Under Review' : 'Ready'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] leading-relaxed">
              Submit an updated photograph for administrator review. Your existing active biometric profile remains 100% functional.
            </p>

            {hasPending && pendingReq ? (
              <div className="p-3 rounded-xl bg-[#FFF3E5] dark:bg-amber-950/60 border border-[#FFE2C2] dark:border-amber-800/80 text-[11px] text-[#9A3412] dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                  <span>Update Awaiting Administrative Review</span>
                </div>
                <p className="text-[10px] text-[#C2410C] dark:text-amber-400">
                  Submitted on {new Date(pendingReq.createdAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#5B45F5] to-[#7865FF] hover:from-[#4834DB] hover:to-[#6754F0] text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Request Biometric Photo Update</span>
                </button>
                <div className="flex items-center justify-center gap-1 text-[11px] text-[#5B45F5] dark:text-indigo-400 font-medium">
                  <Info className="w-3.5 h-3.5" />
                  <span>Requires administrative approval</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. REQUEST HISTORY SECTION */}
      {statusData && statusData.history && statusData.history.length > 0 && (
        <div className="bg-white dark:bg-[#151F33] rounded-3xl p-6 border border-slate-200 dark:border-[#2A3850] shadow-xs space-y-3.5 transition-colors duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2A3850]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#5B45F5] dark:text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Photo Update History
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {statusData.history.length} submission(s) logged
            </span>
          </div>

          <div className="space-y-2.5">
            {statusData.history.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-100 dark:border-[#2A3850] flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        req.status === 'APPROVED'
                          ? 'emerald'
                          : req.status === 'REJECTED'
                          ? 'rose'
                          : 'amber'
                      }
                      size="sm"
                      dot
                    >
                      {req.status}
                    </Badge>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {req.reason && (
                    <p className="text-slate-900 dark:text-slate-100 text-[11px] font-medium">
                      Reason: &ldquo;{req.reason}&rdquo;
                    </p>
                  )}

                  {req.adminReview && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                      Reviewed by {req.adminReview.adminName || 'Admin'}
                      {req.adminReview.notes ? ` — "${req.adminReview.notes}"` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ACCOUNT OPERATIONS & SHORTCUTS */}
      <div className="bg-white dark:bg-[#151F33] rounded-3xl p-6 border border-slate-200 dark:border-[#2A3850] shadow-xs space-y-4 transition-colors duration-150">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-[#2A3850]">
          <div className="w-9 h-9 rounded-xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Account Operations &amp; Shortcuts
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] mt-0.5">
              Quick access to common actions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Shortcut 1: Mark Attendance (Green) */}
          <Link
            href="/faculty/attendance"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1C2940] hover:bg-[#F6FAF8] dark:hover:bg-[#23384E] border border-slate-200 dark:border-[#2A3850] hover:border-[#10B981]/50 shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#E7FAF1] dark:bg-emerald-950/60 text-[#10B981] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold block text-slate-900 dark:text-slate-100 text-xs">
                  Mark Attendance
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#A7B4CC] block truncate">
                  Face &amp; location check-in
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#10B981] group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Shortcut 2: Attendance Log (Blue) */}
          <Link
            href="/faculty/history"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1C2940] hover:bg-[#F5F8FF] dark:hover:bg-[#23384E] border border-slate-200 dark:border-[#2A3850] hover:border-[#2563EB]/50 shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] dark:bg-sky-950/60 text-[#2563EB] dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold block text-slate-900 dark:text-slate-100 text-xs">
                  Attendance Log
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#A7B4CC] block truncate">
                  Past 60-day records
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Shortcut 3: Sign Out (Red) */}
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1C2940] hover:bg-[#FFF5F5] dark:hover:bg-rose-950/30 border border-slate-200 dark:border-[#2A3850] hover:border-rose-500/50 shadow-2xs transition-all group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] dark:bg-rose-950/60 text-[#EF4444] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold block text-[#EF4444] text-xs">
                  Sign Out Portal
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#A7B4CC] block truncate">
                  End active session
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>

      {/* BIOMETRIC UPDATE SUBMISSION MODAL */}
      <BiometricUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        onSuccess={(res) => {
          setSuccessBanner(res.message);
          loadRequestsStatus();
        }}
      />

      {/* POLICY INFO MODAL */}
      {showUpdatePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#151F33] rounded-3xl border border-slate-200 dark:border-[#2A3850] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Biometric Photo Renewal Policy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Security &amp; Integrity Assurance</p>
              </div>
            </div>

            <div className="text-xs text-slate-800 dark:text-slate-200 space-y-2.5 leading-relaxed">
              <p>
                To protect institutional attendance integrity, biometric photo updates follow a safe, non-destructive workflow:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li>
                  <strong>Uninterrupted Attendance:</strong> Your existing biometric enrollment remains 100% active while a photo update request is under review.
                </li>
                <li>
                  <strong>Anti-Spoofing &amp; Quality Checks:</strong> Candidate photos must satisfy facial sharpness, brightness, and anti-spoof liveness criteria.
                </li>
                <li>
                  <strong>Administrative Review:</strong> An authorized campus administrator verifies the photo against institutional records before activating the new biometric vector.
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowUpdatePolicyModal(false)}
                className="w-full text-xs font-bold"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
