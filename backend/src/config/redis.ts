import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export interface ICacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<string | null>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  disconnect(): void;
  isMock: boolean;
}

// In-memory fallback cache implementing Redis operations
export class InMemoryRedisMock implements ICacheClient {
  private store = new Map<string, { value: string; expiry?: number }>();
  public isMock = true;

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<string | null> {
    let expiry: number | undefined;
    let onlyIfNotExist = false;

    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'EX' && i + 1 < args.length) {
        expiry = Date.now() + Number(args[i + 1]) * 1000;
        i++;
      } else if (arg === 'PX' && i + 1 < args.length) {
        expiry = Date.now() + Number(args[i + 1]);
        i++;
      } else if (arg === 'NX') {
        onlyIfNotExist = true;
      }
    }

    if (onlyIfNotExist) {
      const existing = await this.get(key);
      if (existing !== null) {
        return null;
      }
    }

    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const val = await this.get(key);
    const num = (parseInt(val || '0', 10) || 0) + 1;
    await this.set(key, String(num));
    return num;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiry = Date.now() + seconds * 1000;
    this.store.set(key, entry);
    return 1;
  }

  disconnect(): void {
    this.store.clear();
  }
}

const memoryFallback = new InMemoryRedisMock();
let realRedisClient: Redis | null = null;
let isRealRedisConnected = false;

if (env.NODE_ENV !== 'test') {
  try {
    realRedisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        if (times > 5 && env.NODE_ENV !== 'production') {
          logger.info('Redis server not found locally. Continuing with in-memory fallback cache.');
          return null;
        }
        // Exponential backoff capped at 3000ms
        const delay = Math.min(times * 100, 3000);
        logger.warn({ attempt: times, nextRetryMs: delay }, 'Redis attempting reconnect...');
        return delay;
      },
    });

    realRedisClient.on('connect', () => {
      isRealRedisConnected = true;
      logger.info('Connected to Redis cache service.');
    });

    realRedisClient.on('ready', () => {
      isRealRedisConnected = true;
    });

    realRedisClient.on('close', () => {
      isRealRedisConnected = false;
    });

    realRedisClient.on('reconnecting', (time: number) => {
      logger.warn({ nextRetryMs: time }, 'Redis reconnecting in background...');
    });

    realRedisClient.on('error', (err) => {
      isRealRedisConnected = false;
      logger.warn({ err: err.message }, 'Redis connection warning. Utilizing in-memory state fallback.');
    });

    realRedisClient
      .connect()
      .then(() => {
        isRealRedisConnected = true;
      })
      .catch(() => {
        isRealRedisConnected = false;
        logger.warn('Redis initial connection deferred. Running with in-memory fallback cache while auto-retrying.');
      });
  } catch {
    isRealRedisConnected = false;
  }
}

import { AppError } from '../utils/apiError';

export const redis: ICacheClient = {
  get: async (key: string) => {
    if (isRealRedisConnected && realRedisClient) {
      try {
        return await realRedisClient.get(key);
      } catch (err) {
        if (!env.REDIS_ALLOW_FALLBACK) {
          throw AppError.serviceUnavailable(
            'Distributed cache unavailable and in-memory fallback is disabled in production.',
            'REDIS_UNAVAILABLE'
          );
        }
        return memoryFallback.get(key);
      }
    }
    if (!env.REDIS_ALLOW_FALLBACK) {
      throw AppError.serviceUnavailable(
        'Distributed cache is offline and in-memory fallback is disabled in production.',
        'REDIS_UNAVAILABLE'
      );
    }
    return memoryFallback.get(key);
  },
  set: async (key: string, value: string, ...args: (string | number)[]) => {
    if (isRealRedisConnected && realRedisClient) {
      try {
        return await realRedisClient.set(key, value, ...(args as unknown as [any]));
      } catch (err) {
        if (!env.REDIS_ALLOW_FALLBACK) {
          throw AppError.serviceUnavailable(
            'Distributed cache unavailable and in-memory fallback is disabled in production.',
            'REDIS_UNAVAILABLE'
          );
        }
        return memoryFallback.set(key, value, ...args);
      }
    }
    if (!env.REDIS_ALLOW_FALLBACK) {
      throw AppError.serviceUnavailable(
        'Distributed cache is offline and in-memory fallback is disabled in production.',
        'REDIS_UNAVAILABLE'
      );
    }
    return memoryFallback.set(key, value, ...args);
  },
  del: async (key: string) => {
    if (isRealRedisConnected && realRedisClient) {
      try {
        return await realRedisClient.del(key);
      } catch (err) {
        if (!env.REDIS_ALLOW_FALLBACK) {
          throw AppError.serviceUnavailable(
            'Distributed cache unavailable and in-memory fallback is disabled in production.',
            'REDIS_UNAVAILABLE'
          );
        }
        return memoryFallback.del(key);
      }
    }
    if (!env.REDIS_ALLOW_FALLBACK) {
      throw AppError.serviceUnavailable(
        'Distributed cache is offline and in-memory fallback is disabled in production.',
        'REDIS_UNAVAILABLE'
      );
    }
    return memoryFallback.del(key);
  },
  incr: async (key: string) => {
    if (isRealRedisConnected && realRedisClient) {
      try {
        return await realRedisClient.incr(key);
      } catch (err) {
        if (!env.REDIS_ALLOW_FALLBACK) {
          throw AppError.serviceUnavailable(
            'Distributed cache unavailable and in-memory fallback is disabled in production.',
            'REDIS_UNAVAILABLE'
          );
        }
        return memoryFallback.incr(key);
      }
    }
    if (!env.REDIS_ALLOW_FALLBACK) {
      throw AppError.serviceUnavailable(
        'Distributed cache is offline and in-memory fallback is disabled in production.',
        'REDIS_UNAVAILABLE'
      );
    }
    return memoryFallback.incr(key);
  },
  expire: async (key: string, seconds: number) => {
    if (isRealRedisConnected && realRedisClient) {
      try {
        return await realRedisClient.expire(key, seconds);
      } catch (err) {
        if (!env.REDIS_ALLOW_FALLBACK) {
          throw AppError.serviceUnavailable(
            'Distributed cache unavailable and in-memory fallback is disabled in production.',
            'REDIS_UNAVAILABLE'
          );
        }
        return memoryFallback.expire(key, seconds);
      }
    }
    if (!env.REDIS_ALLOW_FALLBACK) {
      throw AppError.serviceUnavailable(
        'Distributed cache is offline and in-memory fallback is disabled in production.',
        'REDIS_UNAVAILABLE'
      );
    }
    return memoryFallback.expire(key, seconds);
  },
  disconnect: () => {
    if (realRedisClient) {
      realRedisClient.disconnect();
    }
    memoryFallback.disconnect();
  },
  get isMock() {
    return !isRealRedisConnected;
  },
};

export { realRedisClient };
