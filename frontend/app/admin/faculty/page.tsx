'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, RefreshCw } from 'lucide-react';
import { adminService } from '../../../services/admin.service';
import { FacultyListItem } from '../../../types';
import { AdminHeader } from '../../../components/admin/AdminHeader';
import { FacultyTable } from '../../../components/admin/FacultyTable';
import { FacultyDetailModal } from '../../../components/admin/FacultyDetailModal';
import { CreateFacultyModal } from '../../../components/admin/CreateFacultyModal';
import { Button } from '../../../components/ui/Button';

export default function FacultyManagementPage() {
  const [facultyList, setFacultyList] = useState<FacultyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [faceEnrolledFilter, setFaceEnrolledFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);

  const loadFaculty = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      try {
        const res = await adminService.getFacultyListPaginated({
          page: pageToLoad,
          limit: 15,
          search: searchTerm,
          department: departmentFilter,
          status: statusFilter,
          faceEnrolled: faceEnrolledFilter,
        });

        if (res && res.faculty) {
          setFacultyList(res.faculty);
          setPagination(res.pagination);
        }
      } catch (err) {
        console.error('Failed to load faculty roster:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, departmentFilter, statusFilter, faceEnrolledFilter, pagination.page]
  );

  useEffect(() => {
    // Debounce search / filter changes
    const timer = setTimeout(() => {
      loadFaculty(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, departmentFilter, statusFilter, faceEnrolledFilter]);

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    try {
      await adminService.toggleFacultyStatus(id, currentActive);
      await loadFaculty(pagination.page);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Faculty Management & Biometric Directory"
        subtitle="Manage faculty credentials, department allocations, and facial biometric enrollment"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadFaculty(pagination.page)}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              className="text-xs"
            >
              Refresh Roster
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
              className="text-xs font-semibold"
            >
              Add Faculty
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <FacultyTable
          facultyList={facultyList}
          isLoading={isLoading}
          pagination={pagination}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          faceEnrolledFilter={faceEnrolledFilter}
          setFaceEnrolledFilter={setFaceEnrolledFilter}
          onPageChange={(page) => loadFaculty(page)}
          onToggleStatus={handleToggleStatus}
          onViewDetail={(id) => setSelectedFacultyId(id)}
        />
      </div>

      <CreateFacultyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadFaculty(1)}
      />

      <FacultyDetailModal
        isOpen={Boolean(selectedFacultyId)}
        onClose={() => setSelectedFacultyId(null)}
        facultyId={selectedFacultyId}
        onFacultyUpdated={() => loadFaculty(pagination.page)}
      />
    </div>
  );
}
