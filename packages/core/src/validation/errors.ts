import { type ZodError } from 'zod';

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  path: string[];
  message: string;
  code: string;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ValidationErrorDetail[] | Record<string, any>;
    requestId?: string;
  };
}

/**
 * Base application error class
 */
export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert to JSON response format
   */
  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message, { errors });
    this.errors = errors;
  }

  /**
   * Create ValidationError from Zod error
   */
  static fromZodError(zodError: ZodError): ValidationError {
    const errors: ValidationErrorDetail[] = zodError.errors.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code,
    }));

    return new ValidationError('Validation failed', errors);
  }

  /**
   * Convert to JSON response format
   */
  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.errors,
      },
    };
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  public readonly statusCode = 401;
  public readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  public readonly statusCode = 403;
  public readonly code = 'FORBIDDEN';

  constructor(message = 'Access denied', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';

  constructor(message = 'Resource not found', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly statusCode = 429;
  public readonly code = 'RATE_LIMIT_EXCEEDED';
  public readonly retryAfter?: number;

  constructor(message = 'Too many requests', retryAfter?: number, details?: Record<string, any>) {
    super(message, details);
    this.retryAfter = retryAfter;
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter && { details: { retryAfter: this.retryAfter } }),
      },
    };
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
  public readonly statusCode = 500;
  public readonly code = 'INTERNAL_ERROR';

  constructor(message = 'Internal server error', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  public readonly statusCode = 503;
  public readonly code = 'SERVICE_UNAVAILABLE';

  constructor(message = 'Service temporarily unavailable', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Gateway timeout error (504)
 */
export class GatewayTimeoutError extends AppError {
  public readonly statusCode = 504;
  public readonly code = 'GATEWAY_TIMEOUT';

  constructor(message = 'Request timeout', details?: Record<string, any>) {
    super(message, details);
  }
}

/**
 * Format error response with consistent structure
 */
export function formatErrorResponse(
  code: string,
  message: string,
  details?: ValidationErrorDetail[] | Record<string, any>,
  requestId?: string
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(requestId && { requestId }),
    },
  };
}
