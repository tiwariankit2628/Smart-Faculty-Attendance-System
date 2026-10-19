export interface ApiErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export interface ApiResponseEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: ApiErrorDetail[] | Record<string, unknown>;
  };
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code = 'API_ERROR',
    status = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED' || this.code === 'TOKEN_EXPIRED';
  }

  get isForbidden(): boolean {
    return this.status === 403 || this.code === 'FORBIDDEN' || this.code === 'INSUFFICIENT_PERMISSIONS';
  }

  get isConflict(): boolean {
    return this.status === 409 || this.code === 'DUPLICATE_ATTENDANCE' || this.code === 'DUPLICATE_RESOURCE';
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422 || this.code === 'VALIDATION_ERROR';
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 'RATE_LIMIT_EXCEEDED';
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }
}

// Global session expiry listener for automatic cleanup
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function onUnauthorized(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const DEFAULT_API_URL = 'http://localhost:5000/api/v1';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${normalizedEndpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // If payload is not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      // Critical security requirement: Include HTTP-only authentication cookies
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data: ApiResponseEnvelope<T> | null = isJson ? await response.json() : null;

    if (!response.ok) {
      const code = data?.error?.code || `HTTP_${response.status}`;
      const message =
        data?.error?.message ||
        data?.message ||
        getDefaultErrorMessage(response.status);
      const details = data?.error?.details;

      if (response.status === 401 && unauthorizedHandler) {
        unauthorizedHandler();
      }

      throw new ApiError(message, code, response.status, details);
    }

    // Return the payload from standard backend response envelope { success: true, data: T }
    if (data && typeof data === 'object' && 'data' in data && data.data !== undefined) {
      return data.data as T;
    }

    return (data as unknown) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    let message = 'Network error or service unreachable';
    if (error instanceof Error) {
      if (
        error.message.toLowerCase().includes('failed to fetch') ||
        error.name === 'TypeError'
      ) {
        message = `Unable to connect to attendance server. Please ensure the backend is running at ${API_BASE_URL}.`;
      } else {
        message = error.message;
      }
    }
    throw new ApiError(message, 'NETWORK_ERROR', 0);
  }
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request. Please review your input.';
    case 401:
      return 'Session expired or authentication required. Please log in.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'Requested resource was not found.';
    case 409:
      return 'Conflict: Record already exists or duplicate submission detected.';
    case 422:
      return 'Validation failed for submitted data.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
      return 'Internal server error. Please try again shortly.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred.';
  }
}
