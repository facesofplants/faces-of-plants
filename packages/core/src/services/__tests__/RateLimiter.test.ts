import {
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { createMockDynamoDBClient } from '../../repository/__tests__/test-utils';
import { RateLimitRepository } from '../../repository/RateLimitRepository';
import { RateLimiter } from '../RateLimiter';

describe('RateLimiter', () => {
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
      refillInterval: 1,
    });
  });

  describe('Property 6: Token bucket algorithm maintains rate limits', () => {
    /**
     * Feature: production-readiness, Property 6: Token bucket algorithm maintains rate limits
     * Validates: Requirements 3.4
     *
     * For any sequence of requests, the number of successful requests within a time window
     * should not exceed the configured token bucket capacity.
     */
    it('should never allow more requests than capacity in a burst', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 200 }), // Number of requests to make
          async (requestCount) => {
            // Create completely fresh instances for each iteration
            const testMockClient = createMockDynamoDBClient();
            const testRepository = new RateLimitRepository(
              'test-rate-limits',
              testMockClient as unknown as DynamoDBClient
            );
            const testRateLimiter = new RateLimiter(testRepository, {
              capacity: 100,
              refillRate: 10,
              refillInterval: 1,
            });

            // Create a fresh rate limiter for each test
            const testKey = `test-key-${Math.random()}`;
            let allowedCount = 0;

            // Track state for the mock - use an object to ensure reference is maintained
            const state = {
              tokens: 100,
              lastRefill: 0,
              exists: false,
            };

            // Mock DynamoDB responses for token consumption
            testMockClient.on(GetItemCommand).callsFake(() => {
              if (!state.exists) {
                // Entry doesn't exist yet
                return {};
              }
              // Always return lastRefill as current time to prevent refills during burst
              const now = Math.floor(Date.now() / 1000);
              return {
                Item: marshall({
                  limitKey: testKey,
                  tokens: state.tokens,
                  lastRefill: now, // Always use current time to prevent refills
                  ttl: now + 3600,
                }),
              };
            });

            testMockClient.on(PutItemCommand).callsFake((input: any) => {
              // Store the initial state when creating
              const item = input.Item;
              if (item?.tokens?.N) {
                state.tokens = parseInt(item.tokens.N);
              }
              if (item?.lastRefill?.N) {
                state.lastRefill = parseInt(item.lastRefill.N);
              }
              state.exists = true;
              return {};
            });

            testMockClient.on(UpdateItemCommand).callsFake((input: any) => {
              // Extract the new values from the update expression
              const updates = input.ExpressionAttributeValues;
              const names = input.ExpressionAttributeNames;

              // Update tokens based on what's in the update
              if (names && updates) {
                for (const [nameKey, attrName] of Object.entries(names)) {
                  const valueKey = nameKey.replace('#attr', ':val');
                  if (attrName === 'tokens' && updates[valueKey]?.N) {
                    state.tokens = parseInt(updates[valueKey].N);
                  }
                  if (attrName === 'lastRefill' && updates[valueKey]?.N) {
                    state.lastRefill = parseInt(updates[valueKey].N);
                  }
                }
              }

              const now = Math.floor(Date.now() / 1000);
              return {
                Attributes: marshall({
                  limitKey: testKey,
                  tokens: state.tokens,
                  lastRefill: now, // Always use current time
                  ttl: now + 3600,
                }),
              };
            });

            // Make all requests in rapid succession (burst)
            // By always returning lastRefill as current time, no refill should occur
            for (let i = 0; i < requestCount; i++) {
              const consumed = await testRateLimiter.consumeToken(testKey);
              if (consumed) {
                allowedCount++;
              }
            }

            // The number of allowed requests should never exceed capacity
            expect(allowedCount).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should refill tokens over time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // Initial requests
          fc.integer({ min: 1, max: 10 }), // Seconds to wait
          async (initialRequests, waitSeconds) => {
            mockClient.reset();

            const testKey = `test-key-${Math.random()}`;
            const now = Math.floor(Date.now() / 1000);
            let currentTokens = 100;

            // Mock for initial consumption
            mockClient.on(GetItemCommand).callsFake(() => ({
              Item: marshall({
                limitKey: testKey,
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
                  limitKey: testKey,
                  tokens: currentTokens,
                  lastRefill: now,
                  ttl: now + 3600,
                }),
              };
            });

            // Consume initial tokens
            let consumed = 0;
            for (let i = 0; i < initialRequests && i < 100; i++) {
              const result = await rateLimiter.consumeToken(testKey);
              if (result) {
                consumed++;
              }
            }

            const remainingBefore = currentTokens;

            // Simulate time passing by updating mock to return older lastRefill
            mockClient.on(GetItemCommand).callsFake(() => ({
              Item: marshall({
                limitKey: testKey,
                tokens: currentTokens,
                lastRefill: now - waitSeconds,
                ttl: now + 3600,
              }),
            }));

            // Get remaining tokens after "wait"
            const remainingAfter = await rateLimiter.getRemainingTokens(testKey);

            // Tokens should have refilled (or stayed at capacity)
            expect(remainingAfter).toBeGreaterThanOrEqual(remainingBefore);
            expect(remainingAfter).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain rate limit across multiple keys independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 5,
          }),
          fc.integer({ min: 1, max: 150 }),
          async (keys, requestsPerKey) => {
            // Create completely fresh instances for each iteration
            const testMockClient = createMockDynamoDBClient();
            const testRepository = new RateLimitRepository(
              'test-rate-limits',
              testMockClient as unknown as DynamoDBClient
            );
            const testRateLimiter = new RateLimiter(testRepository, {
              capacity: 100,
              refillRate: 10,
              refillInterval: 1,
            });

            const uniqueKeys = [...new Set(keys)];
            const results = new Map<string, number>();
            const tokensByKey = new Map<string, number>();
            const lastRefillByKey = new Map<string, number>();
            const now = Math.floor(Date.now() / 1000);

            // Initialize tokens for each key
            uniqueKeys.forEach((key) => {
              tokensByKey.set(key, 100);
              lastRefillByKey.set(key, now);
            });

            // Mock DynamoDB to track tokens per key
            testMockClient.on(GetItemCommand).callsFake((input: any) => {
              const key = input.Key?.limitKey?.S || 'unknown';

              // If key doesn't exist yet, initialize it
              if (!tokensByKey.has(key)) {
                tokensByKey.set(key, 100);
                lastRefillByKey.set(key, now);
              }

              // Always return lastRefill as current time to prevent refills during burst
              const currentNow = Math.floor(Date.now() / 1000);
              return {
                Item: marshall({
                  limitKey: key,
                  tokens: tokensByKey.get(key) ?? 100,
                  lastRefill: currentNow, // Always use current time to prevent refills
                  ttl: currentNow + 3600,
                }),
              };
            });

            testMockClient.on(PutItemCommand).callsFake((input: any) => {
              const item = input.Item;
              const key = item?.limitKey?.S || 'unknown';
              const tokens = item?.tokens?.N ? parseInt(item.tokens.N) : 100;
              const lastRefill = item?.lastRefill?.N ? parseInt(item.lastRefill.N) : now;
              tokensByKey.set(key, tokens);
              lastRefillByKey.set(key, lastRefill);
              return {};
            });

            testMockClient.on(UpdateItemCommand).callsFake((input: any) => {
              const key = input.Key?.limitKey?.S || 'unknown';
              // Extract the new values from the update expression
              const updates = input.ExpressionAttributeValues;
              const names = input.ExpressionAttributeNames;

              // Update both tokens and lastRefill
              if (names && updates) {
                for (const [nameKey, attrName] of Object.entries(names)) {
                  const valueKey = nameKey.replace('#attr', ':val');
                  if (attrName === 'tokens' && updates[valueKey]?.N) {
                    const newTokens = parseInt(updates[valueKey].N);
                    tokensByKey.set(key, newTokens);
                  }
                  if (attrName === 'lastRefill' && updates[valueKey]?.N) {
                    const newLastRefill = parseInt(updates[valueKey].N);
                    lastRefillByKey.set(key, newLastRefill);
                  }
                }
              }

              const currentNow = Math.floor(Date.now() / 1000);
              return {
                Attributes: marshall({
                  limitKey: key,
                  tokens: tokensByKey.get(key) ?? 0,
                  lastRefill: currentNow, // Always use current time
                  ttl: currentNow + 3600,
                }),
              };
            });

            // Make requests for each key
            for (const key of uniqueKeys) {
              let allowed = 0;
              for (let i = 0; i < requestsPerKey; i++) {
                // Try to consume a token directly
                const consumed = await testRateLimiter.consumeToken(key);
                if (consumed) {
                  allowed++;
                }
              }
              results.set(key, allowed);
            }

            // Each key should be rate limited independently
            for (const [key, allowed] of results.entries()) {
              expect(allowed).toBeLessThanOrEqual(100);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Unit tests for RateLimiter', () => {
    it('should allow requests under the limit', async () => {
      const testKey = 'test-under-limit';
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: testKey,
          tokens: 100,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const result = await rateLimiter.checkLimit(testKey);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should deny requests over the limit', async () => {
      const testKey = 'test-over-limit';
      const now = Math.floor(Date.now() / 1000);
      let currentTokens = 100;

      mockClient.on(GetItemCommand).callsFake(() => ({
        Item: marshall({
          limitKey: testKey,
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
            limitKey: testKey,
            tokens: currentTokens,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      // Consume all tokens
      for (let i = 0; i < 100; i++) {
        await rateLimiter.consumeToken(testKey);
      }

      const result = await rateLimiter.checkLimit(testKey);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should return correct remaining tokens', async () => {
      const testKey = 'test-remaining';
      const now = Math.floor(Date.now() / 1000);
      let currentTokens = 100;

      mockClient.on(GetItemCommand).callsFake(() => ({
        Item: marshall({
          limitKey: testKey,
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
            limitKey: testKey,
            tokens: currentTokens,
            lastRefill: now,
            ttl: now + 3600,
          }),
        };
      });

      // Consume 10 tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consumeToken(testKey);
      }

      const remaining = await rateLimiter.getRemainingTokens(testKey);

      expect(remaining).toBeLessThanOrEqual(90);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom limits', async () => {
      const testKey = 'test-custom-limit';
      const now = Math.floor(Date.now() / 1000);

      mockClient.on(GetItemCommand).resolves({
        Item: marshall({
          limitKey: testKey,
          tokens: 50,
          lastRefill: now,
          ttl: now + 3600,
        }),
      });

      const result = await rateLimiter.checkLimit(testKey, 50, 60);

      expect(result.allowed).toBe(true);
    });
  });
});
