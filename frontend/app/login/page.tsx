'use client';

import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, MapPin, Lock } from 'lucide-react';
import { LoginForm } from '../../components/auth/LoginForm';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export type AuthTab = 'SIGN_IN' | 'CREATE_ACCOUNT' | 'FORGOT_PASSWORD';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<AuthTab>('SIGN_IN');
  const [portalRole, setPortalRole] = useState<'FACULTY' | 'ADMIN'>('FACULTY');
  const [prefillEmail, setPrefillEmail] = useState<string>('');

  const handleSwitchToLogin = (emailToFill?: string) => {
    if (emailToFill) {
      setPrefillEmail(emailToFill);
    }
    setActiveTab('SIGN_IN');
  };

  return (
    <main className="min-h-screen min-h-[100dvh] relative flex flex-col items-center justify-start p-3 sm:p-5 md:p-6 bg-[#F5F7FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 overflow-x-hidden overflow-y-auto selection:bg-orange-500 selection:text-white transition-colors duration-150">
      {/* Top Floating Theme Switcher */}
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient Gradient Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Top-left Purple Ambient Orb */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-purple-600/10 dark:bg-purple-700/15 rounded-full blur-[130px]" />
        
        {/* Top-right Deep Indigo Orb */}
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[140px]" />
        
        {/* Center-bottom Warm LPU Orange Subtle Ambient Orb */}
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-orange-500/10 dark:bg-orange-600/10 rounded-full blur-[160px]" />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Main Content Container - Safe Center with my-auto */}
      <div className="w-full max-w-[480px] z-10 flex flex-col items-center my-auto py-2">
        {/* University Crest & Platform Title Header */}
        <header className="text-center space-y-1.5 sm:space-y-2 mb-2.5 sm:mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-xs">
            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Lovely Professional University
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">Institutional Portal</span>
          </div>

          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <span>Smart Faculty Attendance</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-normal">
              Automated spatial geofencing and biometric identity verification platform
            </p>
          </div>
        </header>

        {/* Main Segmented Tabs: [ Sign In ] [ Create Account ] */}
        <div className="w-full max-w-md p-1 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 backdrop-blur-xl shadow-xs flex items-center gap-1 mb-2.5 sm:mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('SIGN_IN')}
            className={`flex-1 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'SIGN_IN'
                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white shadow-sm shadow-orange-500/25 ring-1 ring-white/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CREATE_ACCOUNT')}
            className={`flex-1 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'CREATE_ACCOUNT'
                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white shadow-sm shadow-orange-500/25 ring-1 ring-white/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Premium Card */}
        <div className="w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/80 backdrop-blur-2xl p-3.5 sm:p-5 md:p-6 shadow-xl dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
          {activeTab === 'SIGN_IN' && (
            <LoginForm
              initialEmail={prefillEmail}
              portalRole={portalRole}
              onRoleChange={setPortalRole}
              onSwitchToRegister={() => setActiveTab('CREATE_ACCOUNT')}
              onSwitchToForgotPassword={() => setActiveTab('FORGOT_PASSWORD')}
            />
          )}

          {activeTab === 'CREATE_ACCOUNT' && (
            <RegisterForm onSwitchToLogin={handleSwitchToLogin} />
          )}

          {activeTab === 'FORGOT_PASSWORD' && (
            <ForgotPasswordForm onSwitchToLogin={handleSwitchToLogin} />
          )}
        </div>

        {/* Enterprise Security Feature Strip */}
        <footer className="w-full max-w-md mt-2.5 sm:mt-3 space-y-1.5 text-center">
          <div className="grid grid-cols-3 gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-3 h-3 text-orange-500 dark:text-orange-400 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-300 text-[10px] sm:text-[11px]">1:1 Biometrics</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">128-d Vector</span>
            </div>

            <div className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-1 mb-0.5">
                <MapPin className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-300 text-[10px] sm:text-[11px]">Campus Geofence</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">Haversine GPS</span>
            </div>

            <div className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-1 mb-0.5">
                <Lock className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-300 text-[10px] sm:text-[11px]">TLS 1.3</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">Encrypted</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Official System for Lovely Professional University Faculty &amp; Administration
          </p>
        </footer>
      </div>
    </main>
  );
}
