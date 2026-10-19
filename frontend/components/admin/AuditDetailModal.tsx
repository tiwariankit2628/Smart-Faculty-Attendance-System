'use client';

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Clock,
  Globe,
  FileText,
  Lock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AuditLogEvent } from '../../types';

export interface AuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogEvent | null;
}

export function AuditDetailModal({ isOpen, onClose, log }: AuditDetailModalProps) {
  if (!isOpen || !log) return null;

  const getCategoryBadge = (category: AuditLogEvent['category']) => {
    switch (category) {
      case 'ADMINISTRATIVE_DECISION':
        return (
          <Badge variant="indigo" dot>
            Administrative Decision
          </Badge>
        );
      case 'AUTOMATED_VERIFICATION':
        return (
          <Badge variant="indigo" dot>
            Automated Verification
          </Badge>
        );
      case 'SECURITY_EVENT':
      default:
        return (
          <Badge variant="amber" dot>
            Security Telemetry Event
          </Badge>
        );
    }
  };

  const attendanceId = (log.details?.attendanceId as string) || (log.details?.id as string);
  const facultyId =
    (log.details?.facultyId as string) ||
    (log.details?.employeeId as string) ||
    (log.details?.targetUserId as string);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg" title="Immutable Audit Event Details">
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-300">
        {/* Banner with category & action */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            {getCategoryBadge(log.category)}
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              ID: {log.id}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight font-mono">
            {log.action}
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {new Date(log.timestamp).toLocaleString()} ({new Date(log.timestamp).toISOString()})
            </span>
          </div>
        </div>

        {/* Actor and Security Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              Actor / Initiator
            </span>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{log.actorName}</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Role: <span className="text-slate-800 dark:text-slate-300 font-medium">{log.actorRole}</span> • UID:{' '}
              {log.actorId.slice(0, 12)}...
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-500" />
              Network & Request Context
            </span>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
              IP: {log.ipAddress || 'Internal Network'}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              Req ID: {log.requestId || 'system-dispatch'}
            </p>
          </div>
        </div>

        {/* Related Entity References if available */}
        {(attendanceId || facultyId) && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              Associated Entity References
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              {attendanceId && (
                <div className="bg-white dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 mr-1.5">Attendance:</span>
                  <span className="text-indigo-600 dark:text-indigo-300 font-semibold">{attendanceId}</span>
                </div>
              )}
              {facultyId && (
                <div className="bg-white dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 mr-1.5">Faculty / Target:</span>
                  <span className="text-emerald-600 dark:text-emerald-300 font-semibold">{facultyId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sanitized Event Metadata */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              Sanitized Audit Payload (Immutable Record)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Secrets & Biometrics Stripped
            </span>
          </div>
          <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] border border-slate-800 overflow-x-auto max-h-56">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
          <span>This record is strictly append-only and cryptographically protected against modification.</span>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
