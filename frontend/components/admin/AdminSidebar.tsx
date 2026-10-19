'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  AlertOctagon,
  MapPin,
  ShieldAlert,
  LogOut,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ui/ThemeToggle';

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: 'Attendance Records',
      href: '/admin/attendance',
      icon: <ClipboardCheck className="w-4 h-4" />,
    },
    {
      label: 'Needs Review',
      href: '/admin/review-queue',
      icon: <AlertOctagon className="w-4 h-4 text-amber-500" />,
    },
    {
      label: 'Biometric Updates',
      href: '/admin/biometric-update-requests',
      icon: <UserCheck className="w-4 h-4 text-sky-500" />,
    },
    {
      label: 'Faculty Directory',
      href: '/admin/faculty',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Audit Center',
      href: '/admin/audit-logs',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      label: 'Geofence Zones',
      href: '/admin/zone',
      icon: <MapPin className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#10192B] text-slate-700 dark:text-slate-300 flex flex-col shrink-0 border-r border-slate-200 dark:border-[#2A3850] select-none transition-colors duration-150">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-[#2A3850]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F95700] text-white flex items-center justify-center font-black text-sm shadow-sm select-none">
            LPU
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              LPU Portal
            </h2>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400">
              Administration
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[#5B45F5] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1C2940]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-[#2A3850]/80">
          <Link
            href="/faculty/dashboard"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#5B45F5] dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>Switch to Faculty PWA</span>
          </Link>
        </div>
      </nav>

      {/* Theme Switcher Strip */}
      <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-[#2A3850]/80 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Theme</span>
        <ThemeToggle variant="segmented" />
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-[#2A3850] flex items-center justify-between">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1C2940] border border-slate-200 dark:border-[#2A3850] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
            {user?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.fullName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.department || 'Administrator'}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
