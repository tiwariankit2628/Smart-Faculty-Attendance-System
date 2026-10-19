'use client';

import React from 'react';
import { AuthGuard } from '../../components/auth/AuthGuard';
import { AdminSidebar } from '../../components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-[#F5F7FC] dark:bg-[#0B1120] text-[#17233F] dark:text-[#F1F5F9] flex flex-row transition-colors duration-150">
        {/* Desktop / Tablet Sidebar */}
        <AdminSidebar />

        {/* Workspace Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
