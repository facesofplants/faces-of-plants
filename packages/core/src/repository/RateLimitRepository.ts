import { type DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { BaseRepository } from './BaseRepository';
import { type RateLimitEntry, DatabaseError } from './types';

/**
 * Repository for rate limiting operations with token bucket algorithm
 * Uses Query operations for efficient rate limit checks
 */
export class RateLimitRepository extends BaseRepository<RateLimitEntry> {
  private readonly defaultTTL: number;

  constructor(tableName: string, client: DynamoDBClient, defaultTTL = 3600) {
    super({
      tableName,
      client,
      partitionKey: 'limitKey',
    });
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get rate limit entry for a key (IP address or user ID)
   */
  async getLimit(limitKey: string): Promise<RateLimitEntry | null> {
    return this.findById(limitKey);
  }

  /**
   * Update or create rate limit entry
   */
  async updateLimit(entry: RateLimitEntry): Promise<RateLimitEntry> {
    try {
      // Try to update existing entry
      const existing = await this.findById(entry.limitKey);

      if (existing) {
        return this.update(entry.limitKey, {
          tokens: entry.tokens,
          lastRefill: entry.lastRefill,
          ttl: entry.ttl,
        });
      }

      // Create new entry if it doesn't exist
      return this.create(entry);
    } catch (error) {
      throw new DatabaseError(
        `Failed to update rate limit for key ${entry.limitKey}`,
        error as Error
      );
    }
  }

  /**
   * Initialize a new rate limit entry
   */
  async initializeLimit(
    limitKey: string,
    capacity: number,
    ttlSeconds?: number
  ): Promise<RateLimitEntry> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = now + (ttlSeconds || this.defaultTTL);

    const entry: RateLimitEntry = {
      limitKey,
      tokens: capacity,
      lastRefill: now,
      ttl,
    };

    return this.create(entry);
  }

  /**
   * Consume tokens from the bucket
   * Returns the updated entry if successful, null if insufficient tokens
   */
  async consumeTokens(
    limitKey: string,
    tokensToConsume: number,
    capacity: number,
    refillRate: number,
    refillInterval: number
  ): Promise<RateLimitEntry | null> {
    try {
      const now = Math.floor(Date.now() / 1000);
      let entry = await this.getLimit(limitKey);

      // Initialize if doesn't exist
      if (!entry) {
        entry = await this.initializeLimit(limitKey, capacity);
      }

      // Calculate tokens to add based on time elapsed
      const timeSinceLastRefill = now - entry.lastRefill;
      const intervalsElapsed = Math.floor(timeSinceLastRefill / refillInterval);
      const tokensToAdd = intervalsElapsed * refillRate;

      // Refill tokens up to capacity
      let currentTokens = Math.min(entry.tokens + tokensToAdd, capacity);
      const newLastRefill = entry.lastRefill + intervalsElapsed * refillInterval;

      // Check if we have enough tokens
      if (currentTokens < tokensToConsume) {
        return null;
      }

      // Consume tokens
      currentTokens -= tokensToConsume;

      // Update entry
      const updatedEntry = await this.updateLimit({
        limitKey,
        tokens: currentTokens,
        lastRefill: newLastRefill,
        ttl: now + this.defaultTTL,
      });

      return updatedEntry;
    } catch (error) {
      throw new DatabaseError(`Failed to consume tokens for key ${limitKey}`, error as Error);
    }
  }

  /**
   * Get remaining tokens for a key
   */
  async getRemainingTokens(
    limitKey: string,
    capacity: number,
    refillRate: number,
    refillInterval: number
  ): Promise<number> {
    const entry = await this.getLimit(limitKey);

    if (!entry) {
      return capacity;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastRefill = now - entry.lastRefill;
    const intervalsElapsed = Math.floor(timeSinceLastRefill / refillInterval);
    const tokensToAdd = intervalsElapsed * refillRate;

    return Math.min(entry.tokens + tokensToAdd, capacity);
  }

  /**
   * Delete expired rate limit entries
   * Note: DynamoDB TTL will handle this automatically, but this method
   * can be used for manual cleanup if needed
   */
  async deleteExpired(limitKey: string): Promise<void> {
    const entry = await this.getLimit(limitKey);

    if (!entry) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (entry.ttl < now) {
      await this.delete(limitKey);
    }
  }
}
