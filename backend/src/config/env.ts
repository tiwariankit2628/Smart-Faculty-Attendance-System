import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const backendRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.resolve(backendRoot, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),

  MONGODB_URI: z.string().default('mongodb://localhost:27017/geo_faculty_attendance'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_ALLOW_FALLBACK: z.string().transform((val) => val === 'true').default('true'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  FACE_SERVICE_URL: z.string().default('http://localhost:8000'),
  FACE_SERVICE_API_KEY: z.string().default('internal_secret_face_service_key_7788'),
  MOCK_FACE_SERVICE: z.string().transform((val) => val === 'true').default('true'),

  DEFAULT_GEOFENCE_LAT: z.coerce.number().default(31.2536),
  DEFAULT_GEOFENCE_LNG: z.coerce.number().default(75.7037),
  DEFAULT_GEOFENCE_RADIUS_METERS: z.coerce.number().default(500),
  MAX_ALLOWED_ACCURACY_METERS: z.coerce.number().default(35),

  // Campus Network Security & Physical Anchor
  CAMPUS_ALLOWED_IPS: z.string().default('127.0.0.1,::1,::ffff:127.0.0.1'),
  CAMPUS_ALLOWED_CIDRS: z.string().default('10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8'),
  ENABLE_CAMPUS_NETWORK_CHECK: z.string().transform((val) => val === 'true').default('true'),
  TRUST_PROXY: z.string().default('false'),

  // Biometric Evidence Storage & Privacy Retention
  ATTENDANCE_EVIDENCE_RETENTION_DAYS: z.coerce.number().default(90),
  EVIDENCE_STORAGE_PATH: z.string().default(path.resolve(backendRoot, 'storage', 'evidence')),

  // Faculty Profile Photo Storage (Phase 10.2 Private Vault)
  PROFILE_PHOTO_STORAGE_PATH: z.string().default(path.resolve(backendRoot, 'storage', 'profile_photos')),
  MAX_PROFILE_PHOTO_SIZE_BYTES: z.coerce.number().default(5 * 1024 * 1024),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (data.MOCK_FACE_SERVICE && process.env.ALLOW_MOCK_FACE_SERVICE !== 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MOCK_FACE_SERVICE'],
        message: 'CRITICAL: MOCK_FACE_SERVICE cannot be true in production mode unless ALLOW_MOCK_FACE_SERVICE=true is explicitly set.',
      });
    }
    if ((data.CORS_ORIGIN.includes('localhost') || data.CORS_ORIGIN === '*') && process.env.ALLOW_LOCALHOST_CORS !== 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CRITICAL: CORS_ORIGIN cannot be localhost or wildcard (*) in production mode unless ALLOW_LOCALHOST_CORS=true is set for staging/testing.',
      });
    }
    if (data.JWT_ACCESS_SECRET.length < 32 || data.JWT_ACCESS_SECRET.toLowerCase().includes('change_me')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'CRITICAL: JWT_ACCESS_SECRET must be at least 32 characters and must not contain placeholder values in production.',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
