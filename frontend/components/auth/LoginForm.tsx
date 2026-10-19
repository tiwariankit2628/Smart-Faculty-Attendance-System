'use client';

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

interface LoginFormProps {
  initialEmail?: string;
  portalRole?: 'FACULTY' | 'ADMIN';
  onRoleChange?: (role: 'FACULTY' | 'ADMIN') => void;
  onSwitchToRegister?: () => void;
  onSwitchToForgotPassword?: () => void;
}

export function LoginForm({
  initialEmail = '',
  portalRole = 'FACULTY',
  onRoleChange,
  onSwitchToRegister,
  onSwitchToForgotPassword,
}: LoginFormProps) {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<'FACULTY' | 'ADMIN'>(portalRole);

  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  React.useEffect(() => {
    setActiveRole(portalRole);
  }, [portalRole]);

  const handleRoleToggle = (role: 'FACULTY' | 'ADMIN') => {
    setActiveRole(role);
    onRoleChange?.(role);
    setError(null);
    if (role === 'ADMIN' && (!email || email.includes('faculty'))) {
      setEmail('admin@lpu.in');
      setPassword('AdminPassword@123');
    } else if (role === 'FACULTY' && email === 'admin@lpu.in') {
      setEmail('faculty@lpu.in');
      setPassword('FacultyPassword@123');
    }
  };

  const demoAccounts = [
    {
      label: 'Dr. Amit Sharma',
      empId: 'LPU-FAC-101',
      dept: 'SCSE • Face Enrolled',
      email: 'faculty@lpu.in',
      password: 'FacultyPassword@123',
      role: 'FACULTY' as const,
    },
    {
      label: 'Dr. Priya Patel',
      empId: 'LPU-FAC-102',
      dept: 'ECE • SCSE Faculty',
      email: 'priya.patel@lpu.in',
      password: 'FacultyPassword@123',
      role: 'FACULTY' as const,
    },
    {
      label: 'Prof. Rajesh Verma',
      empId: 'LPU-FAC-103',
      dept: 'Mechanical Eng.',
      email: 'rajesh.verma@lpu.in',
      password: 'FacultyPassword@123',
      role: 'FACULTY' as const,
    },
    {
      label: 'LPU Admin Office',
      empId: 'LPU-ADM-001',
      dept: 'Registrar & Admin',
      email: 'admin@lpu.in',
      password: 'AdminPassword@123',
      role: 'ADMIN' as const,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await login(email.trim().toLowerCase(), password);
      if (user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/faculty/dashboard');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please verify your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (acc: (typeof demoAccounts)[0]) => {
    setError(null);
    handleRoleToggle(acc.role);
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* Subtle Portal Selector: Faculty Login | Admin Login */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <button
            type="button"
            onClick={() => handleRoleToggle('FACULTY')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              activeRole === 'FACULTY'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Faculty Login</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700 px-1 text-xs select-none">|</span>

          <button
            type="button"
            onClick={() => handleRoleToggle('ADMIN')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              activeRole === 'ADMIN'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Login</span>
          </button>
        </div>
      </div>

      {/* Role Notice Pill */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              activeRole === 'FACULTY' ? 'bg-orange-500' : 'bg-indigo-500 dark:bg-indigo-400'
            }`}
          />
          {activeRole === 'FACULTY'
            ? 'Sign in to access personal attendance & biometric check-in'
            : 'Authorized administrator access with institutional controls'}
        </span>
      </div>

      {/* Error Callout */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200 shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
        {/* Email Field */}
        <div className="space-y-1 text-left">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Official LPU Email
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                activeRole === 'FACULTY' ? 'e.g. dr.sharma@lpu.in' : 'admin@lpu.in'
              }
              required
              className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>

        {/* Password Field with Show/Hide Toggle */}
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Password
            </label>
            {onSwitchToForgotPassword && (
              <button
                type="button"
                onClick={onSwitchToForgotPassword}
                className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full h-10 sm:h-10.5 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:outline-none focus:border-orange-500/80 focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 sm:h-11 mt-1 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/20 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Authenticate &amp; Sign In</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Create Account Prompt */}
      {onSwitchToRegister && (
        <div className="pt-1.5 text-center border-t border-slate-200 dark:border-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Don&apos;t have a faculty account yet?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Create Account</span>
            </button>
          </p>
        </div>
      )}

      {/* Multi-Account Quick Evaluation Selector */}
      <div className="pt-2 sm:pt-2.5 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider justify-center">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
          <span>Quick Switch Accounts (Development Testing)</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-left">
          {demoAccounts.map((acc) => {
            const isSelected = email.toLowerCase() === acc.email.toLowerCase();
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleSelectDemo(acc)}
                className={`p-1.5 sm:p-2 rounded-lg text-xs border transition-all text-left flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-[11px] sm:text-xs truncate">{acc.label}</span>
                  {isSelected && (
                    <CheckCircle2 className="w-3 h-3 text-orange-500 dark:text-orange-400 shrink-0 ml-1" />
                  )}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between mt-0.5">
                  <span className="font-mono text-slate-700 dark:text-slate-300">{acc.empId}</span>
                  <span className="truncate max-w-[65px] text-slate-400 dark:text-slate-500">
                    {acc.dept}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
