import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  type ValidationErrorDetail,
} from '../../validation/errors';
import { ErrorHandler, ErrorContext } from '../ErrorHandler';

/**
 * Feature: production-readiness, Property 9: Error responses have consistent structure
 * Validates: Requirements 5.1
 */
describe('ErrorHandler - Property-Based Tests', () => {
  const errorHandler = new ErrorHandler();

  // Arbitrary for generating error context
  const errorContextArbitrary = fc.record({
    requestId: fc.uuid(),
    userId: fc.option(fc.uuid(), { nil: undefined }),
    path: fc.constantFrom('/api/query', '/api/auth', '/api/cache', '/api/species'),
    method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
  });

  // Arbitrary for generating validation error details
  const validationErrorDetailArbitrary = fc.array(
    fc.record({
      path: fc.array(fc.string()),
      message: fc.string(),
      code: fc.string(),
    }),
    { minLength: 1, maxLength: 5 }
  );

  // Arbitrary for generating different error types
  const appErrorArbitrary = fc.oneof(
    fc
      .tuple(validationErrorDetailArbitrary)
      .map(([details]) => new ValidationError('Validation failed', details)),
    fc.constant(new AuthenticationError('Authentication required')),
    fc.constant(new AuthenticationError('Invalid token')),
    fc.constant(new AuthorizationError('Access denied')),
    fc.constant(new AuthorizationError('Insufficient permissions')),
    fc.constant(new NotFoundError('Resource not found')),
    fc.constant(new NotFoundError('User not found')),
    fc
      .tuple(fc.integer({ min: 1, max: 300 }))
      .map(([retryAfter]) => new RateLimitError('Too many requests', retryAfter)),
    fc.constant(new InternalError('Internal server error')),
    fc.constant(new ServiceUnavailableError('Service unavailable')),
    fc.constant(new GatewayTimeoutError('Request timeout'))
  );

  it('Property 9: all error responses have consistent structure with required fields', () => {
    fc.assert(
      fc.property(appErrorArbitrary, errorContextArbitrary, (error, context) => {
        const response = errorHandler.handle(error, context);

        // Parse response body
        const body = JSON.parse(response.body);

        // All responses must have error object
        expect(body).toHaveProperty('error');
        expect(body.error).toBeDefined();

        // All error objects must have code, message, and requestId
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body.error).toHaveProperty('requestId');

        // Code must be a non-empty string
        expect(typeof body.error.code).toBe('string');
        expect(body.error.code.length).toBeGreaterThan(0);

        // Message must be a non-empty string
        expect(typeof body.error.message).toBe('string');
        expect(body.error.message.length).toBeGreaterThan(0);

        // RequestId must match the context requestId
        expect(body.error.requestId).toBe(context.requestId);

        // Response must have appropriate status code
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        expect(response.statusCode).toBeLessThan(600);

        // Response must have Content-Type header
        expect(response.headers).toHaveProperty('Content-Type');
        expect(response.headers['Content-Type']).toBe('application/json');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: validation errors include details field', () => {
    fc.assert(
      fc.property(
        validationErrorDetailArbitrary,
        errorContextArbitrary,
        (errorDetails, context) => {
          const error = new ValidationError('Validation failed', errorDetails);
          const response = errorHandler.handle(error, context);

          const body = JSON.parse(response.body);

          // Validation errors must have details
          expect(body.error).toHaveProperty('details');
          expect(Array.isArray(body.error.details)).toBe(true);
          expect(body.error.details.length).toBeGreaterThan(0);

          // Each detail must have path, message, and code
          body.error.details.forEach((detail: ValidationErrorDetail) => {
            expect(detail).toHaveProperty('path');
            expect(detail).toHaveProperty('message');
            expect(detail).toHaveProperty('code');
            expect(Array.isArray(detail.path)).toBe(true);
            expect(typeof detail.message).toBe('string');
            expect(typeof detail.code).toBe('string');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: rate limit errors include retry-after header when specified', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        errorContextArbitrary,
        (retryAfter, context) => {
          const error = new RateLimitError('Too many requests', retryAfter);
          const response = errorHandler.handle(error, context);

          // Rate limit errors must have Retry-After header
          expect(response.headers).toHaveProperty('Retry-After');
          expect(response.headers['Retry-After']).toBe(String(retryAfter));

          // Status code must be 429
          expect(response.statusCode).toBe(429);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: error responses are valid JSON', () => {
    fc.assert(
      fc.property(appErrorArbitrary, errorContextArbitrary, (error, context) => {
        const response = errorHandler.handle(error, context);

        // Response body must be valid JSON
        expect(() => JSON.parse(response.body)).not.toThrow();

        const body = JSON.parse(response.body);

        // Must be an object
        expect(typeof body).toBe('object');
        expect(body).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: error codes match expected patterns', () => {
    fc.assert(
      fc.property(appErrorArbitrary, errorContextArbitrary, (error, context) => {
        const response = errorHandler.handle(error, context);
        const body = JSON.parse(response.body);

        // Error codes should be uppercase with underscores
        expect(body.error.code).toMatch(/^[A-Z_]+$/);

        // Error codes should match known patterns
        const validCodes = [
          'VALIDATION_ERROR',
          'UNAUTHORIZED',
          'FORBIDDEN',
          'NOT_FOUND',
          'RATE_LIMIT_EXCEEDED',
          'INTERNAL_ERROR',
          'SERVICE_UNAVAILABLE',
          'GATEWAY_TIMEOUT',
        ];

        expect(validCodes).toContain(body.error.code);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: status codes match error types', () => {
    fc.assert(
      fc.property(appErrorArbitrary, errorContextArbitrary, (error, context) => {
        const response = errorHandler.handle(error, context);

        // Verify status code matches error type
        if (error instanceof ValidationError) {
          expect(response.statusCode).toBe(400);
        } else if (error instanceof AuthenticationError) {
          expect(response.statusCode).toBe(401);
        } else if (error instanceof AuthorizationError) {
          expect(response.statusCode).toBe(403);
        } else if (error instanceof NotFoundError) {
          expect(response.statusCode).toBe(404);
        } else if (error instanceof RateLimitError) {
          expect(response.statusCode).toBe(429);
        } else if (error instanceof InternalError) {
          expect(response.statusCode).toBe(500);
        } else if (error instanceof ServiceUnavailableError) {
          expect(response.statusCode).toBe(503);
        } else if (error instanceof GatewayTimeoutError) {
          expect(response.statusCode).toBe(504);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: production-readiness, Property 10: Unhandled exceptions return 500
   * Validates: Requirements 5.5
   */
  describe('Unhandled Exceptions', () => {
    // Arbitrary for generating various unhandled error types
    const unhandledErrorArbitrary = fc.oneof(
      fc.string().map((msg) => new Error(msg)),
      fc.string().map((msg) => new TypeError(msg)),
      fc.string().map((msg) => new ReferenceError(msg)),
      fc.string().map((msg) => new RangeError(msg)),
      fc.string().map((msg) => new SyntaxError(msg)),
      fc
        .record({
          message: fc.string(),
          code: fc.string(),
        })
        .map((obj) => {
          const err = new Error(obj.message);
          (err as any).code = obj.code;
          return err;
        })
    );

    it('Property 10: all unhandled exceptions return 500 status code', () => {
      fc.assert(
        fc.property(unhandledErrorArbitrary, errorContextArbitrary, (error, context) => {
          const response = errorHandler.handle(error, context);

          // Unhandled exceptions must return 500
          expect(response.statusCode).toBe(500);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 10: unhandled exceptions have consistent error structure', () => {
      fc.assert(
        fc.property(unhandledErrorArbitrary, errorContextArbitrary, (error, context) => {
          const response = errorHandler.handle(error, context);
          const body = JSON.parse(response.body);

          // Must have error object with required fields
          expect(body).toHaveProperty('error');
          expect(body.error).toHaveProperty('code');
          expect(body.error).toHaveProperty('message');
          expect(body.error).toHaveProperty('requestId');

          // Code must be INTERNAL_ERROR
          expect(body.error.code).toBe('INTERNAL_ERROR');

          // Message should be generic (not expose internal details)
          expect(body.error.message).toBe('An unexpected error occurred');

          // RequestId must match context
          expect(body.error.requestId).toBe(context.requestId);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 10: unhandled exceptions do not expose internal error details', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10 }).map((msg) => new Error(msg)),
          errorContextArbitrary,
          (error, context) => {
            const response = errorHandler.handle(error, context);
            const body = JSON.parse(response.body);

            // Original error message should not be exposed
            expect(body.error.message).not.toBe(error.message);

            // Stack trace should not be in response
            expect(body.error).not.toHaveProperty('stack');

            // Generic message should be used
            expect(body.error.message).toBe('An unexpected error occurred');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 10: unhandled exceptions include requestId for tracing', () => {
      fc.assert(
        fc.property(unhandledErrorArbitrary, errorContextArbitrary, (error, context) => {
          const response = errorHandler.handle(error, context);
          const body = JSON.parse(response.body);

          // RequestId must be present and match context
          expect(body.error.requestId).toBeDefined();
          expect(body.error.requestId).toBe(context.requestId);
          expect(typeof body.error.requestId).toBe('string');
          expect(body.error.requestId.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('Property 10: unhandled exceptions return valid JSON', () => {
      fc.assert(
        fc.property(unhandledErrorArbitrary, errorContextArbitrary, (error, context) => {
          const response = errorHandler.handle(error, context);

          // Response must be valid JSON
          expect(() => JSON.parse(response.body)).not.toThrow();

          const body = JSON.parse(response.body);
          expect(typeof body).toBe('object');
          expect(body).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });
});
