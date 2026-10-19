'use client';

import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../components/ui/Button';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
      <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4">
        <ShieldAlert className="w-10 h-10" />
      </div>

      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Access Restricted
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6">
        You do not possess the required administrative clearance to access this portal.
      </p>

      <Link href="/faculty/dashboard">
        <Button variant="primary" icon={<ArrowLeft className="w-4 h-4" />}>
          Return to Faculty Portal
        </Button>
      </Link>
    </div>
  );
}
