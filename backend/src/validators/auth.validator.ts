import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters long').trim(),
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  employeeId: z.string().min(3, 'Faculty ID must be at least 3 characters long').toUpperCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  department: z.string().min(2, 'Department is required').trim(),
  image: z.string().optional(),
  faceImage: z.string().optional(),
});

export const checkFaceSchema = z.object({
  image: z.string().min(50, 'Face image capture is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address format').toLowerCase().trim(),
  resetToken: z.string().min(4, 'Reset token or verification code is required').trim(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckFaceInput = z.infer<typeof checkFaceSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
