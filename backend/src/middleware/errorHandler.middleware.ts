import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Handled Application Errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, 'Application Server Error');
    } else {
      logger.warn({ err: err.message, code: err.code, path: req.path }, 'Client Operational Error');
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 3. Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const isAttendanceDup = err.message?.includes('Attendance') || (err.keyPattern && err.keyPattern.facultyId && err.keyPattern.date);
    const code = isAttendanceDup ? 'DUPLICATE_ATTENDANCE' : 'DUPLICATE_RESOURCE';
    const message = isAttendanceDup
      ? 'Attendance has already been marked for today. Duplicates are strictly prevented.'
      : 'A record with this unique information already exists.';

    res.status(409).json({
      success: false,
      error: {
        code,
        message,
      },
    });
    return;
  }

  // 4. Mongoose CastError / ValidationError
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID_FORMAT',
        message: `Invalid format for field: ${err.path}`,
      },
    });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
    return;
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication credentials provided.',
      },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Session has expired. Please log in again.',
      },
    });
    return;
  }

  // 6. Generic/Unhandled 500 Errors
  logger.error(
    {
      errorName: err.name,
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    },
    'Unhandled Server Exception'
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected internal error occurred. Please contact system support.'
          : err.message || 'Internal server error',
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
    },
  });
}
