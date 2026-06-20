import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { validate } from '../middleware';
import {
  queryRequestSchema,
  userRegistrationSchema,
  userLoginSchema,
  createCollectionSchema,
  paginationSchema,
  authTokenSchema,
} from '../schemas';

describe('Input Validation Property Tests', () => {
  /**
   * Feature: production-readiness, Property 1: Input validation rejects invalid requests
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 1: Input validation rejects invalid requests', () => {
    it('should reject query requests with empty query string', () => {
      fc.assert(
        fc.property(
          fc.record({
            query: fc.constant(''), // Invalid: empty string
            userType: fc.constantFrom('citizen', 'researcher'),
          }),
          (invalidInput) => {
            const result = validate(queryRequestSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject query requests with excessively long query strings', () => {
      fc.assert(
        fc.property(
          fc.record({
            query: fc.string({ minLength: 501, maxLength: 1000 }), // Invalid: too long
            userType: fc.constantFrom('citizen', 'researcher'),
          }),
          (invalidInput) => {
            const result = validate(queryRequestSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with negative offset', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 1, max: 300 }),
            offset: fc.integer({ min: -1000, max: -1 }), // Invalid: negative
          }),
          (invalidInput) => {
            const result = validate(paginationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with limit exceeding maximum', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 301, max: 1000 }), // Invalid: too large
            offset: fc.integer({ min: 0, max: 100 }),
          }),
          (invalidInput) => {
            const result = validate(paginationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pagination with limit less than 1', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: -100, max: 0 }), // Invalid: zero or negative
            offset: fc.integer({ min: 0, max: 100 }),
          }),
          (invalidInput) => {
            const result = validate(paginationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user registration with invalid email', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.string().filter((s) => !s.includes('@')), // Invalid: no @ symbol
            password: fc.constant('ValidPass123'),
          }),
          (invalidInput) => {
            const result = validate(userRegistrationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user registration with weak password (no uppercase)', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.constant('test@example.com'),
            password: fc
              .string({ minLength: 8, maxLength: 20 })
              .filter((s) => /^[a-z0-9]+$/.test(s)), // Invalid: no uppercase
          }),
          (invalidInput) => {
            const result = validate(userRegistrationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user registration with weak password (no lowercase)', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.constant('test@example.com'),
            password: fc
              .string({ minLength: 8, maxLength: 20 })
              .map((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '0'))
              .filter((s) => s.length >= 8 && /^[A-Z0-9]+$/.test(s)), // Invalid: no lowercase
          }),
          (invalidInput) => {
            const result = validate(userRegistrationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user registration with weak password (no number)', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.constant('test@example.com'),
            password: fc
              .string({ minLength: 8, maxLength: 20 })
              .filter((s) => /^[A-Za-z]+$/.test(s)), // Invalid: no number
          }),
          (invalidInput) => {
            const result = validate(userRegistrationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user registration with short password', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.constant('test@example.com'),
            password: fc.string({ minLength: 1, maxLength: 7 }), // Invalid: too short
          }),
          (invalidInput) => {
            const result = validate(userRegistrationSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject user login with invalid email', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.string().filter((s) => !s.includes('@')), // Invalid: no @ symbol
            password: fc.string({ minLength: 1 }),
          }),
          (invalidInput) => {
            const result = validate(userLoginSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject collection creation with empty name', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.string({ minLength: 1 }),
            name: fc.constant(''), // Invalid: empty name
            description: fc.string(),
          }),
          (invalidInput) => {
            const result = validate(createCollectionSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject collection creation with missing userId', () => {
      fc.assert(
        fc.property(
          fc.record({
            userId: fc.constant(''), // Invalid: empty userId
            name: fc.string({ minLength: 1 }),
            description: fc.string(),
          }),
          (invalidInput) => {
            const result = validate(createCollectionSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject auth token with empty token string', () => {
      fc.assert(
        fc.property(
          fc.record({
            token: fc.constant(''), // Invalid: empty token
            type: fc.constantFrom('Bearer', 'JWT'),
          }),
          (invalidInput) => {
            const result = validate(authTokenSchema, invalidInput);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Valid inputs should pass validation', () => {
    it('should accept valid query requests', () => {
      fc.assert(
        fc.property(
          fc.record({
            query: fc.string({ minLength: 1, maxLength: 500 }),
            userType: fc.constantFrom('citizen', 'researcher'),
            filters: fc.record({
              country: fc.option(fc.string(), { nil: undefined }),
              scientificName: fc.option(fc.string(), { nil: undefined }),
            }),
            pagination: fc.record({
              limit: fc.integer({ min: 1, max: 300 }),
              offset: fc.integer({ min: 0, max: 10000 }),
            }),
          }),
          (validInput) => {
            const result = validate(queryRequestSchema, validInput);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid user registration', () => {
      fc.assert(
        fc.property(
          fc.record({
            email: fc.emailAddress().filter((email) => {
              // Filter out emails with special characters that might fail validation
              const localPart = email.split('@')[0];
              return /^[a-zA-Z0-9._-]+$/.test(localPart);
            }),
            password: fc.constant('ValidPass123'), // Valid password
            name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            userType: fc.constantFrom('citizen', 'researcher'),
          }),
          (validInput) => {
            const result = validate(userRegistrationSchema, validInput);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid pagination', () => {
      fc.assert(
        fc.property(
          fc.record({
            limit: fc.integer({ min: 1, max: 300 }),
            offset: fc.integer({ min: 0, max: 100000 }),
          }),
          (validInput) => {
            const result = validate(paginationSchema, validInput);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
