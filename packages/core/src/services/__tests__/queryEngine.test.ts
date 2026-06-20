import { describe, it, expect, beforeEach } from 'vitest';

import { MultiSourceQueryEngine } from '../queryEngine';
import { ServiceRegistry } from '../registry';

import { createMockProvider, createMockSearchResult } from './test-utils';

describe('MultiSourceQueryEngine', () => {
  let registry: ServiceRegistry;
  let queryEngine: MultiSourceQueryEngine;

  beforeEach(() => {
    registry = new ServiceRegistry();
    queryEngine = new MultiSourceQueryEngine(registry);
  });

  it('should throw error when no query or filters provided', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    await expect(queryEngine.execute({})).rejects.toThrow(
      'Query must have either query text or filters'
    );
  });

  it('should throw error when no data sources available', async () => {
    await expect(queryEngine.execute({ query: 'test' })).rejects.toThrow(
      'No available data sources found'
    );
  });

  it('should execute query with single source', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test query',
    });

    expect(result.results).toBeDefined();
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toBe('test-provider');
    expect(result.metadata.sourcesQueried).toBe(1);
  });

  it('should execute query with multiple sources', async () => {
    const provider1 = createMockProvider('provider-1');
    const provider2 = createMockProvider('provider-2');

    registry.register(provider1);
    registry.register(provider2);

    const result = await queryEngine.execute({
      query: 'test query',
    });

    expect(result.sources).toHaveLength(2);
    expect(result.metadata.sourcesQueried).toBe(2);
  });

  it('should apply result limit', async () => {
    const provider = createMockProvider('test-provider', {
      client: {
        ...createMockProvider().client,
        search: async () => createMockSearchResult(100),
      },
    });

    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
      options: { maxResults: 10 },
    });

    expect(result.results.length).toBeLessThanOrEqual(10);
  });

  it('should validate max results limit', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    await expect(
      queryEngine.execute({
        query: 'test',
        options: { maxResults: 20000 },
      })
    ).rejects.toThrow('Maximum results cannot exceed 10,000');
  });

  it('should validate timeout limit', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    await expect(
      queryEngine.execute({
        query: 'test',
        options: { timeout: 400000 },
      })
    ).rejects.toThrow('Timeout cannot exceed 5 minutes');
  });

  it('should query specific sources when requested', async () => {
    const provider1 = createMockProvider('provider-1');
    const provider2 = createMockProvider('provider-2');
    const provider3 = createMockProvider('provider-3');

    registry.register(provider1);
    registry.register(provider2);
    registry.register(provider3);

    const result = await queryEngine.execute({
      query: 'test',
      sources: ['provider-1', 'provider-2'],
    });

    expect(result.metadata.sourcesQueried).toBe(2);
    expect(result.sources.map((s) => s.source)).toContain('provider-1');
    expect(result.sources.map((s) => s.source)).toContain('provider-2');
    expect(result.sources.map((s) => s.source)).not.toContain('provider-3');
  });

  it('should handle source query failures gracefully', async () => {
    const failingProvider = createMockProvider('failing-provider', {
      client: {
        ...createMockProvider().client,
        search: async () => {
          throw new Error('Search failed');
        },
      },
    });

    registry.register(failingProvider);

    const result = await queryEngine.execute({
      query: 'test',
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].success).toBe(false);
    expect(result.sources[0].error).toBe('Search failed');
    expect(result.metadata.sourcesSuccessful).toBe(0);
  });

  it('should apply deduplication by default', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
    });

    expect(result.metadata.deduplicationApplied).toBe(true);
  });

  it('should skip deduplication when disabled', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
      options: { deduplication: false },
    });

    expect(result.metadata.deduplicationApplied).toBe(false);
  });

  it('should use union merge strategy by default', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
    });

    expect(result.metadata.mergeStrategy).toBe('union');
  });

  it('should use specified merge strategy', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
      options: { mergeStrategy: 'priority' },
    });

    expect(result.metadata.mergeStrategy).toBe('priority');
  });

  it('should calculate query complexity', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
      filters: { country: 'US', year: 2023 },
      options: { deduplication: true },
    });

    expect(result.metadata.queryComplexity).toBeGreaterThan(1);
  });

  it('should include execution time in metadata', async () => {
    const provider = createMockProvider('test-provider');
    registry.register(provider);

    const result = await queryEngine.execute({
      query: 'test',
    });

    expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
  });

  describe('Graceful Degradation - Partial Failures', () => {
    it('should return results from successful providers when one provider fails', async () => {
      // Create one successful provider
      const successfulProvider = createMockProvider('successful-provider', {
        client: {
          ...createMockProvider().client,
          search: async () => createMockSearchResult(5),
        },
      });

      // Create one failing provider
      const failingProvider = createMockProvider('failing-provider', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Provider unavailable');
          },
        },
      });

      registry.register(successfulProvider);
      registry.register(failingProvider);

      const result = await queryEngine.execute({
        query: 'test query',
      });

      // Should return results from successful provider
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.sourcesQueried).toBe(2);
      expect(result.metadata.sourcesSuccessful).toBe(1);

      // Should include status for both providers
      expect(result.sources).toHaveLength(2);
      const successfulSource = result.sources.find((s) => s.source === 'successful-provider');
      const failedSource = result.sources.find((s) => s.source === 'failing-provider');

      expect(successfulSource?.success).toBe(true);
      expect(successfulSource?.results.length).toBeGreaterThan(0);

      expect(failedSource?.success).toBe(false);
      expect(failedSource?.error).toBe('Provider unavailable');
      expect(failedSource?.results).toEqual([]);
    });

    it('should return results from successful providers when multiple providers fail', async () => {
      // Create two successful providers
      const successfulProvider1 = createMockProvider('successful-provider-1', {
        client: {
          ...createMockProvider().client,
          search: async () => createMockSearchResult(3),
        },
      });

      const successfulProvider2 = createMockProvider('successful-provider-2', {
        client: {
          ...createMockProvider().client,
          search: async () => createMockSearchResult(4),
        },
      });

      // Create two failing providers
      const failingProvider1 = createMockProvider('failing-provider-1', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Network timeout');
          },
        },
      });

      const failingProvider2 = createMockProvider('failing-provider-2', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Service unavailable');
          },
        },
      });

      registry.register(successfulProvider1);
      registry.register(failingProvider1);
      registry.register(successfulProvider2);
      registry.register(failingProvider2);

      const result = await queryEngine.execute({
        query: 'test query',
      });

      // Should return results from both successful providers
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.sourcesQueried).toBe(4);
      expect(result.metadata.sourcesSuccessful).toBe(2);

      // Should include status for all providers
      expect(result.sources).toHaveLength(4);

      const successful1 = result.sources.find((s) => s.source === 'successful-provider-1');
      const successful2 = result.sources.find((s) => s.source === 'successful-provider-2');
      const failed1 = result.sources.find((s) => s.source === 'failing-provider-1');
      const failed2 = result.sources.find((s) => s.source === 'failing-provider-2');

      expect(successful1?.success).toBe(true);
      expect(successful1?.results.length).toBe(3);

      expect(successful2?.success).toBe(true);
      expect(successful2?.results.length).toBe(4);

      expect(failed1?.success).toBe(false);
      expect(failed1?.error).toBe('Network timeout');

      expect(failed2?.success).toBe(false);
      expect(failed2?.error).toBe('Service unavailable');
    });

    it('should return empty results when all providers fail', async () => {
      // Create two failing providers
      const failingProvider1 = createMockProvider('failing-provider-1', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Provider 1 failed');
          },
        },
      });

      const failingProvider2 = createMockProvider('failing-provider-2', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Provider 2 failed');
          },
        },
      });

      registry.register(failingProvider1);
      registry.register(failingProvider2);

      const result = await queryEngine.execute({
        query: 'test query',
      });

      // Should return empty results but not throw error
      expect(result.results).toEqual([]);
      expect(result.metadata.sourcesQueried).toBe(2);
      expect(result.metadata.sourcesSuccessful).toBe(0);

      // Should include error status for all providers
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].success).toBe(false);
      expect(result.sources[1].success).toBe(false);
      expect(result.sources[0].error).toBeDefined();
      expect(result.sources[1].error).toBeDefined();
    });

    it('should include provider status metadata in response', async () => {
      const successfulProvider = createMockProvider('successful-provider', {
        client: {
          ...createMockProvider().client,
          search: async () => ({
            results: createMockSearchResult(2).results,
            count: 2,
            totalCount: 2,
            metadata: {
              executionTime: 100,
              cacheHit: true,
              dataSourceVersion: '1.0',
              queryComplexity: 1,
            },
          }),
        },
      });

      const failingProvider = createMockProvider('failing-provider', {
        client: {
          ...createMockProvider().client,
          search: async () => {
            throw new Error('Rate limit exceeded');
          },
        },
      });

      registry.register(successfulProvider);
      registry.register(failingProvider);

      const result = await queryEngine.execute({
        query: 'test query',
      });

      // Check successful provider metadata
      const successfulSource = result.sources.find((s) => s.source === 'successful-provider');
      expect(successfulSource?.success).toBe(true);
      expect(successfulSource?.count).toBe(2);
      expect(successfulSource?.executionTime).toBeGreaterThanOrEqual(0);
      expect(successfulSource?.metadata?.cacheHit).toBe(true);

      // Check failed provider metadata
      const failedSource = result.sources.find((s) => s.source === 'failing-provider');
      expect(failedSource?.success).toBe(false);
      expect(failedSource?.error).toBe('Rate limit exceeded');
      expect(failedSource?.count).toBe(0);
      expect(failedSource?.results).toEqual([]);
    });
  });
});
