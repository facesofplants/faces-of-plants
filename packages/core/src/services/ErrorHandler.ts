import { type APIGatewayProxyResult } from 'aws-lambda';

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  ErrorResponse,
  formatErrorResponse,
} from '../validation/errors';

/**
 * Error context for logging and tracking
 */
export interface ErrorContext {
  requestId: string;
  userId?: string;
  path: string;
  method: string;
  [key: string]: any;
}

/**
 * Error handler service for consistent error processing
 */
export class ErrorHandler {
  /**
   * Handle error and return API Gateway response
   */
  handle(error: Error, context: ErrorContext): APIGatewayProxyResult {
    // Log the error
    this.logError(error, context);

    // Handle known application errors
    if (error instanceof AppError) {
      return this.handleAppError(error, context);
    }

    // Handle unknown errors as internal server errors
    return this.handleUnknownError(error, context);
  }

  /**
   * Handle application errors (known error types)
   */
  private handleAppError(error: AppError, context: ErrorContext): APIGatewayProxyResult {
    const response = error.toJSON();
    response.error.requestId = context.requestId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add retry-after header for rate limit errors
    if (error instanceof RateLimitError && error.retryAfter) {
      headers['Retry-After'] = String(error.retryAfter);
    }

    return {
      statusCode: error.statusCode,
      headers,
      body: JSON.stringify(response),
    };
  }

  /**
   * Handle unknown errors (unhandled exceptions)
   */
  private handleUnknownError(error: Error, context: ErrorContext): APIGatewayProxyResult {
    // Don't expose internal error details to clients
    const response = formatErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      undefined,
      context.requestId
    );

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };
  }

  /**
   * Log error with context
   */
  logError(error: Error, context: ErrorContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: this.getLogLevel(error),
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    };

    // Use appropriate log level
    if (logEntry.level === 'ERROR') {
      console.error(JSON.stringify(logEntry));
    } else if (logEntry.level === 'WARN') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Determine log level based on error type
   */
  private getLogLevel(error: Error): 'ERROR' | 'WARN' | 'INFO' {
    // Client errors (4xx) are warnings
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      return 'WARN';
    }

    // Rate limit errors are info
    if (error instanceof RateLimitError) {
      return 'INFO';
    }

    // Server errors (5xx) are errors
    return 'ERROR';
  }
}

/**
 * Create error response builder for common scenarios
 */
export class ErrorResponseBuilder {
  private code: string;
  private message: string;
  private statusCode: number;
  private details?: Record<string, any>;
  private requestId?: string;

  constructor(statusCode: number, code: string, message: string) {
    this.statusCode = statusCode;
    this.code = code;
    this.message = message;
  }

  /**
   * Add error details
   */
  withDetails(details: Record<string, any>): this {
    this.details = details;
    return this;
  }

  /**
   * Add request ID
   */
  withRequestId(requestId: string): this {
    this.requestId = requestId;
    return this;
  }

  /**
   * Build API Gateway response
   */
  build(): APIGatewayProxyResult {
    const response = formatErrorResponse(this.code, this.message, this.details, this.requestId);

    return {
      statusCode: this.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };
  }

  /**
   * Create validation error response
   */
  static validationError(message = 'Validation failed'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(400, 'VALIDATION_ERROR', message);
  }

  /**
   * Create authentication error response
   */
  static authenticationError(message = 'Authentication required'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(401, 'UNAUTHORIZED', message);
  }

  /**
   * Create authorization error response
   */
  static authorizationError(message = 'Access denied'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(403, 'FORBIDDEN', message);
  }

  /**
   * Create not found error response
   */
  static notFoundError(message = 'Resource not found'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(404, 'NOT_FOUND', message);
  }

  /**
   * Create rate limit error response
   */
  static rateLimitError(message = 'Too many requests'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(429, 'RATE_LIMIT_EXCEEDED', message);
  }

  /**
   * Create internal error response
   */
  static internalError(message = 'Internal server error'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(500, 'INTERNAL_ERROR', message);
  }

  /**
   * Create service unavailable error response
   */
  static serviceUnavailableError(
    message = 'Service temporarily unavailable'
  ): ErrorResponseBuilder {
    return new ErrorResponseBuilder(503, 'SERVICE_UNAVAILABLE', message);
  }

  /**
   * Create gateway timeout error response
   */
  static gatewayTimeoutError(message = 'Request timeout'): ErrorResponseBuilder {
    return new ErrorResponseBuilder(504, 'GATEWAY_TIMEOUT', message);
  }
}

/**
 * Singleton error handler instance
 */
export const errorHandler = new ErrorHandler();
