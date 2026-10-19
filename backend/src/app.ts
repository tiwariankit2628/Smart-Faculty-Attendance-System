import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { apiV1Routes } from './routes';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // Configure trust proxy according to deployment architecture (Nginx, ALB, Cloudflare)
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'false') {
    const proxyVal = env.TRUST_PROXY === 'true' ? true : !isNaN(Number(env.TRUST_PROXY)) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY;
    app.set('trust proxy', proxyVal);
  } else {
    app.set('trust proxy', false);
  }

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS Configuration
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  const allowedOrigins = [
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (such as mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (
          env.NODE_ENV !== 'production' &&
          (/^http:\/\/localhost(:\d+)?$/.test(origin) ||
            /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
            /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin))
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept'],
      exposedHeaders: ['X-Request-Id'],
    })
  );

  // 3. Request Identifiers
  app.use(requestIdMiddleware);

  // 4. Body Parsers with Controlled Limits
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 5. Cookie Parser with Secret
  app.use(cookieParser(env.COOKIE_SECRET));

  // 6. Request Logging
  app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration,
          requestId: (req as any).requestId,
          ip: req.ip,
        },
        'HTTP Request Completed'
      );
    });
    next();
  });

  // 7. System Health Endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      service: 'geo-faculty-attendance-backend',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // 8. Mount Main API Router
  app.use('/api/v1', apiV1Routes);

  // 9. Unmatched Route Handler (404)
  app.use(notFoundHandler);

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
