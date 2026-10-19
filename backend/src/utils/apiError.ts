export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  // Pre-configured common application errors
  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED', details?: unknown): AppError {
    return new AppError(401, code, message, details);
  }

  static forbidden(message = 'Access forbidden.', code = 'FORBIDDEN', details?: unknown): AppError {
    return new AppError(403, code, message, details);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND', details?: unknown): AppError {
    return new AppError(404, code, message, details);
  }

  static conflict(message: string, code = 'CONFLICT', details?: unknown): AppError {
    return new AppError(409, code, message, details);
  }

  static unprocessable(message: string, code = 'UNPROCESSABLE_ENTITY', details?: unknown): AppError {
    return new AppError(422, code, message, details);
  }

  static tooManyRequests(message = 'Too many requests.', code = 'RATE_LIMIT_EXCEEDED'): AppError {
    return new AppError(429, code, message);
  }

  static internal(message = 'Internal server error.', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(500, code, message, undefined, false);
  }

  static serviceUnavailable(message = 'Service unavailable.', code = 'SERVICE_UNAVAILABLE'): AppError {
    return new AppError(503, code, message);
  }
}
