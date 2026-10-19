'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { facultyService, SubmitBiometricUpdateResponse } from '../../services/faculty.service';

export interface BiometricUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (response: SubmitBiometricUpdateResponse) => void;
}

export function BiometricUpdateModal({ isOpen, onClose, onSuccess }: BiometricUpdateModalProps) {
  const [captureMode, setCaptureMode] = useState<'upload' | 'camera'>('upload');
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const camera = useCamera();

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      camera.stopStream();
      setSelectedImageBase64(null);
      setPreviewUrl(null);
      setReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
      setCaptureMode('upload');
    }
  }, [isOpen]);

  // Clean up camera stream on component unmount
  useEffect(() => {
    return () => {
      camera.stopStream();
    };
  }, []);

  // Switch modes safely
  const handleSwitchMode = (mode: 'upload' | 'camera') => {
    setErrorMessage(null);
    if (mode === 'camera') {
      setSelectedImageBase64(null);
      setPreviewUrl(null);
      camera.startCamera('user');
    } else {
      camera.stopStream();
    }
    setCaptureMode(mode);
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Format check
    const permittedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!permittedTypes.includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, or WEBP).');
      return;
    }

    // 2. 5MB size limit check
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Selected image exceeds the maximum permitted size of 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImageBase64(result);
      setPreviewUrl(result);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read selected image file.');
    };
    reader.readAsDataURL(file);
  };

  // Handle camera snapshot capture
  const handleCaptureCamera = async () => {
    setErrorMessage(null);
    try {
      const { blob, previewUrl: pUrl } = await camera.capturePhoto();
      setPreviewUrl(pUrl);

      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImageBase64(reader.result as string);
        camera.stopStream();
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to capture camera photo.');
    }
  };

  // Retake or pick a new image
  const handleResetPhoto = () => {
    setSelectedImageBase64(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (captureMode === 'camera') {
      camera.startCamera('user');
    }
  };

  // Submit biometric update request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImageBase64) {
      setErrorMessage('Please capture or upload a facial photograph.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await facultyService.submitBiometricUpdateRequest({
        image: selectedImageBase64,
        reason: reason.trim(),
      });

      onSuccess(response);
      onClose();
    } catch (err: any) {
      const msg =
        err?.message ||
        'Failed to submit biometric photo update. Please ensure your face is clearly visible with good lighting.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#151F33] rounded-3xl border border-slate-200 dark:border-[#2A3850] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 transition-colors duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Update Biometric Profile Photo
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A7B4CC]">
                Submit a new photograph for administrative review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              camera.stopStream();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2940] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Assurance Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 flex items-start gap-2.5 text-xs text-[#5B45F5] dark:text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-[#5B45F5] dark:text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Your existing biometric profile remains <strong>100% active</strong>. You can continue
            verifying daily attendance while your new photo awaits administrator approval.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold block">Submission Error</span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Capture Method Tabs (Only visible when no photo is selected) */}
        {!previewUrl && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#1C2940] border border-slate-200/80 dark:border-[#2A3850] rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchMode('upload')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                captureMode === 'upload'
                  ? 'bg-white dark:bg-[#151F33] text-[#5B45F5] dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('camera')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                captureMode === 'camera'
                  ? 'bg-white dark:bg-[#151F33] text-[#5B45F5] dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              Take Photo
            </button>
          </div>
        )}

        {/* Photo Selection Area */}
        <div className="space-y-4">
          {/* A. PREVIEW MODE (When photo is selected or captured) */}
          {previewUrl ? (
            <div className="flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-50/70 dark:bg-[#1C2940] border border-slate-200 dark:border-[#2A3850] space-y-3">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Candidate Biometric Preview"
                  className="w-36 h-36 object-cover rounded-2xl ring-4 ring-[#F1EDFF] border-2 border-[#DCE8F8] shadow-md"
                />
                <div className="absolute -bottom-2 -right-2 bg-[#10B981] text-white p-1 rounded-full shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-[#14264A]">
                  Candidate Photo Ready
                </p>
                <p className="text-[11px] text-[#647797]">
                  Face quality will be verified during submission
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPhoto}
                disabled={isSubmitting}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Retake or Choose Another
              </Button>
            </div>
          ) : captureMode === 'upload' ? (
            /* B. UPLOAD MODE */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-[#2A3850] hover:border-[#5B45F5] dark:hover:border-indigo-400 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-50/70 dark:bg-[#1C2940]/60 text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#F1EDFF] dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Click to select photo from device
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#A7B4CC] mt-0.5">
                  Supported formats: JPEG, PNG, WEBP (Max 5 MB)
                </p>
              </div>
            </div>
          ) : (
            /* C. LIVE CAMERA CAPTURE MODE */
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative w-full max-w-xs aspect-4/3 bg-black rounded-2xl overflow-hidden border-2 border-indigo-500/30 flex items-center justify-center shadow-inner">
                {/* Continuous Video Element: Stays mounted so stream attachment never fails */}
                <video
                  ref={camera.videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => camera.updateVideoReadiness?.()}
                  onCanPlay={() => camera.updateVideoReadiness?.()}
                  onPlay={() => camera.updateVideoReadiness?.()}
                  className={`w-full h-full object-cover transform scale-x-[-1] ${
                    camera.cameraState.isLoading || camera.cameraState.error ? 'invisible' : 'visible'
                  }`}
                />

                {/* Loading State Overlay */}
                {camera.cameraState.isLoading && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-300 text-xs z-20">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    <span>Connecting camera hardware...</span>
                  </div>
                )}

                {/* Error State Overlay with Retry Button */}
                {camera.cameraState.error && !camera.cameraState.isLoading && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center text-xs text-rose-300 z-20 space-y-2">
                    <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
                    <span className="leading-relaxed font-medium">{camera.cameraState.error}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => camera.startCamera('user')}
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      className="mt-1 text-xs text-white border-white/20 hover:bg-white/10"
                    >
                      Retry Camera
                    </Button>
                  </div>
                )}

                {/* Oval face guide overlay */}
                {camera.cameraState.isActive && !camera.cameraState.isLoading && !camera.cameraState.error && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                    <div className="w-32 h-44 rounded-[50%] border-2 border-dashed border-indigo-400/60 shadow-[0_0_100px_rgba(0,0,0,0.5)_inset]" />
                  </div>
                )}
              </div>

              {/* Action Button: only enabled when camera is actually active and video frame is ready */}
              {camera.cameraState.isActive && !camera.cameraState.error && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCaptureCamera}
                  disabled={!camera.cameraState.isVideoReady || camera.cameraState.isLoading}
                  icon={
                    camera.cameraState.isVideoReady ? (
                      <Camera className="w-4 h-4" />
                    ) : (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    )
                  }
                  className="text-xs font-semibold"
                >
                  {camera.cameraState.isVideoReady ? 'Capture Facial Snapshot' : 'Camera Initializing...'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Reason for update (Optional) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A7B4CC]">
                Reason for Update (Optional)
              </label>
              <span className="text-[10px] text-slate-400">{reason.length}/500</span>
            </div>
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Updated prescription spectacles, new official photograph, haircut"
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-[#2A3850] bg-slate-50/70 dark:bg-[#1C2940] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#5B45F5]/30 focus:border-[#5B45F5]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#2A3850]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!selectedImageBase64 || isSubmitting}
              isLoading={isSubmitting}
              icon={<Sparkles className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              {isSubmitting ? 'Verifying & Submitting...' : 'Submit Photo for Review'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
