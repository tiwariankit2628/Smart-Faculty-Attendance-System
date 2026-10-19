import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // Never log passwords, tokens or biometrics
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'passwordHash',
      'token',
      'jwt',
      'secret',
      'apiKey',
      'FACE_SERVICE_API_KEY',
      'faceEmbedding',
      'faceEmbeddingReference',
      'image',
      'imageBlob',
      'frame',
      'frames',
      'frames[*]',
    ],
    censor: '[REDACTED]',
  },
});
