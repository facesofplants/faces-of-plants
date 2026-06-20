import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { RateLimitRepository } from '../RateLimitRepository';

import { createMockDynamoDBClient } from './test-utils';

describe('RateLimitRepository', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let repository: RateLimitRepository;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    repository = new RateLimitRepository(
      'rate-limit-table',
      mockClient as unknown as DynamoDBClient,
      3600
    );
  });

  describe('getLimit', () => {
    it('should return rate limit entry when found', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now,
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.getLimit('192.168.1.1');

      expect(result).toEqual(entry);
    });

    it('should return null when entry not found', async () => {
      mockClient.on(GetItemCommand).resolves({});

      const result = await repository.getLimit('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('initializeLimit', () => {
    it('should create new rate limit entry with default TTL', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const result = await repository.initializeLimit('192.168.1.1', 100);

      expect(result.limitKey).toBe('192.168.1.1');
      expect(result.tokens).toBe(100);
      expect(result.lastRefill).toBeGreaterThan(0);
      expect(result.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should create new rate limit entry with custom TTL', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const customTTL = 7200;
      const result = await repository.initializeLimit('192.168.1.1', 100, customTTL);

      const expectedTTL = Math.floor(Date.now() / 1000) + customTTL;
      expect(result.ttl).toBeGreaterThanOrEqual(expectedTTL - 1);
      expect(result.ttl).toBeLessThanOrEqual(expectedTTL + 1);
    });
  });

  describe('updateLimit', () => {
    it('should update existing rate limit entry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const existingEntry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now - 60,
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(existingEntry),
      });

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          ...existingEntry,
          tokens: 40,
        }),
      });

      const result = await repository.updateLimit({
        limitKey: '192.168.1.1',
        tokens: 40,
        lastRefill: now,
        ttl: now + 3600,
      });

      expect(result.tokens).toBe(40);
    });

    it('should create new entry if it does not exist', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockClient.on(GetItemCommand).resolves({});
      mockClient.on(PutItemCommand).resolves({});

      const entry = {
        limitKey: '192.168.1.1',
        tokens: 100,
        lastRefill: now,
        ttl: now + 3600,
      };

      const result = await repository.updateLimit(entry);

      expect(result.limitKey).toBe('192.168.1.1');
      expect(result.tokens).toBe(100);
    });
  });

  describe('consumeTokens', () => {
    it('should consume tokens when sufficient tokens available', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now,
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          ...entry,
          tokens: 49,
        }),
      });

      const result = await repository.consumeTokens('192.168.1.1', 1, 100, 10, 60);

      expect(result).not.toBeNull();
      expect(result?.tokens).toBe(49);
    });

    it('should return null when insufficient tokens', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 0,
        lastRefill: now,
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.consumeTokens('192.168.1.1', 1, 100, 10, 60);

      expect(result).toBeNull();
    });

    it('should refill tokens based on elapsed time', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 0,
        lastRefill: now - 120, // 2 minutes ago
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          ...entry,
          tokens: 19, // 20 tokens refilled (2 intervals * 10 rate) - 1 consumed
          lastRefill: now - 60,
        }),
      });

      const result = await repository.consumeTokens('192.168.1.1', 1, 100, 10, 60);

      expect(result).not.toBeNull();
      expect(result?.tokens).toBe(19);
    });

    it('should cap tokens at capacity', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now - 600, // 10 minutes ago
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          ...entry,
          tokens: 99, // Capped at 100 - 1 consumed
        }),
      });

      const result = await repository.consumeTokens('192.168.1.1', 1, 100, 10, 60);

      expect(result).not.toBeNull();
      expect(result?.tokens).toBe(99);
    });

    it('should initialize entry if it does not exist', async () => {
      mockClient.on(GetItemCommand).resolves({});
      mockClient.on(PutItemCommand).resolves({});
      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          limitKey: '192.168.1.1',
          tokens: 99,
          lastRefill: Math.floor(Date.now() / 1000),
          ttl: Math.floor(Date.now() / 1000) + 3600,
        }),
      });

      const result = await repository.consumeTokens('192.168.1.1', 1, 100, 10, 60);

      expect(result).not.toBeNull();
      expect(result?.tokens).toBe(99);
    });
  });

  describe('getRemainingTokens', () => {
    it('should return capacity when entry does not exist', async () => {
      mockClient.on(GetItemCommand).resolves({});

      const result = await repository.getRemainingTokens('192.168.1.1', 100, 10, 60);

      expect(result).toBe(100);
    });

    it('should return current tokens when no refill needed', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now,
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.getRemainingTokens('192.168.1.1', 100, 10, 60);

      expect(result).toBe(50);
    });

    it('should calculate refilled tokens', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 50,
        lastRefill: now - 120, // 2 minutes ago
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.getRemainingTokens('192.168.1.1', 100, 10, 60);

      // 50 + (2 intervals * 10 rate) = 70
      expect(result).toBe(70);
    });

    it('should cap at capacity', async () => {
      const now = Math.floor(Date.now() / 1000);
      const entry = {
        limitKey: '192.168.1.1',
        tokens: 90,
        lastRefill: now - 600, // 10 minutes ago
        ttl: now + 3600,
      };

      mockClient.on(GetItemCommand).resolves({
        Item: marshall(entry),
      });

      const result = await repository.getRemainingTokens('192.168.1.1', 100, 10, 60);

      // Should be capped at 100
      expect(result).toBe(100);
    });
  });
});
