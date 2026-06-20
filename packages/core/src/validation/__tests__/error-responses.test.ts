import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { ValidationError, formatErrorResponse } from '../errors';

describe('Error Response Property Tests', () => {
  /**
   * Feature: production-readiness, Property 9: Error responses have consistent structure
   * Validates: Requirements 5.1
   */
  describe('Property 9: Error responses have consistent structure', () => {
    it('should return consistent structure for ValidationError', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              path: fc.array(fc.string()),
              message: fc.string({ minLength: 1 }),
              code: fc.string({ minLength: 1 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (errors) => {
            const validationError = new ValidationError('Validation failed', errors);
            const json = validationError.toJSON();

            // Check consistent structure
            expect(json).toHaveProperty('error');
            expect(json.error).toHaveProperty('code');
            expect(json.error).toHaveProperty('message');
            expect(json.error).toHaveProperty('details');

            // Verify types
            expect(typeof json.error.code).toBe('string');
            expect(typeof json.error.message).toBe('string');
            expect(Array.isArray(json.error.details)).toBe(true);

            // Verify code is correct
            expect(json.error.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create ValidationError from ZodError with consistent structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            query: fc.string().filter((s) => s.length === 0 || s.length > 500), // Invalid
            userType: fc.string().filter((s) => s !== 'citizen' && s !== 'researcher'), // Invalid
          }),
          (invalidData) => {
            const schema = z.object({
              query: z.string().min(1).max(500),
              userType: z.enum(['citizen', 'researcher']),
            });

            try {
              schema.parse(invalidData);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const validationError = ValidationError.fromZodError(error);
                const json = validationError.toJSON();

                // Check consistent structure
                expect(json).toHaveProperty('error');
                expect(json.error).toHaveProperty('code');
                expect(json.error).toHaveProperty('message');
                expect(json.error).toHaveProperty('details');

                // Verify error details structure
                expect(Array.isArray(json.error.details)).toBe(true);
                json.error.details.forEach((detail: any) => {
                  expect(detail).toHaveProperty('path');
                  expect(detail).toHaveProperty('message');
                  expect(detail).toHaveProperty('code');
                  expect(Array.isArray(detail.path)).toBe(true);
                });
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format error responses with consistent structure', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // error code
          fc.string({ minLength: 1 }), // error message
          fc.option(
            fc.oneof(
              fc.array(
                fc.record({
                  path: fc.array(fc.string()),
                  message: fc.string(),
                  code: fc.string(),
                })
              ),
              fc.dictionary(fc.string(), fc.anything())
            ),
            { nil: undefined }
          ), // details
          fc.option(fc.string(), { nil: undefined }), // requestId
          (code, message, details, requestId) => {
            const errorResponse = formatErrorResponse(code, message, details, requestId);

            // Check consistent structure
            expect(errorResponse).toHaveProperty('error');
            expect(errorResponse.error).toHaveProperty('code');
            expect(errorResponse.error).toHaveProperty('message');

            // Verify values
            expect(errorResponse.error.code).toBe(code);
            expect(errorResponse.error.message).toBe(message);

            // Check optional fields
            if (details !== undefined) {
              expect(errorResponse.error).toHaveProperty('details');
            }
            // requestId is only included if it's truthy (not empty string, null, undefined)
            if (requestId) {
              expect(errorResponse.error).toHaveProperty('requestId');
              expect(errorResponse.error.requestId).toBe(requestId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent structure across different error types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'NOT_FOUND',
            'RATE_LIMIT_EXCEEDED',
            'INTERNAL_ERROR',
            'SERVICE_UNAVAILABLE',
            'GATEWAY_TIMEOUT'
          ),
          fc.string({ minLength: 1 }),
          fc.option(fc.string(), { nil: undefined }),
          (errorCode, message, requestId) => {
            const errorResponse = formatErrorResponse(errorCode, message, undefined, requestId);

            // All error types should have the same structure
            expect(errorResponse).toHaveProperty('error');
            expect(errorResponse.error).toHaveProperty('code');
            expect(errorResponse.error).toHaveProperty('message');
            expect(typeof errorResponse.error.code).toBe('string');
            expect(typeof errorResponse.error.message).toBe('string');

            if (requestId) {
              expect(errorResponse.error).toHaveProperty('requestId');
              expect(typeof errorResponse.error.requestId).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve error details in consistent format', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              path: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
              message: fc.string({ minLength: 1 }),
              code: fc.string({ minLength: 1 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (errorDetails) => {
            const validationError = new ValidationError('Test error', errorDetails);
            const json = validationError.toJSON();

            // Verify details are preserved
            expect(json.error.details).toHaveLength(errorDetails.length);

            // Check each detail maintains structure
            json.error.details.forEach((detail: any, index: number) => {
              expect(detail.path).toEqual(errorDetails[index].path);
              expect(detail.message).toBe(errorDetails[index].message);
              expect(detail.code).toBe(errorDetails[index].code);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always include required fields in error response', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (code, message) => {
          const errorResponse = formatErrorResponse(code, message);

          // Required fields must always be present
          expect(errorResponse.error.code).toBeDefined();
          expect(errorResponse.error.message).toBeDefined();
          expect(errorResponse.error.code).toBe(code);
          expect(errorResponse.error.message).toBe(message);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ValidationError properties', () => {
    it('should have correct statusCode', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              path: fc.array(fc.string()),
              message: fc.string(),
              code: fc.string(),
            })
          ),
          (errors) => {
            const validationError = new ValidationError('Test', errors);
            expect(validationError.statusCode).toBe(400);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct error code', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              path: fc.array(fc.string()),
              message: fc.string(),
              code: fc.string(),
            })
          ),
          (errors) => {
            const validationError = new ValidationError('Test', errors);
            expect(validationError.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
