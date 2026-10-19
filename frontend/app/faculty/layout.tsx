'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera, History, User } from 'lucide-react';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { FacultyHeader } from '../../components/faculty/FacultyHeader';

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      href: '/faculty/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Attendance',
      href: '/faculty/attendance',
      icon: <Camera className="w-5 h-5" />,
    },
    {
      label: 'History',
      href: '/faculty/history',
      icon: <History className="w-5 h-5" />,
    },
    {
      label: 'Profile',
      href: '/faculty/profile',
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <AuthGuard allowedRoles={['FACULTY', 'ADMIN']}>
      <div className="min-h-screen bg-[#F5F7FC] dark:bg-[#0B1120] text-[#17233F] dark:text-[#F1F5F9] flex flex-col pb-24 transition-colors duration-150">
        <FacultyHeader />
        <main className="flex-1 max-w-md md:max-w-2xl lg:max-w-4xl w-full mx-auto px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>

        {/* Mobile / Compact Persistent Bottom Navigation Bar */}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#151F33]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#2A3850] shadow-[0_-4px_25px_rgba(0,0,0,0.06)] transition-colors duration-150">
          <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto grid grid-cols-4 h-16">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-all ${
                    isActive
                      ? 'text-[#5B45F5] dark:text-indigo-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                    {item.icon}
                  </div>
                  <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
                  {isActive ? (
                    <span className="w-4 h-1 rounded-full bg-[#5B45F5] dark:bg-indigo-400 mt-0.5" />
                  ) : (
                    <span className="w-4 h-1 mt-0.5 opacity-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </AuthGuard>
  );
}
