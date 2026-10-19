import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'blue';
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'slate',
  dot = false,
  size = 'md',
  className = '',
}: BadgeProps) {
  const variantStyles = {
    emerald:
      'bg-[#E7FAF1] dark:bg-emerald-950/50 text-[#059669] dark:text-emerald-400 border-[#BFF0D7] dark:border-emerald-800/80',
    amber:
      'bg-[#FFF3E5] dark:bg-amber-950/50 text-[#D97706] dark:text-amber-400 border-[#FFE2C2] dark:border-amber-800/80',
    rose:
      'bg-[#FEE2E2] dark:bg-rose-950/50 text-[#DC2626] dark:text-rose-400 border-[#FECACA] dark:border-rose-800/80',
    indigo:
      'bg-[#F1EDFF] dark:bg-indigo-950/50 text-[#5B45F5] dark:text-indigo-400 border-[#E0D7FF] dark:border-indigo-800/80',
    slate:
      'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    blue:
      'bg-[#EAF3FF] dark:bg-sky-950/50 text-[#2563EB] dark:text-sky-400 border-[#CDE1FF] dark:border-sky-800/80',
  };

  const dotStyles = {
    emerald: 'bg-[#10B981]',
    amber: 'bg-[#F59E0B]',
    rose: 'bg-[#EF4444]',
    indigo: 'bg-[#5B45F5] dark:bg-[#7865FF]',
    slate: 'bg-slate-400 dark:bg-slate-500',
    blue: 'bg-[#3B82F6]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}
