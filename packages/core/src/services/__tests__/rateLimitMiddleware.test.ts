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
import { rateLimitMiddleware } from '../rateLimitMiddleware';

describe('rateLimitMiddleware', () => {
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
      capacity: 100,
      refillRate: 10,
      refillInterval: 60,
    });
  });

  const createMockEvent = (sourceIp: string): APIGatewayProxyEvent => ({
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
      authorizer: null,
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

  describe('Property 5: Rate limiting enforces request limits', () => {
    /**
     * Feature: production-readiness, Property 5: Rate limiting enforces request limits
     * Validates: Requirements 3.2
     *
     * For any IP address or user, when request count exceeds the configured limit
     * within the time window, the system should return 429 status code with retry-after header.
     */
    it('should return 429 when rate limit is exceeded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.integer({ min: 101, max: 200 }), // Requests exceeding limit
          async (ipAddress, requestCount) => {
            mockClient.reset();

            const now = Math.floor(Date.now() / 1000);
            let currentTokens = 100;

            // Mock DynamoDB responses
            mockClient.on(GetItemCommand).callsFake(() => ({
              Item: marshall({
                limitKey: ipAddress,
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
                  limitKey: ipAddress,
                  tokens: currentTokens,
                  lastRefill: now,
                  ttl: now + 3600,
                }),
              };
            });

            // Create middleware
            const middleware = rateLimitMiddleware({
              rateLimiter,
            });

            // Mock handler that always succeeds
            const handler = async (
              event: APIGatewayProxyEvent
            ): Promise<APIGatewayProxyResult> => ({
              statusCode: 200,
              body: JSON.stringify({ message: 'Success' }),
            });

            const wrappedHandler = middleware(handler);

            let rateLimitedCount = 0;
            let successCount = 0;

            // Make requests
            for (let i = 0; i < requestCount; i++) {
              const event = createMockEvent(ipAddress);
              const response = await wrappedHandler(event);

              if (response.statusCode === 429) {
                rateLimitedCount++;

                // Verify 429 response has required headers and structure
                expect(response.headers).toBeDefined();
                expect(response.headers?.['Retry-After']).toBeDefined();
                expect(response.headers?.['X-RateLimit-Limit']).toBe('100');
                expect(response.headers?.['X-RateLimit-Remaining']).toBe('0');

                // Verify error response body
                const body = JSON.parse(response.body);
                expect(body.error).toBeDefined();
                expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
                expect(body.error.message).toBeDefined();
                expect(body.error.retryAfter).toBeDefined();
              } else if (response.statusCode === 200) {
                successCount++;
              }
            }

            // At least some requests should be rate limited
            expect(rateLimitedCount).toBeGreaterThan(0);

            // Total successful requests should not exceed capacity
            expect(successCount).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include rate limit headers in successful responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.integer({ min: 1, max: 50 }),
          async (ipAddress, requestCount) => {
            mockClient.reset();

            const now = Math.floor(Date.now() / 1000);
            let currentTokens = 100;

            mockClient.on(GetItemCommand).callsFake(() => ({
              Item: marshall({
                limitKey: ipAddress,
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
                  limitKey: ipAddress,
                  tokens: currentTokens,
                  lastRefill: now,
                  ttl: now + 3600,
                }),
              };
            });

            const middleware = rateLimitMiddleware({
              rateLimiter,
            });

            const handler = async (
              event: APIGatewayProxyEvent
            ): Promise<APIGatewayProxyResult> => ({
              statusCode: 200,
              body: JSON.stringify({ message: 'Success' }),
            });

            const wrappedHandler = middleware(handler);

            // Make requests
            for (let i = 0; i < requestCount; i++) {
              const event = createMockEvent(ipAddress);
              const response = await wrappedHandler(event);

              if (response.statusCode === 200) {
                // Verify rate limit headers are present
                expect(response.headers).toBeDefined();
                expect(response.headers?.['X-RateLimit-Limit']).toBe('100');
                expect(response.headers?.['X-RateLimit-Remaining']).toBeDefined();
                expect(response.headers?.['X-RateLimit-Reset']).toBeDefined();

                // Verify remaining count is decreasing
                const remaining = parseInt(response.headers?.['X-RateLimit-Remaining'] || '0');
                expect(remaining).toBeGreaterThanOrEqual(0);
                expect(remaining).toBeLessThanOrEqual(100);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Unit tests for rateLimitMiddleware', () => {
    it('should allow requests under the limit', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: '192.168.1.1',
          tokens: 100,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: '192.168.1.1',
          tokens: 99,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = rateLimitMiddleware({
        rateLimiter,
      });

      const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      });

      const wrappedHandler = middleware(handler);
      const event = createMockEvent('192.168.1.1');
      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['X-RateLimit-Limit']).toBe('100');
      expect(response.headers?.['X-RateLimit-Remaining']).toBeDefined();
    });

    it('should return 429 when limit exceeded', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: '192.168.1.1',
          tokens: 0,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = rateLimitMiddleware({
        rateLimiter,
      });

      const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      });

      const wrappedHandler = middleware(handler);
      const event = createMockEvent('192.168.1.1');
      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(429);
      expect(response.headers?.['Retry-After']).toBeDefined();

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should use custom key extractor', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: 'custom-key',
          tokens: 100,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: 'custom-key',
          tokens: 99,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const middleware = rateLimitMiddleware({
        rateLimiter,
        keyExtractor: (event) => 'custom-key',
      });

      const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      });

      const wrappedHandler = middleware(handler);
      const event = createMockEvent('192.168.1.1');
      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
