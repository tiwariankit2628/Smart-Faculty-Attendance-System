'use client';

import { LogOut, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { NotificationCenter } from './NotificationCenter';
import { ThemeToggle } from '../ui/ThemeToggle';

export function FacultyHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-[#151F33]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#2A3850] transition-colors duration-150">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand & Faculty Brief */}
        <Link href="/faculty/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-[#F95700] text-white flex items-center justify-center font-black text-sm shadow-xs select-none tracking-tight transition-transform group-hover:scale-105">
            LPU
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                LPU Attendance
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-[#5B45F5] dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/80">
                Faculty
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-none">
              {user?.fullName || 'Dr. Amit Sharma'}
            </p>
          </div>
        </Link>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          <NotificationCenter />

          <Link
            href="/faculty/profile"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2940] transition-colors cursor-pointer"
            title="Profile"
            aria-label="Profile"
          >
            <UserCircle className="w-5 h-5" />
          </Link>

          <button
            onClick={() => logout()}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
