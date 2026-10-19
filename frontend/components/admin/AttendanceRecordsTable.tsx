'use client';

import React, { useState } from 'react';
import { Search, Download, Camera, Eye } from 'lucide-react';
import { AttendanceRecord } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDate, formatTime } from '../../utils/formatters';
import { AttendanceDetailModal } from './AttendanceDetailModal';
import { adminService } from '../../services/admin.service';

export interface AttendanceRecordsTableProps {
  records: AttendanceRecord[];
  onOverride?: (
    recordId: string,
    overrideData: { reason: string; status: 'VERIFIED' | 'REJECTED' }
  ) => Promise<void>;
  onRefresh?: () => void;
}

interface EvidenceThumbnailCellProps {
  record: AttendanceRecord;
  onOpenDetail: () => void;
}

function EvidenceThumbnailCell({ record, onOpenDetail }: EvidenceThumbnailCellProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const hasEvidence = Boolean(
    record.verificationEvidence?.hasEvidence || record.evidenceAvailable
  );
  const isExpired = Boolean(
    record.verificationEvidence?.isExpired || record.evidenceExpired
  );

  React.useEffect(() => {
    let isMounted = true;
    let localUrl: string | null = null;

    if (hasEvidence && !isExpired) {
      setIsLoading(true);
      adminService
        .getAttendanceEvidenceUrl(record.id)
        .then((url) => {
          if (!isMounted) {
            URL.revokeObjectURL(url);
            return;
          }
          localUrl = url;
          setThumbUrl(url);
          setIsLoading(false);
        })
        .catch(() => {
          if (isMounted) {
            setIsError(true);
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [record.id, hasEvidence, isExpired]);

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Camera className="w-3 h-3 text-amber-500" />
        <span>Evidence Expired</span>
      </span>
    );
  }

  if (!hasEvidence) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
        <Camera className="w-3 h-3 opacity-40" />
        <span>No Evidence</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="inline-flex items-center gap-2 p-1 pr-2.5 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer group shadow-2xs"
      title="Click to view full captured verification photo in investigation view"
    >
      <div className="relative w-7 h-7 rounded-md overflow-hidden bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-700">
        {isLoading ? (
          <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        ) : thumbUrl && !isError ? (
          <img
            src={thumbUrl}
            alt="Captured verification photo"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
        ) : (
          <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <span className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-200">
        <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        <span>View Evidence</span>
      </span>
    </button>
  );
}

export function AttendanceRecordsTable({
  records,
  onOverride,
  onRefresh,
}: AttendanceRecordsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Investigation & Regularisation Modal state
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenDetail = (record: AttendanceRecord) => {
    setSelectedRecordId(record.id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedRecordId(null);
  };

  const handleOverrideSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const exportCsv = () => {
    const headers = [
      'Record ID',
      'Employee ID',
      'Faculty Name',
      'Department',
      'Date',
      'Time',
      'Status',
      'Distance (m)',
      'Accuracy (m)',
      'Face Confidence',
    ];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.employeeId,
      `"${r.facultyName}"`,
      `"${r.department}"`,
      r.date,
      formatTime(r.timestamp),
      r.status,
      r.locationVerification.distanceMeters,
      r.locationVerification.accuracyMeters,
      r.faceVerification.confidenceScore,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `faculty_attendance_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Card padding="none" className="overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search faculty or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified Present</option>
              <option value="FLAGGED">Flagged for Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            icon={<Download className="w-3.5 h-3.5" />}
            className="text-xs shrink-0 w-full sm:w-auto"
          >
            Export CSV
          </Button>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Faculty</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Verification Telemetry</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Evidence</th>
                <th className="px-5 py-3.5">Audit & Notes</th>
                <th className="px-5 py-3.5 text-right">Investigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No matching attendance records.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {rec.facultyName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {rec.employeeId} • {rec.department}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(rec.date)}
                      </p>
                      <p className="text-[11px] text-slate-500">{formatTime(rec.timestamp)}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="space-y-1 text-[11px]">
                        <p className="text-slate-700 dark:text-slate-300">
                          Geo: <span className="font-semibold">{Math.round(rec.locationVerification.distanceMeters)}m</span> from zone (±{Math.round(rec.locationVerification.accuracyMeters)}m)
                        </p>
                        <p className="text-slate-700 dark:text-slate-300">
                          Bio: <span className="font-semibold">{Math.round(rec.faceVerification.confidenceScore * 100)}%</span> match (Liveness: {rec.faceVerification.livenessPassed ? 'Pass' : 'Fail'})
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          rec.status === 'VERIFIED'
                            ? 'emerald'
                            : rec.status === 'FLAGGED'
                            ? 'amber'
                            : 'rose'
                        }
                        dot
                      >
                        {rec.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <EvidenceThumbnailCell
                        record={rec}
                        onOpenDetail={() => handleOpenDetail(rec)}
                      />
                    </td>

                    <td className="px-5 py-3.5 max-w-[200px]">
                      {rec.manualOverride ? (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          Overridden by {rec.manualOverride.overriddenByName}: &quot;{rec.manualOverride.reason}&quot;
                        </div>
                      ) : rec.rejectionReason ? (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 truncate" title={rec.rejectionReason}>
                          {rec.rejectionReason}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-400">Automated pass</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenDetail(rec)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 font-medium text-xs"
                        title="Investigate telemetry & evidence"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comprehensive 8-Section Investigation & Regularisation Modal */}
      <AttendanceDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        attendanceId={selectedRecordId}
        onOverrideSuccess={handleOverrideSuccess}
      />
    </>
  );
}
