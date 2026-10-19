'use client';

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Building,
  IdCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  LogIn,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { authService } from '../../services/auth.service';
import { blobToBase64 } from '../../services/attendance.service';
import { CameraPreview } from '../camera/CameraPreview';
import { User } from '../../types';

interface RegisterFormProps {
  onSwitchToLogin: (prefillEmail?: string) => void;
}

type Step = 'PROFILE' | 'FACE_REGISTRATION' | 'SUCCESS';

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>('PROFILE');

  // Step 1: Faculty Profile Details
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('School of Computer Science & Engineering (SCSE)');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2: Face Biometrics
  const camera = useCamera();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [faceBase64, setFaceBase64] = useState<string | null>(null);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysisSuccess, setFaceAnalysisSuccess] = useState(false);
  const [faceAnalysisMessage, setFaceAnalysisMessage] = useState<string | null>(null);
  const [faceQualityScore, setFaceQualityScore] = useState<number | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const departments = [
    'School of Computer Science & Engineering (SCSE)',
    'Department of Electronics & Communication (ECE)',
    'Department of Mechanical Engineering',
    'Department of Civil Engineering',
    'Department of Biotechnology',
    'School of Business & Management',
    'Department of Mathematics & Computing',
  ];

  // Auto-start camera when entering Step 2
  useEffect(() => {
    if (currentStep === 'FACE_REGISTRATION') {
      camera.startCamera('user');
    } else {
      camera.stopCamera();
    }
    return () => {
      camera.stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Handle Step 1 Validation & Proceed
  const handleProceedToFace = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);

    if (!name.trim() || name.trim().length < 2) {
      setStep1Error('Full Legal Name must be at least 2 characters.');
      return;
    }
    if (!employeeId.trim() || employeeId.trim().length < 3) {
      setStep1Error('Faculty ID must be at least 3 characters (e.g. LPU-FAC-105).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setStep1Error('Please enter a valid official institutional email.');
      return;
    }
    if (password.length < 6) {
      setStep1Error('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setStep1Error('Passwords do not match. Please verify your entries.');
      return;
    }

    setCurrentStep('FACE_REGISTRATION');
  };

  // Handle Step 2 Capture & Validation
  const handleCapture = async () => {
    setFaceError(null);
    setFaceAnalysisMessage(null);
    setFaceAnalysisSuccess(false);

    try {
      const { blob, previewUrl: pUrl } = await camera.capturePhoto();
      setPreviewUrl(pUrl);
      const b64 = await blobToBase64(blob);
      setFaceBase64(b64);

      // Perform pre-registration validation with Python face service
      setIsAnalyzingFace(true);
      try {
        const checkResult = await authService.checkFace(b64);
        setFaceAnalysisSuccess(true);
        setFaceQualityScore(
          checkResult.qualityScore ? Math.round(checkResult.qualityScore * 100) : 95
        );
        setFaceAnalysisMessage(
          checkResult.message || 'Face detected clearly. Ready for biometric enrollment.'
        );
      } catch (err: unknown) {
        setFaceAnalysisSuccess(false);
        const msg =
          err instanceof Error
            ? err.message
            : 'Face verification failed. Please ensure your face is clearly visible.';
        setFaceError(msg);
      } finally {
        setIsAnalyzingFace(false);
      }
    } catch (err: unknown) {
      setFaceError(err instanceof Error ? err.message : 'Unable to capture camera photo.');
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setFaceBase64(null);
    setFaceAnalysisSuccess(false);
    setFaceAnalysisMessage(null);
    setFaceError(null);
    setFaceQualityScore(null);
    camera.startCamera('user');
  };

  // Handle Step 2 Final Submission
  const handleCompleteRegistration = async () => {
    if (!faceBase64) {
      setFaceError('Please capture your facial photo before submitting.');
      return;
    }

    setIsSubmitting(true);
    setFaceError(null);

    try {
      const newUser = await authService.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        employeeId: employeeId.trim().toUpperCase(),
        department: department.trim(),
        password,
        faceImage: faceBase64,
      });

      setCreatedUser(newUser);
      camera.stopCamera();
      setCurrentStep('SUCCESS');
    } catch (err: unknown) {
      setFaceError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 3-Step Progress Indicator: Profile → Face Registration → Account Created */}
      <div className="px-1">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          {/* Step 1 Pill */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all ${
                currentStep === 'PROFILE'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-500/20'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {currentStep !== 'PROFILE' ? '✓' : '1'}
            </span>
            <span
              className={`text-xs ${
                currentStep === 'PROFILE'
                  ? 'text-orange-500 dark:text-orange-400 font-bold'
                  : 'text-emerald-500 dark:text-emerald-400'
              }`}
            >
              Profile
            </span>
          </div>

          {/* Connector Line 1 */}
          <div
            className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
              currentStep === 'FACE_REGISTRATION' || currentStep === 'SUCCESS'
                ? 'bg-gradient-to-r from-emerald-500 to-orange-500'
                : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />

          {/* Step 2 Pill */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all ${
                currentStep === 'FACE_REGISTRATION'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-500/20'
                  : currentStep === 'SUCCESS'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {currentStep === 'SUCCESS' ? '✓' : '2'}
            </span>
            <span
              className={`text-xs ${
                currentStep === 'FACE_REGISTRATION'
                  ? 'text-orange-500 dark:text-orange-400 font-bold'
                  : currentStep === 'SUCCESS'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              Face Biometrics
            </span>
          </div>

          {/* Connector Line 2 */}
          <div
            className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
              currentStep === 'SUCCESS'
                ? 'bg-gradient-to-r from-orange-500 to-emerald-500'
                : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />

          {/* Step 3 Pill */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all ${
                currentStep === 'SUCCESS'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {currentStep === 'SUCCESS' ? '✓' : '3'}
            </span>
            <span
              className={`text-xs ${
                currentStep === 'SUCCESS' ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              Ready
            </span>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: FACULTY PROFILE DETAILS ================= */}
      {currentStep === 'PROFILE' && (
        <form onSubmit={handleProceedToFace} className="space-y-2.5 sm:space-y-3">
          {step1Error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{step1Error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1 text-left">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Full Legal Name
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Verma"
                required
                className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>

          {/* Faculty ID & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1 text-left">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Faculty ID
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <IdCard className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  placeholder="LPU-FAC-105"
                  required
                  className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20 uppercase"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Official Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rajesh@lpu.in"
                  required
                  className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
          </div>

          {/* Department Select */}
          <div className="space-y-1 text-left">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Department
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                <Building className="w-4 h-4" />
              </div>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1 text-left">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  required
                  className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Continue Action Button */}
          <button
            type="submit"
            className="w-full h-10 sm:h-11 mt-1 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue to Face Registration</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-1.5 text-center border-t border-slate-200 dark:border-slate-800/80">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an official account?{' '}
              <button
                type="button"
                onClick={() => onSwitchToLogin()}
                className="font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
      )}

      {/* ================= STEP 2: FACE REGISTRATION ================= */}
      {currentStep === 'FACE_REGISTRATION' && (
        <div className="space-y-3 sm:space-y-3.5 flex flex-col items-center">
          {/* Faculty Summary Badge */}
          <div className="w-full bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 p-2.5 sm:p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100">{name}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block">
                {employeeId} • {email}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-700/60 text-orange-700 dark:text-orange-300">
              Biometric Enrollment
            </span>
          </div>

          {/* Camera Viewport Component */}
          <CameraPreview
            videoRef={camera.videoRef}
            previewUrl={previewUrl}
            isActive={camera.cameraState.isActive}
            isLoading={camera.cameraState.isLoading}
            error={camera.cameraState.error}
            onCapture={handleCapture}
            onRetake={handleRetake}
            onReopen={() => camera.startCamera('user')}
          />

          {/* Live Analysis Status Feedback */}
          {isAnalyzingFace && (
            <div className="w-full p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-xl flex items-center gap-2 text-xs text-indigo-800 dark:text-indigo-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-500 dark:text-indigo-400" />
              <span>Analyzing facial geometry, sharpness, and alignment...</span>
            </div>
          )}

          {faceAnalysisSuccess && !isAnalyzingFace && (
            <div className="w-full p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-bold">Face Detected &amp; Quality Confirmed ({faceQualityScore}%)</p>
                <p className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400/90 mt-0.5">{faceAnalysisMessage}</p>
              </div>
            </div>
          )}

          {faceError && (
            <div className="w-full p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-bold">Face Registration Notice</p>
                <p className="text-[10px] sm:text-[11px] text-rose-700 dark:text-rose-300/90 mt-0.5 leading-relaxed">{faceError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-1.5 pt-1">
            {previewUrl && faceAnalysisSuccess && (
              <button
                type="button"
                onClick={handleCompleteRegistration}
                disabled={isSubmitting}
                className="w-full h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Registration &amp; Link Face</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                camera.stopCamera();
                setCurrentStep('PROFILE');
              }}
              disabled={isSubmitting}
              className="w-full h-9 sm:h-10 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: ACCOUNT CREATED SUCCESS ================= */}
      {currentStep === 'SUCCESS' && (
        <div className="space-y-4 text-center py-1 sm:py-2 animate-in fade-in duration-300">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>

          <div className="space-y-0.5">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Welcome, {createdUser?.fullName || name}!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-normal">
              Your official faculty account is registered and your biometric face profile is securely bound.
            </p>
          </div>

          {/* Credential Summary Receipt */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 rounded-xl p-3 sm:p-4 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                Official Credential Receipt
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-400">
                Active Faculty
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Faculty ID:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                {createdUser?.employeeId || employeeId}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Official Email:</span>
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {createdUser?.email || email}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Department:</span>
              <span className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[210px]">
                {createdUser?.department || department}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Biometric Face Profile:</span>
              </span>
              <span className="font-bold">Enrolled &amp; Linked &#10003;</span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => onSwitchToLogin(email)}
              className="w-full h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Proceed to Sign In</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
