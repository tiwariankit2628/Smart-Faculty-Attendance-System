import { z } from 'zod';

export const verifyLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  accuracy: z.number().positive('Accuracy must be a positive number in meters'),
});

export const verifyFaceSchema = z.object({
  image: z.string().min(20, 'Face image payload (base64) is required'),
  frames: z.array(z.string().min(20)).optional(),
  challengeToken: z.string().optional(),
});

export const markAttendanceSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  locationToken: z.string().min(5, 'Location verification token is required'),
  faceToken: z.string().min(5, 'Face verification token is required'),
  challengeToken: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type VerifyLocationInput = z.infer<typeof verifyLocationSchema>;
export type VerifyFaceInput = z.infer<typeof verifyFaceSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
