import {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CacheRepository } from '../CacheRepository';

import { createMockDynamoDBClient } from './test-utils';

describe('CacheRepository', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let repository: CacheRepository;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    repository = new CacheRepository('cache-table', mockClient as unknown as DynamoDBClient, 3600);
  });

  describe('get', () => {
    it('should return cache entry when found and not expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        cacheKey: 'test-key',
        data: JSON.stringify({ test: 'data' }),
        provider: 'gbif',
        createdAt: now - 1800,
        ttl: now + 1800, // Expires in 30 minutes
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.get('test-key');

      expect(result).toEqual(entry);
    });

    it('should return null when entry is expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        cacheKey: 'test-key',
        data: JSON.stringify({ test: 'data' }),
        provider: 'gbif',
        createdAt: now - 7200,
        ttl: now - 3600, // Expired 1 hour ago
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null when entry not found', async () => {
      mockClient.on(GetItemCommand).resolves({});

      const result = await repository.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should create cache entry with default TTL', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const data = JSON.stringify({ test: 'data' });
      const result = await repository.set('test-key', data, 'gbif');

      expect(result.cacheKey).toBe('test-key');
      expect(result.data).toBe(data);
      expect(result.provider).toBe('gbif');
      expect(result.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should create cache entry with custom TTL', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const customTTL = 7200;
      const result = await repository.set('test-key', 'data', 'gbif', customTTL);

      const expectedTTL = Math.floor(Date.now() / 1000) + customTTL;
      expect(result.ttl).toBeGreaterThanOrEqual(expectedTTL - 1);
      expect(result.ttl).toBeLessThanOrEqual(expectedTTL + 1);
    });
  });

  describe('invalidate', () => {
    it('should delete cache entry', async () => {
      mockClient.on(DeleteItemCommand).resolves({});

      await expect(repository.invalidate('test-key')).resolves.toBeUndefined();
    });

    it('should not throw when entry does not exist', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockClient.on(DeleteItemCommand).rejects(error);

      await expect(repository.invalidate('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same parameters', () => {
      const params = { query: 'test', limit: 10 };
      const key1 = CacheRepository.generateCacheKey('gbif', 'search', params);
      const key2 = CacheRepository.generateCacheKey('gbif', 'search', params);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameters', () => {
      const params1 = { query: 'test', limit: 10 };
      const params2 = { query: 'test', limit: 20 };
      const key1 = CacheRepository.generateCacheKey('gbif', 'search', params1);
      const key2 = CacheRepository.generateCacheKey('gbif', 'search', params2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different providers', () => {
      const params = { query: 'test' };
      const key1 = CacheRepository.generateCacheKey('gbif', 'search', params);
      const key2 = CacheRepository.generateCacheKey('inaturalist', 'search', params);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different operations', () => {
      const params = { query: 'test' };
      const key1 = CacheRepository.generateCacheKey('gbif', 'search', params);
      const key2 = CacheRepository.generateCacheKey('gbif', 'get', params);

      expect(key1).not.toBe(key2);
    });

    it('should handle parameter order consistently', () => {
      const params1 = { query: 'test', limit: 10, offset: 0 };
      const params2 = { offset: 0, limit: 10, query: 'test' };
      const key1 = CacheRepository.generateCacheKey('gbif', 'search', params1);
      const key2 = CacheRepository.generateCacheKey('gbif', 'search', params2);

      expect(key1).toBe(key2);
    });
  });

  describe('findByPattern', () => {
    it('should find cache entries matching a pattern', async () => {
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
      ];

      mockClient.on(ScanCommand).resolves({
        Items: entries.map((entry) => marshall(entry)),
      });

      const result = await repository.findByPattern('gbif:');

      expect(result).toHaveLength(2);
      expect(result[0].cacheKey).toBe('gbif:search:abc123');
      expect(result[1].cacheKey).toBe('gbif:search:def456');
    });

    it('should return empty array when no entries match', async () => {
      mockClient.on(ScanCommand).resolves({
        Items: [],
      });

      const result = await repository.findByPattern('nonexistent:');

      expect(result).toEqual([]);
    });

    it('should return empty array when Items is undefined', async () => {
      mockClient.on(ScanCommand).resolves({});

      const result = await repository.findByPattern('test:');

      expect(result).toEqual([]);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple cache entries', async () => {
      mockClient.on(DeleteItemCommand).resolves({});

      const keys = ['key1', 'key2', 'key3'];
      const result = await repository.deleteMany(keys);

      expect(result).toBe(3);
    });

    it('should return 0 when given empty array', async () => {
      const result = await repository.deleteMany([]);

      expect(result).toBe(0);
    });

    it('should ignore NotFoundError during deletion', async () => {
      // Mock the delete method to throw ConditionalCheckFailedException
      // which gets converted to NotFoundError by BaseRepository
      const error = new Error('The conditional request failed');
      error.name = 'ConditionalCheckFailedException';

      // First call succeeds, second throws ConditionalCheckFailedException
      mockClient.on(DeleteItemCommand).resolvesOnce({}).rejectsOnce(error);

      const keys = ['key1', 'key2'];
      const result = await repository.deleteMany(keys);

      // Should count the successful deletion but ignore the NotFoundError
      expect(result).toBe(1);
    });

    it('should handle batches larger than 25 items', async () => {
      mockClient.on(DeleteItemCommand).resolves({});

      const keys = Array.from({ length: 30 }, (_, i) => `key${i}`);
      const result = await repository.deleteMany(keys);

      expect(result).toBe(30);
    });
  });
});
