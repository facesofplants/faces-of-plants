import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  GatewayTimeoutError,
} from '../../validation/errors';
import { ErrorHandler, ErrorResponseBuilder, type ErrorContext } from '../ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockContext: ErrorContext;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockContext = {
      requestId: 'test-request-123',
      userId: 'user-456',
      path: '/api/test',
      method: 'GET',
    };

    // Clear and spy on console methods
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('handle', () => {
    it('should handle ValidationError correctly', () => {
      const error = new ValidationError('Validation failed', [
        { path: ['email'], message: 'Invalid email', code: 'invalid_string' },
      ]);

      const response = errorHandler.handle(error, mockContext);

      expect(response.statusCode).toBe(400);
      expect(response.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.requestId).toBe('test-request-123');
      expect(body.error.details).toHaveLength(1);
    });

    it('should handle AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid token');

      const response = errorHandler.handle(error, mockContext);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Invalid token');
    });

    it('should handle RateLimitError with retry-after header', () => {
      const error = new RateLimitError('Too many requests', 60);

      const response = errorHandler.handle(error, mockContext);

      expect(response.statusCode).toBe(429);
      expect(response.headers['Retry-After']).toBe('60');
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle unknown errors as internal errors', () => {
      const error = new Error('Something went wrong');

      const response = errorHandler.handle(error, mockContext);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(body.error.requestId).toBe('test-request-123');
    });

    it('should not expose internal error details for unknown errors', () => {
      const error = new Error('Sensitive internal error message');

      const response = errorHandler.handle(error, mockContext);

      const body = JSON.parse(response.body);
      expect(body.error.message).not.toContain('Sensitive');
      expect(body.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('logError', () => {
    it('should log errors with ERROR level for server errors', () => {
      const error = new InternalError('Server error');

      errorHandler.logError(error, mockContext);

      expect(console.error).toHaveBeenCalled();
      const logCall = (console.error as any).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.error.message).toBe('Server error');
      expect(logEntry.context.requestId).toBe('test-request-123');
    });

    it('should log errors with WARN level for client errors', () => {
      const error = new ValidationError('Invalid input', []);

      errorHandler.logError(error, mockContext);

      expect(console.warn).toHaveBeenCalled();
      const logCall = (console.warn as any).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('WARN');
    });

    it('should log errors with INFO level for rate limit errors', () => {
      const error = new RateLimitError('Too many requests');

      errorHandler.logError(error, mockContext);

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as any).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('INFO');
    });
  });
});

describe('ErrorResponseBuilder', () => {
  it('should build validation error response', () => {
    const response = ErrorResponseBuilder.validationError('Invalid data')
      .withRequestId('req-123')
      .withDetails({ field: 'email' })
      .build();

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid data');
    expect(body.error.requestId).toBe('req-123');
    expect(body.error.details).toEqual({ field: 'email' });
  });

  it('should build authentication error response', () => {
    const response = ErrorResponseBuilder.authenticationError().withRequestId('req-123').build();

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should build rate limit error response', () => {
    const response = ErrorResponseBuilder.rateLimitError().withRequestId('req-123').build();

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should build internal error response', () => {
    const response = ErrorResponseBuilder.internalError().withRequestId('req-123').build();

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('Error Classes', () => {
  it('should create ValidationError with correct properties', () => {
    const error = new ValidationError('Validation failed', [
      { path: ['name'], message: 'Required', code: 'required' },
    ]);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.errors).toHaveLength(1);
  });

  it('should create AuthenticationError with correct properties', () => {
    const error = new AuthenticationError('Invalid token');

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Invalid token');
  });

  it('should create AuthorizationError with correct properties', () => {
    const error = new AuthorizationError('Access denied');

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied');
  });

  it('should create NotFoundError with correct properties', () => {
    const error = new NotFoundError('Resource not found');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
  });

  it('should create RateLimitError with correct properties', () => {
    const error = new RateLimitError('Too many requests', 60);

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.message).toBe('Too many requests');
    expect(error.retryAfter).toBe(60);
  });

  it('should create InternalError with correct properties', () => {
    const error = new InternalError('Server error');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Server error');
  });

  it('should create ServiceUnavailableError with correct properties', () => {
    const error = new ServiceUnavailableError('Service down');

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.message).toBe('Service down');
  });

  it('should create GatewayTimeoutError with correct properties', () => {
    const error = new GatewayTimeoutError('Request timeout');

    expect(error.statusCode).toBe(504);
    expect(error.code).toBe('GATEWAY_TIMEOUT');
    expect(error.message).toBe('Request timeout');
  });
});
