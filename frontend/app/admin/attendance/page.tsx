'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { adminService } from '../../../services/admin.service';
import { AttendanceRecord } from '../../../types';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { AttendanceRecordsTable } from '../../../components/admin/AttendanceRecordsTable';
import { Button } from '../../../components/ui/Button';

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAttendanceRecords();
      setRecords(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleOverride = async (
    recordId: string,
    overrideData: { reason: string; status: 'VERIFIED' | 'REJECTED' }
  ) => {
    await adminService.overrideAttendance(recordId, overrideData);
    await loadRecords();
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="LPU Faculty Attendance Records"
        subtitle="Filterable verification history, audit details, and administrative regularisations"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={loadRecords}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Refresh Records
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <AttendanceRecordsTable
          records={records}
          onOverride={handleOverride}
          onRefresh={loadRecords}
        />
      </div>
    </div>
  );
}
