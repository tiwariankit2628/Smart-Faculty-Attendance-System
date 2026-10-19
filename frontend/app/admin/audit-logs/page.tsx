'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { adminService } from '../../../services/admin.service';
import { AuditLogEvent } from '../../../types';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { AuditLogViewer } from '../../../components/admin/AuditLogViewer';
import { AuditDetailModal } from '../../../components/admin/AuditDetailModal';
import { Button } from '../../../components/ui/Button';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEvent | null>(null);

  const loadLogs = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      try {
        const res = await adminService.getAuditLogsPaginated({
          page: pageToLoad,
          limit: 20,
          search: searchTerm,
          action: actionFilter,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
        });

        if (res && res.logs) {
          setLogs(res.logs);
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, actionFilter, startDate, endDate, pagination.page]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, actionFilter, startDate, endDate]);

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Institutional Audit & Compliance Center"
        subtitle="Cryptographically verified, immutable record of administrative actions, biometric events, and verification decisions"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadLogs(pagination.page)}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Refresh Logs
          </Button>
        }
      />

      <div className="p-6">
        <AuditLogViewer
          logs={logs}
          isLoading={isLoading}
          pagination={pagination}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          actionFilter={actionFilter}
          setActionFilter={setActionFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onPageChange={(page) => loadLogs(page)}
          onSelectLog={(log) => setSelectedLog(log)}
        />
      </div>

      <AuditDetailModal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </div>
  );
}
