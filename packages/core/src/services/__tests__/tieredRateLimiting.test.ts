import { type APIGatewayProxyEvent } from 'aws-lambda';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  extractUserTier,
  extractUserContext,
  getTierRateLimit,
  generateRateLimitKey,
  TIER_RATE_LIMITS,
  type UserTier,
} from '../tieredRateLimiting';

describe('tieredRateLimiting', () => {
  const createMockEvent = (sourceIp: string, authorizer?: any): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: authorizer || null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/test',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp,
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
    },
    resource: '/test',
  });

  describe('extractUserTier', () => {
    it('should return anonymous for events without authorizer', () => {
      const event = createMockEvent('192.168.1.1');
      const tier = extractUserTier(event);
      expect(tier).toBe('anonymous');
    });

    it('should return tier from authorizer claims', () => {
      const tiers: UserTier[] = ['anonymous', 'authenticated', 'premium'];

      tiers.forEach((expectedTier) => {
        const event = createMockEvent('192.168.1.1', {
          claims: { tier: expectedTier, sub: 'user123' },
        });
        const tier = extractUserTier(event);
        expect(tier).toBe(expectedTier);
      });
    });

    it('should return authenticated for events with auth but no tier', () => {
      const event = createMockEvent('192.168.1.1', {
        claims: { sub: 'user123', email: 'test@example.com' },
      });
      const tier = extractUserTier(event);
      expect(tier).toBe('authenticated');
    });

    it('should handle JWT format authorizer', () => {
      const event = createMockEvent('192.168.1.1', {
        jwt: { tier: 'premium', sub: 'user123' },
      });
      const tier = extractUserTier(event);
      expect(tier).toBe('premium');
    });

    it('should ignore invalid tier values', () => {
      const event = createMockEvent('192.168.1.1', {
        claims: { tier: 'invalid-tier', sub: 'user123' },
      });
      const tier = extractUserTier(event);
      expect(tier).toBe('authenticated'); // Falls back to authenticated
    });
  });

  describe('extractUserContext', () => {
    it('should extract full user context for authenticated users', () => {
      const event = createMockEvent('192.168.1.1', {
        claims: {
          tier: 'premium',
          sub: 'user123',
          email: 'test@example.com',
        },
      });

      const context = extractUserContext(event);

      expect(context.tier).toBe('premium');
      expect(context.userId).toBe('user123');
      expect(context.email).toBe('test@example.com');
    });

    it('should return minimal context for anonymous users', () => {
      const event = createMockEvent('192.168.1.1');
      const context = extractUserContext(event);

      expect(context.tier).toBe('anonymous');
      expect(context.userId).toBeUndefined();
      expect(context.email).toBeUndefined();
    });
  });

  describe('getTierRateLimit', () => {
    it('should return correct limits for each tier', () => {
      const anonymousLimit = getTierRateLimit('anonymous');
      expect(anonymousLimit.limit).toBe(100);
      expect(anonymousLimit.window).toBe(60);

      const authenticatedLimit = getTierRateLimit('authenticated');
      expect(authenticatedLimit.limit).toBe(300);
      expect(authenticatedLimit.window).toBe(60);

      const premiumLimit = getTierRateLimit('premium');
      expect(premiumLimit.limit).toBe(1000);
      expect(premiumLimit.window).toBe(60);
    });

    it('should have increasing limits for higher tiers', () => {
      const anonymous = getTierRateLimit('anonymous');
      const authenticated = getTierRateLimit('authenticated');
      const premium = getTierRateLimit('premium');

      expect(authenticated.limit).toBeGreaterThan(anonymous.limit);
      expect(premium.limit).toBeGreaterThan(authenticated.limit);
    });
  });

  describe('generateRateLimitKey', () => {
    it('should use userId for authenticated users', () => {
      const event = createMockEvent('192.168.1.1', {
        claims: { sub: 'user123' },
      });
      const context = extractUserContext(event);
      const key = generateRateLimitKey(event, context);

      expect(key).toBe('user:user123');
    });

    it('should use IP for anonymous users', () => {
      const event = createMockEvent('192.168.1.1');
      const context = extractUserContext(event);
      const key = generateRateLimitKey(event, context);

      expect(key).toBe('ip:192.168.1.1');
    });

    it('should prefer userId over IP when available', () => {
      const event = createMockEvent('192.168.1.1', {
        claims: { sub: 'user456', tier: 'premium' },
      });
      const context = extractUserContext(event);
      const key = generateRateLimitKey(event, context);

      expect(key).toBe('user:user456');
      expect(key).not.toContain('192.168.1.1');
    });
  });

  describe('TIER_RATE_LIMITS constant', () => {
    it('should have all required tiers defined', () => {
      expect(TIER_RATE_LIMITS).toHaveProperty('anonymous');
      expect(TIER_RATE_LIMITS).toHaveProperty('authenticated');
      expect(TIER_RATE_LIMITS).toHaveProperty('premium');
    });

    it('should have valid configuration for each tier', () => {
      Object.values(TIER_RATE_LIMITS).forEach((config) => {
        expect(config.limit).toBeGreaterThan(0);
        expect(config.window).toBeGreaterThan(0);
        expect(Number.isInteger(config.limit)).toBe(true);
        expect(Number.isInteger(config.window)).toBe(true);
      });
    });
  });

  describe('Property tests for tier detection', () => {
    it('should always return a valid tier', () => {
      fc.assert(
        fc.property(
          fc.ipV4(),
          fc.option(
            fc.record({
              sub: fc.string(),
              tier: fc.constantFrom('anonymous', 'authenticated', 'premium', 'invalid'),
            }),
            { nil: null }
          ),
          (ip, authData) => {
            const event = createMockEvent(ip, authData ? { claims: authData } : null);
            const tier = extractUserTier(event);

            // Should always return one of the valid tiers
            expect(['anonymous', 'authenticated', 'premium']).toContain(tier);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent keys for same user', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), fc.ipV4(), (userId, ip) => {
          const event1 = createMockEvent(ip, { claims: { sub: userId } });
          const event2 = createMockEvent(ip, { claims: { sub: userId } });

          const context1 = extractUserContext(event1);
          const context2 = extractUserContext(event2);

          const key1 = generateRateLimitKey(event1, context1);
          const key2 = generateRateLimitKey(event2, context2);

          expect(key1).toBe(key2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for different users', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.ipV4(),
          (userId1, userId2, ip) => {
            fc.pre(userId1 !== userId2); // Only test different users

            const event1 = createMockEvent(ip, { claims: { sub: userId1 } });
            const event2 = createMockEvent(ip, { claims: { sub: userId2 } });

            const context1 = extractUserContext(event1);
            const context2 = extractUserContext(event2);

            const key1 = generateRateLimitKey(event1, context1);
            const key2 = generateRateLimitKey(event2, context2);

            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
