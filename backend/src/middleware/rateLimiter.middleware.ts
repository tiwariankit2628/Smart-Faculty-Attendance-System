import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { realRedisClient } from '../config/redis';
import { env } from '../config/env';

/**
 * Creates a distributed Redis-backed store for clustered environments.
 * Falls back to default express-rate-limit MemoryStore during tests or local offline mode.
 */
function createStore(prefix: string) {
  if (env.NODE_ENV === 'production' && realRedisClient) {
    return new RedisStore({
      prefix: `rl:${prefix}:`,
      // @ts-expect-error - Known type mismatch between @types/ioredis call signature and rate-limit-redis
      sendCommand: (...args: string[]) => realRedisClient.call(...args),
    });
  }
  return undefined;
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

export const attendanceRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === 'development' ? 100 : 15, // Higher ceiling in development for test suites
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('attendance'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many verification attempts in a short duration. Please pause and retry.',
    },
  },
});

/**
 * Per-faculty rate limiter for server-side liveness challenge creation.
 * Enforces the Phase 5/7 security requirement: 10 challenge requests / 5 minutes / faculty.
 */
export const challengeRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: env.NODE_ENV === 'development' ? 50 : 10, // 10 requests / 5 minutes / faculty in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.userId ? `user:${(req as any).user.userId}` : req.ip || 'unknown';
  },
  store: createStore('challenge'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many challenge generation attempts. Maximum 10 challenge requests allowed per 5 minutes.',
    },
  },
});

/**
 * Rate limiter for initial face biometric enrollment to prevent resource exhaustion.
 */
export const faceRegistrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 5 : 200, // 5 requests / 15 minutes / faculty in prod
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.userId ? `user:${(req as any).user.userId}` : req.ip || 'unknown';
  },
  store: createStore('face-reg'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many face registration attempts. Please pause and retry after 15 minutes.',
    },
  },
});

