'use client';

import { MapPin, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDistance, getGpsAccuracyStatus } from '../../utils/geo';

export interface LocationStatusProps {
  isChecking: boolean;
  isInsideZone: boolean;
  distanceMeters: number | null;
  accuracy: number | null;
  geofenceName: string;
  error: string | null;
  identityVerified?: boolean;
  onRetry: () => void;
}

export function LocationStatus({
  isChecking,
  isInsideZone,
  distanceMeters,
  accuracy,
  geofenceName,
  error,
  identityVerified = false,
  onRetry,
}: LocationStatusProps) {
  const accuracyStatus = accuracy ? getGpsAccuracyStatus(accuracy) : null;

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isInsideZone
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                : error
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Campus Geofence
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {geofenceName}
            </p>
          </div>
        </div>

        {isInsideZone ? (
          <Badge variant="emerald" dot>
            Inside Zone
          </Badge>
        ) : error ? (
          <Badge variant="rose" dot>
            Location Error
          </Badge>
        ) : distanceMeters !== null ? (
          <Badge variant="amber" dot>
            Outside Boundary
          </Badge>
        ) : (
          <Badge variant="slate">Checking...</Badge>
        )}
      </div>

      {isChecking ? (
        <div className="py-2 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
          <span>Acquiring high-precision satellite telemetry...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-300">
          {error}
        </div>
      ) : distanceMeters !== null ? (
        <div className="space-y-2 pt-1 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span>Distance from Zone:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatDistance(distanceMeters)}
            </span>
          </div>

          {accuracyStatus && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>GPS Calibration:</span>
              <span
                className={`font-medium ${
                  accuracyStatus.color === 'emerald'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {accuracyStatus.label}
              </span>
            </div>
          )}

          {isInsideZone ? (
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium pt-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {identityVerified
                  ? 'Physical presence & biometric identity verified.'
                  : 'Campus geofence perimeter confirmed (biometric identity pending).'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium pt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>You must be within designated campus boundaries.</span>
            </div>
          )}
        </div>
      ) : null}

      <div className="pt-1 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={isChecking}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
          className="w-full text-xs"
        >
          {isChecking ? 'Verifying...' : 'Recalibrate GPS'}
        </Button>
      </div>
    </div>
  );
}
