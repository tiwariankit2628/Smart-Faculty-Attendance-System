'use client';

import React from 'react';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  UserCheck,
  UserX,
} from 'lucide-react';
import { FacultyListItem } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface FacultyTableProps {
  facultyList: FacultyListItem[];
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (d: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  faceEnrolledFilter: string;
  setFaceEnrolledFilter: (f: string) => void;
  onPageChange: (newPage: number) => void;
  onToggleStatus: (id: string, currentActive: boolean) => void;
  onViewDetail: (id: string) => void;
}

const DEPARTMENTS = [
  'ALL',
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology',
  'Business & Management',
  'Pharmacy',
  'Mathematics & Sciences',
];

export function FacultyTable({
  facultyList,
  isLoading,
  pagination,
  searchTerm,
  setSearchTerm,
  departmentFilter,
  setDepartmentFilter,
  statusFilter,
  setStatusFilter,
  faceEnrolledFilter,
  setFaceEnrolledFilter,
  onPageChange,
  onToggleStatus,
  onViewDetail,
}: FacultyTableProps) {
  return (
    <Card padding="none" className="overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Table Filter Controls */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Departments' : d}
              </option>
            ))}
          </select>

          {/* Account Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Account Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Face Enrollment Filter */}
          <select
            value={faceEnrolledFilter}
            onChange={(e) => setFaceEnrolledFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Biometric Status</option>
            <option value="true">Enrolled Only</option>
            <option value="false">Pending Enrollment</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Faculty Member</th>
              <th className="px-5 py-3.5">Employee ID</th>
              <th className="px-5 py-3.5">Department</th>
              <th className="px-5 py-3.5">Biometrics</th>
              <th className="px-5 py-3.5">Recent Attendance</th>
              <th className="px-5 py-3.5">Account Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading faculty records...</span>
                  </div>
                </td>
              </tr>
            ) : facultyList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No faculty records found matching the specified criteria.
                </td>
              </tr>
            ) : (
              facultyList.map((faculty) => {
                const facId = faculty.id || faculty._id || '';
                const isEnrolled = Boolean(faculty.faceEmbeddingReference);
                const hasRecent = Boolean(faculty.recentAttendance);

                return (
                  <tr
                    key={facId}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {faculty.name}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{faculty.email}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {faculty.employeeId}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {faculty.department}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Joined {new Date(faculty.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {isEnrolled ? (
                        <Badge variant="emerald" dot>
                          Enrolled
                        </Badge>
                      ) : (
                        <Badge variant="amber" dot>
                          Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {hasRecent && faculty.recentAttendance ? (
                        <div>
                          <Badge
                            variant={
                              faculty.recentAttendance.status === 'VERIFIED'
                                ? 'emerald'
                                : faculty.recentAttendance.status === 'REJECTED'
                                ? 'rose'
                                : 'amber'
                            }
                          >
                            {faculty.recentAttendance.status}
                          </Badge>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {faculty.recentAttendance.date}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No attempts</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={faculty.isActive ? 'emerald' : 'slate'}>
                        {faculty.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewDetail(facId)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                        className="text-xs text-indigo-600 dark:text-indigo-400"
                      >
                        Investigate
                      </Button>
                      <Button
                        size="sm"
                        variant={faculty.isActive ? 'outline' : 'primary'}
                        onClick={() => onToggleStatus(facId, faculty.isActive)}
                        className="text-xs"
                      >
                        {faculty.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing page <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.page}</span> of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.totalPages}</span> ({pagination.total} total faculty members)
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page <= 1 || isLoading}
            onClick={() => onPageChange(pagination.page - 1)}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page >= pagination.totalPages || isLoading}
            onClick={() => onPageChange(pagination.page + 1)}
            icon={<ChevronRight className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
