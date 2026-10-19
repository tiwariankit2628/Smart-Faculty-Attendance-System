'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/login');
      } else if (user.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/faculty/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F5F7FC] dark:bg-[#0B1120] text-slate-900 dark:text-white transition-colors">
      <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center font-black text-xl mb-4 shadow-lg shadow-orange-500/30 text-white">
        LPU
      </div>
      <p className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-200">
        Lovely Professional University
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Smart Geo-Verified Faculty Attendance System
      </p>
      <div className="w-6 h-6 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin mt-4" />
    </div>
  );
}
