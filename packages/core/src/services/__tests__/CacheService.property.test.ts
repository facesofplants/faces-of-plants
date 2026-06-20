import {
  type DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { createMockDynamoDBClient } from '../../repository/__tests__/test-utils';
import { CacheRepository } from '../../repository/CacheRepository';
import { CacheService } from '../CacheService';

/**
 * Property-based tests for CacheService
 * These tests validate universal properties that should hold across all inputs
 */
describe('CacheService - Property-Based Tests', () => {
  /**
   * Feature: production-readiness, Property 8: Cache keys ensure uniqueness
   * Validates: Requirements 4.4
   *
   * For any two different query parameter sets, the generated cache keys should be different;
   * for identical parameters, cache keys should be the same
   */
  describe('Property 8: Cache key uniqueness', () => {
    it('should generate identical keys for identical parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // provider
          fc.string({ minLength: 1, maxLength: 20 }), // operation
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
          ), // params
          (provider, operation, params) => {
            const key1 = CacheRepository.generateCacheKey(provider, operation, params);
            const key2 = CacheRepository.generateCacheKey(provider, operation, params);

            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate identical keys regardless of parameter order', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // provider
          fc.string({ minLength: 1, maxLength: 20 }), // operation
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            { minKeys: 2, maxKeys: 5 }
          ), // params with at least 2 keys
          (provider, operation, params) => {
            // Create a shuffled version of the params
            const keys = Object.keys(params);
            const shuffledParams: Record<string, any> = {};
            // Reverse the order
            for (let i = keys.length - 1; i >= 0; i--) {
              shuffledParams[keys[i]] = params[keys[i]];
            }

            const key1 = CacheRepository.generateCacheKey(provider, operation, params);
            const key2 = CacheRepository.generateCacheKey(provider, operation, shuffledParams);

            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for different parameter values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // provider
          fc.string({ minLength: 1, maxLength: 20 }), // operation
          fc
            .tuple(
              fc.dictionary(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.oneof(fc.string(), fc.integer(), fc.boolean())
              ),
              fc.dictionary(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.oneof(fc.string(), fc.integer(), fc.boolean())
              )
            )
            .filter(([params1, params2]) => {
              // Only test when params are actually different
              return JSON.stringify(params1) !== JSON.stringify(params2);
            }),
          (provider, operation, [params1, params2]) => {
            const key1 = CacheRepository.generateCacheKey(provider, operation, params1);
            const key2 = CacheRepository.generateCacheKey(provider, operation, params2);

            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for different providers', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 20 })
            )
            .filter(([p1, p2]) => p1 !== p2), // Ensure providers are different
          fc.string({ minLength: 1, maxLength: 20 }), // operation
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ), // params
          ([provider1, provider2], operation, params) => {
            const key1 = CacheRepository.generateCacheKey(provider1, operation, params);
            const key2 = CacheRepository.generateCacheKey(provider2, operation, params);

            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for different operations', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }), // provider
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 20 })
            )
            .filter(([op1, op2]) => op1 !== op2), // Ensure operations are different
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ), // params
          (provider, [operation1, operation2], params) => {
            const key1 = CacheRepository.generateCacheKey(provider, operation1, params);
            const key2 = CacheRepository.generateCacheKey(provider, operation2, params);

            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: production-readiness, Property 7: Cache stores and retrieves data correctly
   * Validates: Requirements 4.1, 4.2
   *
   * For any provider data fetch, if the data is cached, a subsequent identical request
   * should return the cached data without calling the external API
   */
  describe('Property 7: Cache stores and retrieves data correctly', () => {
    let mockClient: ReturnType<typeof createMockDynamoDBClient>;
    let cacheService: CacheService;
    let cacheStore: Map<string, any>;

    beforeEach(() => {
      mockClient = createMockDynamoDBClient();
      cacheStore = new Map();

      // Mock PutItemCommand to store in our map
      mockClient.on(PutItemCommand).callsFake((input: any) => {
        const key = input.Item.cacheKey.S;
        cacheStore.set(key, input.Item);
        return Promise.resolve({});
      });

      // Mock GetItemCommand to retrieve from our map
      mockClient.on(GetItemCommand).callsFake((input: any) => {
        const key = input.Key.cacheKey.S;
        const item = cacheStore.get(key);
        return Promise.resolve(item ? { Item: item } : {});
      });

      // Mock DeleteItemCommand to remove from our map
      mockClient.on(DeleteItemCommand).callsFake((input: any) => {
        const key = input.Key.cacheKey.S;
        cacheStore.delete(key);
        return Promise.resolve({});
      });

      cacheService = new CacheService('cache-table', mockClient as unknown as DynamoDBClient, 3600);
    });

    it('should store and retrieve any JSON-serializable data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // cache key
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
            fc.record({
              id: fc.integer(),
              name: fc.string(),
              active: fc.boolean(),
            })
          ), // various data types
          async (key, data) => {
            // Store data in cache
            await cacheService.set(key, data);

            // Retrieve data from cache
            const retrieved = await cacheService.get(key);

            // Data should match exactly
            expect(retrieved).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent cache keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // cache key
          async (key) => {
            // Try to get data that was never cached
            const retrieved = await cacheService.get(key);

            // Should return null for cache miss
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cache key generation consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }), // provider
          fc.string({ minLength: 1, maxLength: 20 }), // operation
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ), // params
          fc.record({
            id: fc.integer(),
            value: fc.string(),
          }), // data to cache
          async (provider, operation, params, data) => {
            // Generate cache key
            const key = cacheService.generateCacheKey(provider, operation, params);

            // Store data
            await cacheService.set(key, data);

            // Generate the same key again
            const sameKey = cacheService.generateCacheKey(provider, operation, params);

            // Retrieve using the regenerated key
            const retrieved = await cacheService.get(sameKey);

            // Should retrieve the same data
            expect(retrieved).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple cache entries independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .array(
              fc.record({
                key: fc.string({ minLength: 1, maxLength: 50 }),
                data: fc.record({
                  id: fc.integer(),
                  value: fc.string(),
                }),
              }),
              { minLength: 2, maxLength: 10 }
            )
            .filter((entries) => {
              // Ensure all keys are unique
              const keys = entries.map((e) => e.key);
              return new Set(keys).size === keys.length;
            }),
          async (entries) => {
            // Store all entries
            for (const entry of entries) {
              await cacheService.set(entry.key, entry.data);
            }

            // Retrieve and verify each entry
            for (const entry of entries) {
              const retrieved = await cacheService.get(entry.key);
              expect(retrieved).toEqual(entry.data);
            }
          }
        ),
        { numRuns: 50 } // Fewer runs since this test is more complex
      );
    });

    it('should handle cache invalidation correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }), // cache key
          fc.record({
            id: fc.integer(),
            value: fc.string(),
          }), // data
          async (key, data) => {
            // Store data
            await cacheService.set(key, data);

            // Verify it's cached
            const retrieved = await cacheService.get(key);
            expect(retrieved).toEqual(data);

            // Invalidate the cache
            await cacheService.invalidate(key);

            // Should return null after invalidation
            const afterInvalidation = await cacheService.get(key);
            expect(afterInvalidation).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
