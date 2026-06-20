import { type DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { CacheRepository } from '../repository/CacheRepository';

/**
 * Cache service for storing and retrieving provider API responses
 * Implements cache-aside pattern with DynamoDB as the backing store
 */
export class CacheService {
  private repository: CacheRepository;

  constructor(
    tableName: string,
    client: DynamoDBClient,
    private readonly defaultTTL = 3600 // 1 hour default
  ) {
    this.repository = new CacheRepository(tableName, client, defaultTTL);
  }

  /**
   * Get cached data by key
   * Returns null if cache miss or expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = await this.repository.get(key);

    if (!entry) {
      return null;
    }

    try {
      return JSON.parse(entry.data) as T;
    } catch (error) {
      // If parsing fails, invalidate the corrupted entry
      await this.repository.invalidate(key);
      return null;
    }
  }

  /**
   * Set cached data with optional TTL
   * @param key Cache key
   * @param value Data to cache
   * @param ttl TTL in seconds (defaults to 1 hour)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    const provider = this.extractProviderFromKey(key);
    await this.repository.set(key, data, provider, ttl);
  }

  /**
   * Invalidate (delete) a cache entry
   */
  async invalidate(key: string): Promise<void> {
    await this.repository.invalidate(key);
  }

  /**
   * Invalidate cache entries matching a pattern
   * Supports prefix matching (e.g., "gbif:" to invalidate all GBIF cache entries)
   *
   * Note: This uses Scan operation which can be expensive for large datasets
   * For production use with large cache tables, consider:
   * - Using a GSI on provider field
   * - Implementing a pattern index
   * - Rate limiting this operation
   *
   * @param pattern Pattern to match (prefix matching)
   * @returns Number of cache entries invalidated
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      // Find all cache entries matching the pattern
      const entries = await this.repository.findByPattern(pattern);

      if (entries.length === 0) {
        return 0;
      }

      // Extract cache keys
      const cacheKeys = entries.map((entry) => entry.cacheKey);

      // Delete all matching entries
      const deletedCount = await this.repository.deleteMany(cacheKeys);

      return deletedCount;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      throw error;
    }
  }

  /**
   * Generate a cache key from provider, operation, and parameters
   * Uses the repository's static method for consistency
   */
  generateCacheKey(provider: string, operation: string, params: Record<string, any>): string {
    return CacheRepository.generateCacheKey(provider, operation, params);
  }

  /**
   * Extract provider name from cache key
   * Cache keys are formatted as: provider:operation:hash
   */
  private extractProviderFromKey(key: string): string {
    const parts = key.split(':');
    return parts[0] || 'unknown';
  }
}
