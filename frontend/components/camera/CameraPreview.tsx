'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  Sun,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';

export interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  previewUrl: string | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  // Simple capture/retake props (for registration)
  onCapture?: () => void;
  onRetake?: () => void;
  // Verification states for Phase 4 attendance flow
  isVerifying?: boolean;
  isVerified?: boolean;
  isFailed?: boolean;
  activeChallenge?: {
    type: string;
    instruction: string;
  } | null;
  challengeCountdown?: number | null;
  // Phase 7: Synchronized 5-second capture countdown & state
  captureCountdown?: number | null;
  verificationStep?: string;
  onStartVerification?: () => void;
  onContinueToSummary?: () => void;
  onRetry?: () => void;
  onReopen: () => void;
}

export function CameraPreview({
  videoRef,
  previewUrl,
  isActive,
  isLoading,
  error,
  onCapture,
  onRetake,
  isVerifying = false,
  isVerified = false,
  isFailed = false,
  activeChallenge,
  challengeCountdown,
  captureCountdown,
  verificationStep,
  onStartVerification,
  onContinueToSummary,
  onRetry,
  onReopen,
}: CameraPreviewProps) {
  // Real-time client-side lighting evaluation from camera stream
  const [lightingScore, setLightingScore] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive || previewUrl || !videoRef.current) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, 32, 24);
        const imgData = ctx.getImageData(0, 0, 32, 24).data;
        let sum = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          sum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        }
        const avg = sum / (imgData.length / 4);
        setLightingScore(Math.round(avg));
      } catch {
        // Ignore canvas read errors if stream reallocates
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isActive, previewUrl, videoRef]);

  // Challenge icon helper
  const getChallengeIcon = (type?: string) => {
    switch (type) {
      case 'TURN_LEFT':
        return <ArrowLeft className="w-6 h-6 animate-pulse" />;
      case 'TURN_RIGHT':
        return <ArrowRight className="w-6 h-6 animate-pulse" />;
      case 'LOOK_UP':
        return <ArrowUp className="w-6 h-6 animate-pulse" />;
      case 'LOOK_DOWN':
        return <ArrowDown className="w-6 h-6 animate-pulse" />;
      case 'BLINK':
        return <Eye className="w-6 h-6 animate-bounce" />;
      default:
        return <Camera className="w-6 h-6" />;
    }
  };

  const getChallengeDisplayText = (type?: string) => {
    switch (type) {
      case 'TURN_LEFT':
        return 'Turn your head slightly left';
      case 'TURN_RIGHT':
        return 'Turn your head slightly right';
      case 'LOOK_UP':
        return 'Look slightly upward';
      case 'LOOK_DOWN':
        return 'Look slightly downward';
      case 'BLINK':
        return 'Blink once';
      default:
        return activeChallenge?.instruction || 'Face the camera naturally';
    }
  };

  const isLightingAcceptable = lightingScore === null || lightingScore >= 40;

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Viewfinder Container: strictly maintains 3:4 aspect ratio with zero distortion */}
      <div className="relative w-full max-w-sm aspect-3/4 bg-slate-950 rounded-3xl overflow-hidden shadow-inner border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center">
        {/* Live Video Stream */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
            previewUrl || !isActive ? 'hidden' : 'block'
          }`}
        />

        {/* Captured Snapshot Preview (if frozen) */}
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Captured verification selfie"
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
          />
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 z-20">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-xs font-medium tracking-wide">Initializing camera hardware...</p>
          </div>
        )}

        {/* Camera Permission / Error Banner */}
        {error && !isLoading && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-white">Camera Access Required</h4>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{error}</p>
            <Button size="sm" variant="primary" onClick={onReopen} className="mt-2">
              Enable Camera
            </Button>
          </div>
        )}

        {/* Face Alignment Oval Guide */}
        {isActive && !previewUrl && !error && !isLoading && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
            {/* Darkened vignette surround with oval guide */}
            <div
              className={`relative w-56 h-72 rounded-[50%] border-2 transition-all duration-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.48)] flex items-center justify-center ${
                isVerified
                  ? 'border-emerald-400 ring-4 ring-emerald-400/30'
                  : isVerifying
                  ? 'border-indigo-400 border-dashed animate-pulse'
                  : 'border-slate-300/80 border-dashed'
              }`}
            >
              {/* Corner crosshairs */}
              <div className="absolute -top-3 w-6 h-0.5 bg-indigo-400 rounded-full" />
              <div className="absolute -bottom-3 w-6 h-0.5 bg-indigo-400 rounded-full" />
              <div className="absolute -left-3 h-6 w-0.5 bg-indigo-400 rounded-full" />
              <div className="absolute -right-3 h-6 w-0.5 bg-indigo-400 rounded-full" />
            </div>

            {/* Live Camera Quality Badges at Top of Viewport */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-slate-900/80 backdrop-blur-md text-slate-200 border border-white/10 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Face centered</span>
              </span>

              {lightingScore !== null && (
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide backdrop-blur-md border flex items-center gap-1 ${
                    isLightingAcceptable
                      ? 'bg-slate-900/80 text-emerald-300 border-emerald-500/20'
                      : 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>{isLightingAcceptable ? 'Lighting acceptable' : 'Low lighting'}</span>
                </span>
              )}
            </div>

            {/* Default Positioning Guidance Pill (when idle) */}
            {!activeChallenge && !isVerifying && !isVerified && (
              <div className="absolute bottom-5 bg-slate-900/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-center">
                <p className="text-[11px] font-medium text-white tracking-wide">
                  Position your face inside the guide
                </p>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE LIVENESS CHALLENGE BANNER OVERLAY */}
        {activeChallenge && isVerifying && !isVerified && (
          <div className="absolute inset-x-3 bottom-4 z-20 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/40 rounded-2xl p-3.5 shadow-xl text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-indigo-400">
                {getChallengeIcon(activeChallenge.type)}
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Liveness Challenge
                </span>
              </div>

              <p className="text-sm font-bold text-white tracking-wide">
                &ldquo;{getChallengeDisplayText(activeChallenge.type)}&rdquo;
              </p>

              <p className="text-[11px] text-slate-300 font-medium">
                Perform the action naturally
              </p>

              {/* Synchronized 5-second capture countdown */}
              {captureCountdown !== null && captureCountdown !== undefined && captureCountdown > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 text-[11px] font-bold text-indigo-300 border border-indigo-500/30 animate-pulse">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Capturing... {captureCountdown}s</span>
                </div>
              ) : verificationStep === 'LIVENESS_ANALYZING' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 text-[11px] font-bold text-amber-300 border border-amber-500/30">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Analyzing liveness...</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300 border border-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Get ready...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING OVERLAY: "Analyzing liveness / Identity matching" */}
        {isVerifying && !activeChallenge && !isVerified && (
          <div className="absolute inset-x-4 bottom-5 z-20 flex flex-col items-center">
            <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/30 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span className="text-xs font-bold text-white tracking-wide">
                {verificationStep === 'IDENTITY_MATCHING' ? 'Matching identity consensus...' : 'Analyzing liveness...'}
              </span>
            </div>
          </div>
        )}

        {/* SUCCESS CONFIRMATION OVERLAY */}
        {isVerified && (
          <div className="absolute inset-x-4 bottom-5 z-20 flex flex-col items-center animate-in fade-in">
            <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold tracking-wide">Biometric verification passed</span>
            </div>
          </div>
        )}
      </div>

      {/* ACTION BUTTON CONTROLS */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 pt-1">
        {/* Registration Mode (Simple capture / retake) */}
        {onCapture && (
          previewUrl ? (
            <Button
              variant="outline"
              size="lg"
              onClick={onRetake}
              className="w-full"
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Retake Photo
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={onCapture}
              disabled={!isActive || isLoading || !!error}
              className="w-full"
              icon={<Camera className="w-5 h-5" />}
            >
              Capture Face Photo
            </Button>
          )
        )}

        {/* Attendance Verification Mode (Phase 4 Section 8) */}
        {onStartVerification && !onCapture && (
          <>
            {!isVerified && !isFailed && (
              <Button
                variant="primary"
                size="lg"
                onClick={onStartVerification}
                disabled={!isActive || isLoading || isVerifying || !!error}
                className="w-full font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
                icon={
                  isVerifying ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )
                }
              >
                {isVerifying
                  ? typeof captureCountdown === 'number' && captureCountdown > 0
                    ? `Capturing (${captureCountdown}s)...`
                    : 'Analyzing...'
                  : 'Verify Identity'}
              </Button>
            )}

            {isFailed && onRetry && (
              <Button
                variant="primary"
                size="lg"
                onClick={onRetry}
                className="w-full font-bold shadow-md bg-rose-600 hover:bg-rose-700 text-white"
                icon={<RotateCcw className="w-5 h-5" />}
              >
                Try Again
              </Button>
            )}

            {isVerified && onContinueToSummary && (
              <Button
                variant="primary"
                size="lg"
                onClick={onContinueToSummary}
                className="w-full font-bold shadow-md shadow-emerald-200 dark:shadow-none bg-emerald-600 hover:bg-emerald-700 text-white animate-in fade-in"
                icon={<CheckCircle2 className="w-5 h-5" />}
              >
                Continue to Mark Attendance
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
