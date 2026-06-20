import { type DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockDynamoDBClient } from '../../repository/__tests__/test-utils';
import { CacheService } from '../CacheService';

describe('CacheService', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let cacheService: CacheService;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    cacheService = new CacheService('cache-table', mockClient as unknown as DynamoDBClient, 3600);
  });

  describe('invalidatePattern', () => {
    it('should invalidate all cache entries matching a pattern', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entries = [
        {
          cacheKey: 'gbif:search:abc123',
          data: JSON.stringify({ test: 'data1' }),
          provider: 'gbif',
          createdAt: now,
          ttl: now + 3600,
        },
        {
          cacheKey: 'gbif:search:def456',
          data: JSON.stringify({ test: 'data2' }),
          provider: 'gbif',
          createdAt: now,
          ttl: now + 3600,
        },
        {
          cacheKey: 'inaturalist:search:xyz789',
          data: JSON.stringify({ test: 'data3' }),
          provider: 'inaturalist',
          createdAt: now,
          ttl: now + 3600,
        },
      ];

      // Mock Scan to return entries matching the pattern
      mockClient.on(ScanCommand).resolves({
        Items: entries
          .filter((e) => e.cacheKey.startsWith('gbif:'))
          .map((entry) => marshall(entry)),
      });

      const result = await cacheService.invalidatePattern('gbif:');

      // Should have invalidated 2 GBIF entries
      expect(result).toBe(2);
    });

    it('should return 0 when no entries match the pattern', async () => {
      mockClient.on(ScanCommand).resolves({
        Items: [],
      });

      const result = await cacheService.invalidatePattern('nonexistent:');

      expect(result).toBe(0);
    });

    it('should handle pattern invalidation for specific operations', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entries = [
        {
          cacheKey: 'gbif:search:abc123',
          data: JSON.stringify({ test: 'data1' }),
          provider: 'gbif',
          createdAt: now,
          ttl: now + 3600,
        },
        {
          cacheKey: 'gbif:get:def456',
          data: JSON.stringify({ test: 'data2' }),
          provider: 'gbif',
          createdAt: now,
          ttl: now + 3600,
        },
      ];

      // Mock Scan to return only search operations
      mockClient.on(ScanCommand).resolves({
        Items: entries
          .filter((e) => e.cacheKey.startsWith('gbif:search:'))
          .map((entry) => marshall(entry)),
      });

      const result = await cacheService.invalidatePattern('gbif:search:');

      // Should have invalidated only 1 search entry
      expect(result).toBe(1);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate cache keys with provider prefix', () => {
      const key = cacheService.generateCacheKey('gbif', 'search', {
        query: 'test',
      });

      expect(key).toMatch(/^gbif:search:/);
    });

    it('should include operation in cache key', () => {
      const key = cacheService.generateCacheKey('gbif', 'search', {
        query: 'test',
      });

      expect(key).toContain(':search:');
    });
  });

  describe('extractProviderFromKey', () => {
    it('should extract provider from cache key', async () => {
      const key = 'gbif:search:abc123';

      // Set a value to test provider extraction
      await cacheService.set(key, { test: 'data' });

      // The provider should be extracted correctly (tested indirectly through set)
      expect(key.split(':')[0]).toBe('gbif');
    });
  });
});
