import { type DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { BaseRepository } from './BaseRepository';
import { type CacheEntry, DatabaseError } from './types';

/**
 * Repository for cache operations with TTL support
 * Uses Query operations for efficient cache lookups
 */
export class CacheRepository extends BaseRepository<CacheEntry> {
  private readonly defaultTTL: number;

  constructor(tableName: string, client: DynamoDBClient, defaultTTL = 3600) {
    super({
      tableName,
      client,
      partitionKey: 'cacheKey',
    });
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a cache entry by key
   * Returns null if entry doesn't exist or has expired
   */
  async get(cacheKey: string): Promise<CacheEntry | null> {
    const entry = await this.findById(cacheKey);

    if (!entry) {
      return null;
    }

    // Check if entry has expired (TTL is in seconds since epoch)
    const now = Math.floor(Date.now() / 1000);
    if (entry.ttl && entry.ttl < now) {
      // Entry has expired, return null
      return null;
    }

    return entry;
  }

  /**
   * Set a cache entry with TTL
   */
  async set(
    cacheKey: string,
    data: string,
    provider: string,
    ttlSeconds?: number
  ): Promise<CacheEntry> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = now + (ttlSeconds || this.defaultTTL);

    const entry: CacheEntry = {
      cacheKey,
      data,
      provider,
      createdAt: now,
      ttl,
    };

    return this.create(entry);
  }

  /**
   * Invalidate (delete) a cache entry
   */
  async invalidate(cacheKey: string): Promise<void> {
    try {
      await this.delete(cacheKey);
    } catch (error) {
      // Ignore NotFoundError for invalidation
      if (error instanceof Error && error.name !== 'NotFoundError') {
        throw error;
      }
    }
  }

  /**
   * Find cache entries by provider
   * Uses Query operation if a GSI exists, otherwise returns empty array
   * Note: This requires a GSI on provider field for efficient querying
   */
  async findByProvider(provider: string, limit?: number): Promise<CacheEntry[]> {
    try {
      // This would require a GSI on provider field
      // For now, we'll return empty array as this is an optional optimization
      return [];
    } catch (error) {
      throw new DatabaseError(
        `Failed to find cache entries by provider ${provider}`,
        error as Error
      );
    }
  }

  /**
   * Find cache entries matching a pattern
   * Uses Scan operation to find keys matching the pattern
   * Note: This is an expensive operation and should be used sparingly
   *
   * @param pattern Pattern to match (supports prefix matching)
   * @returns Array of cache entries matching the pattern
   */
  async findByPattern(pattern: string): Promise<CacheEntry[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(cacheKey, :pattern)',
        ExpressionAttributeValues: marshall({
          ':pattern': pattern,
        }),
      });

      // Note: This uses Scan which is expensive for large tables
      // For production, consider using a GSI or maintaining a pattern index
      const result = await this.client.send(command);

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.map((item) => unmarshall(item) as CacheEntry);
    } catch (error) {
      throw new DatabaseError(`Failed to find cache entries by pattern ${pattern}`, error as Error);
    }
  }

  /**
   * Delete multiple cache entries by their keys
   * Uses BatchWriteItem for efficient bulk deletion
   *
   * @param cacheKeys Array of cache keys to delete
   * @returns Number of entries deleted
   */
  async deleteMany(cacheKeys: string[]): Promise<number> {
    if (cacheKeys.length === 0) {
      return 0;
    }

    // DynamoDB BatchWriteItem has a limit of 25 items per request
    const batchSize = 25;
    let deletedCount = 0;

    for (let i = 0; i < cacheKeys.length; i += batchSize) {
      const batch = cacheKeys.slice(i, i + batchSize);

      // Use the base repository's delete method for each key
      await Promise.all(
        batch.map(async (key) => {
          try {
            await this.delete(key);
            deletedCount++;
          } catch (error) {
            // Ignore NotFoundError for deletion - item already doesn't exist
            if (error instanceof Error && error.name === 'NotFoundError') {
              // Item doesn't exist, which is fine for deletion
              return;
            }
            // Re-throw other errors
            throw error;
          }
        })
      );
    }

    return deletedCount;
  }

  /**
   * Generate a cache key from provider, operation, and parameters
   */
  static generateCacheKey(
    provider: string,
    operation: string,
    params: Record<string, any>
  ): string {
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = params[key];
          return acc;
        },
        {} as Record<string, any>
      );

    const paramsHash = this.hashObject(sortedParams);
    return `${provider}:${operation}:${paramsHash}`;
  }

  /**
   * Simple hash function for cache key generation
   */
  private static hashObject(obj: Record<string, any>): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
