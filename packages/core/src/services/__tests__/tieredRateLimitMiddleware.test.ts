import {
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';
import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { createMockDynamoDBClient } from '../../repository/__tests__/test-utils';
import { RateLimitRepository } from '../../repository/RateLimitRepository';
import { RateLimiter } from '../RateLimiter';
import { tieredRateLimitMiddleware } from '../rateLimitMiddleware';
import { type UserTier } from '../tieredRateLimiting';

describe('tieredRateLimitMiddleware', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let repository: RateLimitRepository;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    repository = new RateLimitRepository(
      'test-rate-limits',
      mockClient as unknown as DynamoDBClient
    );
    rateLimiter = new RateLimiter(repository, {
      capacity: 1000, // High capacity to support premium tier
      refillRate: 10,
      refillInterval: 60,
    });
  });

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

  const mockHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  });

  describe('Tier-based rate limiting', () => {
    it('should apply anonymous tier limits (100 req/min)', async () => {
      const now = Math.floor(Date.now() / 1000);
      let currentTokens = 100;

      mockClient.on(GetItemCommand).callsFake(() => ({
        Item: marshall({
          limitKey: 'ip:192.168.1.1',
          tokens: currentTokens,
          lastRefill: now,
          ttl: now + 3600,
        }),
      }));

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).callsFake(() => {
        if (currentTokens > 0) {
          currentTokens--;
        }
        return {
          Attributes: marshall({
            limitKey: 'ip:192.168.1.1',
            tokens: currentTokens,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      // Make 101 requests (exceeding anonymous limit)
      let successCount = 0;
      let rateLimitedCount = 0;

      for (let i = 0; i < 101; i++) {
        const event = createMockEvent('192.168.1.1');
        const response = await wrappedHandler(event);

        if (response.statusCode === 200) {
          successCount++;
          expect(response.headers?.['X-RateLimit-Tier']).toBe('anonymous');
          expect(response.headers?.['X-RateLimit-Limit']).toBe('100');
        } else if (response.statusCode === 429) {
          rateLimitedCount++;
        }
      }

      expect(successCount).toBeLessThanOrEqual(100);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should apply authenticated tier limits (300 req/min)', async () => {
      const now = Math.floor(Date.now() / 1000);
      let currentTokens = 300;

      mockClient.on(GetItemCommand).callsFake(() => ({
        Item: marshall({
          limitKey: 'user:user123',
          tokens: currentTokens,
          lastRefill: now,
          ttl: now + 3600,
        }),
      }));

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).callsFake(() => {
        if (currentTokens > 0) {
          currentTokens--;
        }
        return {
          Attributes: marshall({
            limitKey: 'user:user123',
            tokens: currentTokens,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      // Make 150 requests (within authenticated limit)
      let successCount = 0;

      for (let i = 0; i < 150; i++) {
        const event = createMockEvent('192.168.1.1', {
          claims: { sub: 'user123', tier: 'authenticated' },
        });
        const response = await wrappedHandler(event);

        if (response.statusCode === 200) {
          successCount++;
          expect(response.headers?.['X-RateLimit-Tier']).toBe('authenticated');
          expect(response.headers?.['X-RateLimit-Limit']).toBe('300');
        }
      }

      expect(successCount).toBe(150);
    });

    it('should apply premium tier limits (1000 req/min)', async () => {
      const now = Math.floor(Date.now() / 1000);
      let currentTokens = 1000;

      mockClient.on(GetItemCommand).callsFake(() => ({
        Item: marshall({
          limitKey: 'user:premium123',
          tokens: currentTokens,
          lastRefill: now,
          ttl: now + 3600,
        }),
      }));

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).callsFake(() => {
        if (currentTokens > 0) {
          currentTokens--;
        }
        return {
          Attributes: marshall({
            limitKey: 'user:premium123',
            tokens: currentTokens,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      // Make 500 requests (within premium limit)
      let successCount = 0;

      for (let i = 0; i < 500; i++) {
        const event = createMockEvent('192.168.1.1', {
          claims: { sub: 'premium123', tier: 'premium' },
        });
        const response = await wrappedHandler(event);

        if (response.statusCode === 200) {
          successCount++;
          expect(response.headers?.['X-RateLimit-Tier']).toBe('premium');
          expect(response.headers?.['X-RateLimit-Limit']).toBe('1000');
        }
      }

      expect(successCount).toBe(500);
    });
  });

  describe('Rate limit key generation', () => {
    it('should use userId for authenticated users', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).callsFake((input) => {
        // Verify the key uses userId, not IP
        expect(input.Key?.limitKey?.S).toContain('user:');
        expect(input.Key?.limitKey?.S).not.toContain('ip:');

        return {
          Item: marshall({
            limitKey: 'user:user123',
            tokens: 300,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: 'user:user123',
          tokens: 299,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      const event = createMockEvent('192.168.1.1', {
        claims: { sub: 'user123' },
      });

      await wrappedHandler(event);
    });

    it('should use IP for anonymous users', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).callsFake((input) => {
        // Verify the key uses IP
        expect(input.Key?.limitKey?.S).toContain('ip:');
        expect(input.Key?.limitKey?.S).not.toContain('user:');

        return {
          Item: marshall({
            limitKey: 'ip:192.168.1.1',
            tokens: 100,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: 'ip:192.168.1.1',
          tokens: 99,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      const event = createMockEvent('192.168.1.1');

      await wrappedHandler(event);
    });
  });

  describe('Rate limit headers', () => {
    it('should include tier information in headers', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: 'user:user123',
          tokens: 300,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: 'user:user123',
          tokens: 299,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      const event = createMockEvent('192.168.1.1', {
        claims: { sub: 'user123', tier: 'authenticated' },
      });

      const response = await wrappedHandler(event);

      expect(response.headers?.['X-RateLimit-Tier']).toBe('authenticated');
      expect(response.headers?.['X-RateLimit-Limit']).toBe('300');
      expect(response.headers?.['X-RateLimit-Remaining']).toBeDefined();
      expect(response.headers?.['X-RateLimit-Reset']).toBeDefined();
    });

    it('should include tier in 429 error response', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: 'ip:192.168.1.1',
          tokens: 0,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = tieredRateLimitMiddleware({ rateLimiter });
      const wrappedHandler = middleware(mockHandler);

      const event = createMockEvent('192.168.1.1');
      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(429);

      const body = JSON.parse(response.body);
      expect(body.error.tier).toBe('anonymous');
      expect(response.headers?.['X-RateLimit-Limit']).toBe('100');
    });
  });

  describe('Property tests for tiered rate limiting', () => {
    it('should enforce tier-specific limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<UserTier>('anonymous', 'authenticated', 'premium'),
          fc.ipV4(),
          fc.string({ minLength: 1 }),
          async (tier, ip, userId) => {
            mockClient.reset();

            const tierLimits = {
              anonymous: 100,
              authenticated: 300,
              premium: 1000,
            };

            const limit = tierLimits[tier];
            const now = Math.floor(Date.now() / 1000);
            let currentTokens = limit;

            mockClient.on(GetItemCommand).callsFake(() => ({
              Item: marshall({
                limitKey: tier === 'anonymous' ? `ip:${ip}` : `user:${userId}`,
                tokens: currentTokens,
                lastRefill: now,
                ttl: now + 3600,
              }),
            }));

            mockClient.on(PutItemCommand).resolves({});
            mockClient.on(UpdateItemCommand).callsFake(() => {
              if (currentTokens > 0) {
                currentTokens--;
              }
              return {
                Attributes: marshall({
                  limitKey: tier === 'anonymous' ? `ip:${ip}` : `user:${userId}`,
                  tokens: currentTokens,
                  lastRefill: now,
                  ttl: now + 3600,
                }),
              };
            });

            const middleware = tieredRateLimitMiddleware({ rateLimiter });
            const wrappedHandler = middleware(mockHandler);

            let successCount = 0;
            const requestCount = Math.min(limit + 10, 150); // Test up to limit + 10

            for (let i = 0; i < requestCount; i++) {
              const event = createMockEvent(
                ip,
                tier === 'anonymous' ? null : { claims: { sub: userId, tier } }
              );
              const response = await wrappedHandler(event);

              if (response.statusCode === 200) {
                successCount++;
                expect(response.headers?.['X-RateLimit-Tier']).toBe(tier);
                expect(response.headers?.['X-RateLimit-Limit']).toBe(limit.toString());
              }
            }

            // Should not exceed the tier limit
            expect(successCount).toBeLessThanOrEqual(limit);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
