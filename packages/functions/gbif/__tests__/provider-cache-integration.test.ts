/**
 * Integration tests for cache integration with GBIF provider
 * Tests cache-aside pattern implementation
 *
 * Requirements: 4.2, 4.3
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CacheService } from '../../../core/src/services/CacheService';
import { type SearchParams } from '../../../core/src/services/types';
import { GBIFProvider } from '../provider';

// Mock the DynamoDB client
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');

// Mock the GBIF client to avoid real API calls
vi.mock('../client', () => {
  class MockGBIFClient {
    async searchOccurrences() {
      return {
        results: [
          {
            key: 123456,
            scientificName: 'Quercus robur',
            decimalLatitude: 51.5074,
            decimalLongitude: -0.1278,
            country: 'United Kingdom',
            eventDate: '2023-01-15',
            basisOfRecord: 'HUMAN_OBSERVATION',
          },
        ],
        count: 1,
        endOfRecords: true,
      };
    }
  }

  return {
    GBIFClient: MockGBIFClient,
  };
});

describe('GBIF Provider Cache Integration', () => {
  let mockDynamoClient: DynamoDBClient;
  let cacheService: CacheService;
  let provider: GBIFProvider;
  let mockCacheGet: any;
  let mockCacheSet: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock DynamoDB client
    mockDynamoClient = new DynamoDBClient({});

    // Create cache service with mocked repository
    cacheService = new CacheService('test-cache-table', mockDynamoClient, 3600);

    // Mock cache service methods
    mockCacheGet = vi.spyOn(cacheService, 'get');
    mockCacheSet = vi.spyOn(cacheService, 'set');

    // Create provider with cache service
    provider = new GBIFProvider(cacheService);
  });

  describe('Cache Hit Scenario', () => {
    it('should return cached results without calling external API', async () => {
      // Arrange: Set up cached data
      const searchParams: SearchParams = {
        query: 'oak trees',
        filters: { country: 'US' },
        limit: 10,
      };

      const cachedResult = {
        results: [
          {
            id: 'gbif:123456',
            source: 'gbif',
            sourceId: '123456',
            taxon: {
              scientificName: 'Quercus robur',
            },
            location: {
              latitude: 51.5074,
              longitude: -0.1278,
              country: 'United Kingdom',
            },
            observation: {
              eventDate: '2023-01-15',
              basisOfRecord: 'HUMAN_OBSERVATION',
            },
            metadata: {
              originalData: {},
            },
            confidence: 1.0,
            lastUpdated: '2023-01-15',
          },
        ],
        count: 1,
        totalCount: 1,
        endOfRecords: true,
        metadata: {
          executionTime: 50,
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: 2,
        },
      };

      // Mock cache to return cached data
      mockCacheGet.mockResolvedValue(cachedResult);

      // Act: Search with cache hit
      const result = await provider.client.search(searchParams);

      // Assert: Verify cache was checked
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(mockCacheGet).toHaveBeenCalledWith(expect.stringContaining('gbif:search:'));

      // Assert: Verify result came from cache
      expect(result.metadata?.cacheHit).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].taxon.scientificName).toBe('Quercus robur');

      // Assert: Verify external API was NOT called (no cache set)
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('should update execution time but preserve cached data', async () => {
      // Arrange
      const searchParams: SearchParams = {
        query: 'maple trees',
        limit: 5,
      };

      const cachedResult = {
        results: [],
        count: 0,
        metadata: {
          executionTime: 100, // Old execution time
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: 1,
        },
      };

      mockCacheGet.mockResolvedValue(cachedResult);

      // Act
      const startTime = Date.now();
      const result = await provider.client.search(searchParams);
      const endTime = Date.now();

      // Assert: Execution time should be updated to reflect cache retrieval time
      expect(result.metadata?.executionTime).toBeLessThan(endTime - startTime + 10);
      expect(result.metadata?.executionTime).not.toBe(100);
      expect(result.metadata?.cacheHit).toBe(true);
    });
  });

  describe('Cache Miss Scenario', () => {
    it('should call external API and cache the result', async () => {
      // Arrange: Cache returns null (miss)
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'pine trees',
        filters: { country: 'CA' },
        limit: 20,
      };

      // Act: Search with cache miss
      const result = await provider.client.search(searchParams);

      // Assert: Verify cache was checked
      expect(mockCacheGet).toHaveBeenCalledTimes(1);

      // Assert: Verify external API was called (result has data)
      expect(result.results).toHaveLength(1);
      expect(result.metadata?.cacheHit).toBe(false);

      // Assert: Verify result was cached
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('gbif:search:'),
        expect.objectContaining({
          results: expect.any(Array),
          count: expect.any(Number),
        })
      );
    });

    it('should generate consistent cache keys for identical queries', async () => {
      // Arrange
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'oak',
        filters: { country: 'US', year: '2023' },
        limit: 10,
      };

      // Act: Execute same query twice
      await provider.client.search(searchParams);
      await provider.client.search(searchParams);

      // Assert: Both calls should use the same cache key
      const firstCallKey = mockCacheGet.mock.calls[0][0];
      const secondCallKey = mockCacheGet.mock.calls[1][0];
      expect(firstCallKey).toBe(secondCallKey);
    });

    it('should generate different cache keys for different queries', async () => {
      // Arrange
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams1: SearchParams = {
        query: 'oak',
        limit: 10,
      };

      const searchParams2: SearchParams = {
        query: 'maple',
        limit: 10,
      };

      // Act: Execute different queries
      await provider.client.search(searchParams1);
      await provider.client.search(searchParams2);

      // Assert: Different queries should use different cache keys
      const firstCallKey = mockCacheGet.mock.calls[0][0];
      const secondCallKey = mockCacheGet.mock.calls[1][0];
      expect(firstCallKey).not.toBe(secondCallKey);
    });
  });

  describe('Cache Expiration Behavior', () => {
    it('should handle expired cache entries as cache miss', async () => {
      // Arrange: Cache returns null (expired entry removed by TTL)
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'birch trees',
        limit: 15,
      };

      // Act
      const result = await provider.client.search(searchParams);

      // Assert: Should behave like cache miss
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(result.metadata?.cacheHit).toBe(false);
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Provider Without Cache Service', () => {
    it('should work without cache service (no caching)', async () => {
      // Arrange: Create provider without cache service
      const providerWithoutCache = new GBIFProvider();

      const searchParams: SearchParams = {
        query: 'willow trees',
        limit: 10,
      };

      // Act
      const result = await providerWithoutCache.client.search(searchParams);

      // Assert: Should return results without caching
      expect(result.results).toHaveLength(1);
      expect(result.metadata?.cacheHit).toBe(false);

      // Assert: Cache methods should not be called
      expect(mockCacheGet).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache retrieval errors gracefully', async () => {
      // Arrange: Cache throws error
      mockCacheGet.mockRejectedValue(new Error('DynamoDB connection error'));
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'elm trees',
        limit: 10,
      };

      // Act & Assert: Should throw error (cache errors are not silently ignored)
      await expect(provider.client.search(searchParams)).rejects.toThrow(
        'DynamoDB connection error'
      );
    });

    it('should handle cache storage errors gracefully', async () => {
      // Arrange: Cache get succeeds but set fails
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockRejectedValue(new Error('DynamoDB write error'));

      const searchParams: SearchParams = {
        query: 'ash trees',
        limit: 10,
      };

      // Act & Assert: Should throw error (cache errors are not silently ignored)
      await expect(provider.client.search(searchParams)).rejects.toThrow('DynamoDB write error');
    });
  });

  describe('Cache Key Generation', () => {
    it('should include provider name in cache key', async () => {
      // Arrange
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'test',
        limit: 10,
      };

      // Act
      await provider.client.search(searchParams);

      // Assert
      const cacheKey = mockCacheGet.mock.calls[0][0];
      expect(cacheKey).toContain('gbif');
    });

    it('should include operation name in cache key', async () => {
      // Arrange
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'test',
        limit: 10,
      };

      // Act
      await provider.client.search(searchParams);

      // Assert
      const cacheKey = mockCacheGet.mock.calls[0][0];
      expect(cacheKey).toContain('search');
    });

    it('should include parameter hash in cache key', async () => {
      // Arrange
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(undefined);

      const searchParams: SearchParams = {
        query: 'test',
        filters: { country: 'US' },
        limit: 10,
      };

      // Act
      await provider.client.search(searchParams);

      // Assert
      const cacheKey = mockCacheGet.mock.calls[0][0];
      // Cache key should have format: provider:operation:hash
      const parts = cacheKey.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('gbif');
      expect(parts[1]).toBe('search');
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // Hash should be base36 string (0-9, a-z)
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });
});
