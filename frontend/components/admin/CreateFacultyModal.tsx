'use client';

import React, { useState } from 'react';
import { User, Mail, Lock, Building, IdCard, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { adminService } from '../../services/admin.service';

interface CreateFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateFacultyModal({ isOpen, onClose, onSuccess }: CreateFacultyModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('School of Computer Science & Engineering (SCSE)');
  const [password, setPassword] = useState('FacultyPassword@123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = [
    'School of Computer Science & Engineering (SCSE)',
    'Department of Electronics & Communication',
    'Department of Mechanical Engineering',
    'Department of Civil Engineering',
    'Department of Biotechnology',
    'Department of Management Studies',
    'Department of Mathematics & Computing',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await adminService.createFaculty({
        name,
        email,
        employeeId,
        department,
        password,
      });

      // Reset form
      setName('');
      setEmail('');
      setEmployeeId('');
      setPassword('FacultyPassword@123');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create faculty member.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Onboard New Faculty Member" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Full Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dr. Priya Patel"
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Faculty / Employee ID"
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
            placeholder="LPU-FAC-104"
            leftIcon={<IdCard className="w-4 h-4" />}
            required
          />

          <Input
            label="Official Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya@lpu.in"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Academic Department
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Building className="w-4 h-4" />
            </div>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Initial Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Save & Onboard Faculty
          </Button>
        </div>
      </form>
    </Modal>
  );
}
