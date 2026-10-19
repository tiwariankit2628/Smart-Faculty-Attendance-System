'use client';

import { Calendar } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ThemeToggle } from '../ui/ThemeToggle';
import { formatDate } from '../../utils/formatters';

export interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  return (
    <header className="h-16 bg-white dark:bg-[#151F33] border-b border-slate-200 dark:border-[#2A3850] px-6 flex items-center justify-between shrink-0 transition-colors duration-150">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {action}

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#1C2940] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A3850]">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(new Date())}</span>
        </div>

        <Badge variant="indigo" dot>
          Live Telemetry
        </Badge>

        <div className="h-6 w-[1px] bg-slate-200 dark:bg-[#2A3850]" />

        <ThemeToggle />
      </div>
    </header>
  );
}
