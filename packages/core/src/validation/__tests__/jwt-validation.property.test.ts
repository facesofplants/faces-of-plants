/**
 * Property-Based Tests for JWT Validation
 *
 * Feature: production-readiness
 * Property 12: JWT token validation works correctly
 * Validates: Requirements 7.3
 *
 * These tests validate the JWT token validation logic that will be used
 * in the Next.js middleware for authentication.
 */

import * as fc from 'fast-check';
import { SignJWT, jwtVerify } from 'jose';
import { describe, it, expect } from 'vitest';

// Test secret (same format as AUTH_SECRET)
const TEST_SECRET = 'test-secret-key-for-jwt-validation-minimum-32-characters-long';
const SECRET_KEY = new TextEncoder().encode(TEST_SECRET);

/**
 * Helper: Generate a valid JWT token
 */
async function generateValidToken(payload: {
  sub: string;
  email: string;
  name: string;
  userType?: string;
  exp?: number;
}): Promise<string> {
  const jwt = new SignJWT({
    ...payload,
    user: {
      userType: payload.userType || 'citizen',
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(payload.exp || Math.floor(Date.now() / 1000) + 3600);

  return await jwt.sign(SECRET_KEY);
}

/**
 * Helper: Validate a JWT token
 */
async function validateToken(
  token: string
): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

describe('JWT Validation - Property Tests', () => {
  /**
   * Property 12: JWT token validation works correctly
   *
   * For any valid token payload, the generated token should:
   * 1. Be verifiable with the correct secret
   * 2. Contain the original payload data
   * 3. Not be verifiable with a tampered signature
   *
   * **Validates: Requirements 7.3**
   */
  it('Property 12: valid tokens are accepted and invalid tokens are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.uuid(),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          userType: fc.constantFrom('citizen', 'researcher', 'admin'),
        }),
        async (payload) => {
          // Generate a valid token
          const validToken = await generateValidToken(payload);

          // Valid token should be accepted
          const validResult = await validateToken(validToken);
          expect(validResult.valid).toBe(true);
          expect(validResult.payload?.sub).toBe(payload.sub);
          expect(validResult.payload?.email).toBe(payload.email);

          // Tampered token should be rejected
          const tamperedToken = `${validToken}tampered`;
          const tamperedResult = await validateToken(tamperedToken);
          expect(tamperedResult.valid).toBe(false);

          // Token with wrong signature should be rejected
          const parts = validToken.split('.');
          if (parts.length === 3) {
            const wrongSignature = `${parts[0]}.${parts[1]}.wrongsignature`;
            const wrongResult = await validateToken(wrongSignature);
            expect(wrongResult.valid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Expired tokens are rejected
   *
   * For any token with an expiration time in the past,
   * validation should fail.
   */
  it('expired tokens are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.uuid(),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          userType: fc.constantFrom('citizen', 'researcher', 'admin'),
        }),
        async (payload) => {
          // Generate token that expired 1 hour ago
          const expiredTime = Math.floor(Date.now() / 1000) - 3600;
          const expiredToken = await generateValidToken({
            ...payload,
            exp: expiredTime,
          });

          // Expired token should be rejected
          const result = await validateToken(expiredToken);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('exp');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Token payload integrity
   *
   * For any valid token, the decoded payload should exactly match
   * the original data that was encoded.
   */
  it('token payload integrity is maintained', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.uuid(),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          userType: fc.constantFrom('citizen', 'researcher', 'admin'),
        }),
        async (payload) => {
          const token = await generateValidToken(payload);
          const result = await validateToken(token);

          expect(result.valid).toBe(true);
          expect(result.payload?.sub).toBe(payload.sub);
          expect(result.payload?.email).toBe(payload.email);
          expect(result.payload?.name).toBe(payload.name);
          expect(result.payload?.user?.userType).toBe(payload.userType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Malformed tokens are rejected
   *
   * For any string that is not a valid JWT format,
   * validation should fail gracefully.
   */
  it('malformed tokens are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('not.a.jwt'),
          fc.constant('only-one-part'),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constant('a.b'), // Only 2 parts
          fc.constant('a.b.c.d') // Too many parts
        ),
        async (malformedToken) => {
          const result = await validateToken(malformedToken);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User type validation
   *
   * For any valid token, the user type should be one of the
   * allowed values and should be correctly extracted.
   */
  it('user type is correctly validated and extracted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub: fc.uuid(),
          email: fc.emailAddress(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          userType: fc.constantFrom('citizen', 'researcher', 'admin'),
        }),
        async (payload) => {
          const token = await generateValidToken(payload);
          const result = await validateToken(token);

          expect(result.valid).toBe(true);
          const userType = result.payload?.user?.userType;
          expect(userType).toBe(payload.userType);
          expect(['citizen', 'researcher', 'admin']).toContain(userType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
