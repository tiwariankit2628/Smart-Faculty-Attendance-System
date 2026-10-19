import { z } from 'zod';

export const createFacultySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  employeeId: z.string().min(3, 'Employee ID must be at least 3 characters').toUpperCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  department: z.string().min(2, 'Department is required'),
});

export const updateFacultySchema = z.object({
  name: z.string().min(2).optional(),
  department: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

export const updateZoneSchema = z.object({
  name: z.string().min(2).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10, 'Radius must be at least 10 meters'),
  maxAllowedAccuracyMeters: z.number().min(5).optional(),
  isActive: z.boolean().optional(),
});

export const overrideAttendanceSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status is required and must be either VERIFIED or REJECTED' }),
  }),
  reason: z
    .string({
      required_error: 'Audit justification reason is required',
    })
    .trim()
    .min(3, 'Audit justification reason must be at least 3 characters long'),
  expectedPreviousStatus: z.enum(['VERIFIED', 'REJECTED', 'FLAGGED']).optional(),
  lastUpdatedAt: z.string().optional(),
});

export const approveBiometricUpdateRequestSchema = z.object({
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional().default(''),
});

export const rejectBiometricUpdateRequestSchema = z.object({
  reason: z
    .string({
      required_error: 'A rejection reason is required.',
    })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters long.')
    .max(500, 'Rejection reason must not exceed 500 characters.'),
});

export const queryBiometricUpdateRequestSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).optional().default('PENDING'),
});

export type CreateFacultyInput = z.infer<typeof createFacultySchema>;
export type UpdateFacultyInput = z.infer<typeof updateFacultySchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
export type OverrideAttendanceInput = z.infer<typeof overrideAttendanceSchema>;
export type ApproveBiometricUpdateRequestInput = z.infer<typeof approveBiometricUpdateRequestSchema>;
export type RejectBiometricUpdateRequestInput = z.infer<typeof rejectBiometricUpdateRequestSchema>;
export type QueryBiometricUpdateRequestInput = z.infer<typeof queryBiometricUpdateRequestSchema>;
