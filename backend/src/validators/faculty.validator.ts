import { z } from 'zod';

export const faceRegistrationSchema = z.object({
  image: z.string().min(20, 'A valid base64 or binary face image string is required'),
});

export type FaceRegistrationInput = z.infer<typeof faceRegistrationSchema>;

export const createBiometricUpdateRequestSchema = z.object({
  image: z.string().min(20, 'A valid base64 or binary facial photograph string is required'),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional().default(''),
});

export type CreateBiometricUpdateRequestInput = z.infer<typeof createBiometricUpdateRequestSchema>;

