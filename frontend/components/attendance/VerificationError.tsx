'use client';

import {
  AlertCircle,
  MapPinOff,
  CameraOff,
  UserX,
  Users,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { VerificationError as VerificationErrorType } from '../../types';
import { Button } from '../ui/Button';

export interface VerificationErrorProps {
  error: VerificationErrorType;
  onRetry: () => void;
  onReset: () => void;
}

export function VerificationError({ error, onRetry, onReset }: VerificationErrorProps) {
  const getErrorIcon = () => {
    switch (error.code) {
      case 'LOCATION_PERMISSION_DENIED':
      case 'OUTSIDE_GEOFENCE':
      case 'LOCATION_TIMEOUT':
      case 'LOCATION_INACCURATE':
        return <MapPinOff className="w-10 h-10 text-amber-600 dark:text-amber-400" />;
      case 'CAMERA_PERMISSION_DENIED':
        return <CameraOff className="w-10 h-10 text-rose-600 dark:text-rose-400" />;
      case 'NO_FACE_DETECTED':
      case 'FACE_MISMATCH':
        return <UserX className="w-10 h-10 text-rose-600 dark:text-rose-400" />;
      case 'MULTIPLE_FACES_DETECTED':
        return <Users className="w-10 h-10 text-rose-600 dark:text-rose-400" />;
      case 'ALREADY_MARKED':
        return <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />;
      case 'NETWORK_ERROR':
        return <WifiOff className="w-10 h-10 text-slate-600 dark:text-slate-400" />;
      default:
        return <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400" />;
    }
  };

  const getContainerStyle = () => {
    if (error.code === 'ALREADY_MARKED') {
      return 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800';
    }
    if (error.code === 'OUTSIDE_GEOFENCE' || error.code === 'LOCATION_INACCURATE') {
      return 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
    }
    return 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800';
  };

  return (
    <div
      className={`w-full max-w-sm rounded-3xl p-6 shadow-sm border flex flex-col items-center text-center space-y-4 ${getContainerStyle()}`}
    >
      <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center">
        {getErrorIcon()}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{error.title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs">
          {error.message}
        </p>
        {error.detail && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-mono">
            {error.detail}
          </p>
        )}
      </div>

      {/* Helpful Action Guidance */}
      {error.code === 'LOCATION_PERMISSION_DENIED' && (
        <div className="w-full bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl text-left text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">How to fix in browser:</p>
          <ol className="list-decimal pl-3 space-y-0.5">
            <li>Tap the padlock icon next to the address bar.</li>
            <li>Select &quot;Permissions&quot; &rarr; &quot;Location&quot;.</li>
            <li>Choose &quot;Allow&quot; and refresh.</li>
          </ol>
        </div>
      )}

      {error.code === 'CAMERA_PERMISSION_DENIED' && (
        <div className="w-full bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl text-left text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">How to enable camera:</p>
          <ol className="list-decimal pl-3 space-y-0.5">
            <li>Ensure no other app is currently using the camera.</li>
            <li>Grant camera permission when requested by browser.</li>
          </ol>
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full space-y-2 pt-2">
        {error.retryable && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onRetry}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {error.actionLabel || 'Retry Verification'}
          </Button>
        )}

        <Button
          variant={error.retryable ? 'outline' : 'primary'}
          size="md"
          className="w-full text-xs"
          onClick={onReset}
        >
          {error.retryable ? 'Restart Process' : 'Back to Dashboard'}
        </Button>

        <Link href="/faculty/dashboard" className="w-full block">
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
