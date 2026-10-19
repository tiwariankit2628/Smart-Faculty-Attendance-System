'use client';

import React, { useEffect } from 'react';
import { MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAttendanceFlow } from '../../../hooks/useAttendanceFlow';
import { LocationStatus } from '../../../components/location/LocationStatus';
import { CameraPreview } from '../../../components/camera/CameraPreview';
import { VerificationFlowStepper } from '../../../components/attendance/VerificationFlowStepper';
import { BiometricStatusCard } from '../../../components/attendance/BiometricStatusCard';
import { AttendanceSummaryCard } from '../../../components/attendance/AttendanceSummaryCard';
import { AttendanceStepper } from '../../../components/attendance/AttendanceStepper';
import { VerificationSuccess } from '../../../components/attendance/VerificationSuccess';
import { VerificationError } from '../../../components/attendance/VerificationError';

export default function MarkAttendancePage() {
  const {
    step,
    currentFlowStep,
    error,
    geo,
    camera,
    user,
    previewUrl,
    progress,
    verifiedRecord,
    verifiedDistance,
    activeZoneName,
    biometricStatus,
    activeChallenge,
    challengeCountdown,
    captureCountdown,
    isVerifying,
    isVerified,
    isFailed,
    isSubmitting,
    startFlow,
    startVerification,
    retryVerification,
    proceedToSummary,
    backToCamera,
    submitAttendance,
    resetFlow,
  } = useAttendanceFlow();

  // Auto-trigger real device location evaluation on first entry
  useEffect(() => {
    startFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCameraStage =
    step === 'LOCATION_VERIFIED' ||
    step === 'CAMERA_ACTIVE' ||
    step === 'CHALLENGE_READY' ||
    step === 'LIVENESS_CAPTURING' ||
    step === 'LIVENESS_ANALYZING' ||
    step === 'LIVENESS_VERIFIED' ||
    step === 'IDENTITY_MATCHING' ||
    step === 'IDENTITY_VERIFIED' ||
    step === 'ATTENDANCE_READY' ||
    step === 'CHALLENGE_ACTIVE' ||
    step === 'BIOMETRIC_PROCESSING' ||
    step === 'PHOTO_CAPTURED';

  return (
    <div className="flex flex-col items-center max-w-md mx-auto space-y-4 pt-1 pb-24 px-2 sm:px-0">
      {/* Top Header Navigation */}
      <div className="w-full flex items-center justify-between pb-1">
        <Link
          href="/faculty/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold">
          Production Biometrics
        </span>
      </div>

      {/* STEP PROGRESSION BAR (Section 1: Step-by-Step Flow 1 to 6) */}
      <VerificationFlowStepper
        currentStep={currentFlowStep}
        isFailed={isFailed}
      />

      {/* STEP 1: Location Checking */}
      {step === 'LOCATION_CHECKING' && (
        <div className="w-full bg-white dark:bg-[#151F33] border border-slate-200 dark:border-[#2A3850] rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[360px]">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shadow-inner">
            <MapPin className="w-8 h-8 animate-bounce text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Verifying Campus Geofence...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Sending device coordinates to the attendance server to calculate campus geofence distance.
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mt-2" />
        </div>
      )}

      {/* STEP 2, 3, 4, 5: Location Verified & Biometric Camera Stage */}
      {isCameraStage && (
        <div className="w-full space-y-4 flex flex-col items-center">
          {/* Location Verification Summary Badge */}
          <LocationStatus
            isChecking={geo.isChecking}
            isInsideZone={true}
            distanceMeters={verifiedDistance}
            accuracy={geo.accuracy}
            geofenceName={activeZoneName}
            error={geo.error}
            identityVerified={isVerified}
            onRetry={() => startFlow()}
          />

          {/* Camera Viewport with Face Guide, Lighting Evaluation & Active Challenge Overlay */}
          <CameraPreview
            videoRef={camera.videoRef}
            previewUrl={previewUrl}
            isActive={camera.cameraState.isActive}
            isLoading={camera.cameraState.isLoading}
            error={camera.cameraState.error}
            isVerifying={isVerifying}
            isVerified={isVerified}
            isFailed={isFailed}
            activeChallenge={activeChallenge}
            challengeCountdown={challengeCountdown}
            captureCountdown={captureCountdown}
            verificationStep={step}
            onStartVerification={startVerification}
            onContinueToSummary={proceedToSummary}
            onRetry={retryVerification}
            onReopen={() => camera.startCamera('user')}
          />

          {/* Biometric Status Card (Section 4: 4 discrete items, no premature success, zero technical leaks) */}
          <BiometricStatusCard
            status={biometricStatus}
            facultyName={user?.fullName || 'Faculty Member'}
            isProcessing={isVerifying}
            onRetry={retryVerification}
          />
        </div>
      )}

      {/* STEP 6: Pre-Submission Compact Summary Card (Section 9) */}
      {step === 'ATTENDANCE_SUMMARY' && (
        <AttendanceSummaryCard
          locationVerified={Boolean(verifiedDistance !== null)}
          identityVerified={isVerified}
          livenessVerified={isVerified}
          zoneName={activeZoneName}
          distanceMeters={verifiedDistance}
          facultyName={user?.fullName || 'Faculty Member'}
          challengeType={activeChallenge?.type || 'Kinematic Motion'}
          isSubmitting={isSubmitting}
          onSubmit={submitAttendance}
          onBackToCamera={backToCamera}
        />
      )}

      {/* STEP 6 (Execution): Attendance Multi-Gate Transaction Recording */}
      {step === 'VERIFYING_MULTI_GATE' && (
        <div className="w-full flex flex-col items-center space-y-4 pt-4">
          <div className="text-center pb-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Recording Verified Attendance
            </h2>
            <p className="text-xs text-slate-500">
              Validating spatial telemetry and writing immutable audit log
            </p>
          </div>

          <AttendanceStepper progress={progress} />
        </div>
      )}

      {/* Completed Success Receipt Screen */}
      {step === 'COMPLETED_SUCCESS' && verifiedRecord && (
        <VerificationSuccess record={verifiedRecord} onDone={resetFlow} />
      )}

      {/* Failure State: User-Friendly Recovery */}
      {step === 'FAILED_ERROR' && error && (
        <VerificationError
          error={error}
          onRetry={() => startFlow()}
          onReset={resetFlow}
        />
      )}
    </div>
  );
}
