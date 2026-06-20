import { describe, it, expect, beforeEach } from 'vitest';

import { ServiceRegistry } from '../registry';
import { type DataSourceProvider, type DataSourceClient, type SearchResult } from '../types';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;
  let mockProvider: DataSourceProvider;

  beforeEach(() => {
    registry = new ServiceRegistry();

    // Create a mock provider
    mockProvider = {
      id: 'test-provider',
      name: 'Test Provider',
      version: '1.0.0',
      capabilities: [
        {
          type: 'occurrence',
          operations: [
            {
              name: 'search',
              description: 'Search for occurrences',
              parameters: {
                type: 'object',
                properties: {
                  q: { type: 'string' },
                },
              },
            },
          ],
          filters: [{ name: 'q', type: 'string', description: 'Query text' }],
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          examples: [
            {
              description: 'Test query',
              query: 'test',
              parameters: { q: 'test' },
            },
          ],
        },
      ],
      rateLimit: {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        requestsPerHour: 36000,
      },
      client: createMockClient(),
    };
  });

  it('should register a provider', () => {
    registry.register(mockProvider);

    const provider = registry.getProvider('test-provider');
    expect(provider).toBeDefined();
    expect(provider?.id).toBe('test-provider');
    expect(provider?.name).toBe('Test Provider');
  });

  it('should unregister a provider', () => {
    registry.register(mockProvider);
    registry.unregister('test-provider');

    const provider = registry.getProvider('test-provider');
    expect(provider).toBeUndefined();
  });

  it('should find providers by capability', () => {
    registry.register(mockProvider);

    const providers = registry.findProvidersWithCapability('occurrence');
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('test-provider');
  });

  it('should validate provider', () => {
    const validation = registry.validateProvider(mockProvider);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid provider', () => {
    const invalidProvider = {
      ...mockProvider,
      id: '', // Invalid - empty ID
    };

    const validation = registry.validateProvider(invalidProvider);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Provider ID is required');
  });

  it('should get registry info', () => {
    registry.register(mockProvider);

    const info = registry.getRegistryInfo();
    expect(info.totalProviders).toBe(1);
    expect(info.capabilities.occurrence).toBe(1);
    expect(info.providers).toHaveLength(1);
  });

  it('should get capabilities for a provider', () => {
    registry.register(mockProvider);

    const capabilities = registry.getCapabilities('test-provider');
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0].type).toBe('occurrence');
  });

  it('should return empty array for non-existent provider capabilities', () => {
    const capabilities = registry.getCapabilities('non-existent');
    expect(capabilities).toHaveLength(0);
  });

  it('should find providers with specific operation', () => {
    registry.register(mockProvider);

    const providers = registry.findProvidersWithOperation('search');
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('test-provider');
  });

  it('should get provider stats', () => {
    registry.register(mockProvider);

    const stats = registry.getProviderStats('test-provider');
    expect(stats).toBeDefined();
    expect(stats?.id).toBe('test-provider');
    expect(stats?.name).toBe('Test Provider');
    expect(stats?.capabilities).toBe(1);
  });

  it('should return undefined for non-existent provider stats', () => {
    const stats = registry.getProviderStats('non-existent');
    expect(stats).toBeUndefined();
  });

  it('should get all provider stats', () => {
    registry.register(mockProvider);

    const allStats = registry.getAllProviderStats();
    expect(allStats).toHaveLength(1);
    expect(allStats[0].id).toBe('test-provider');
  });

  it('should get health status', () => {
    registry.register(mockProvider);

    const healthStatus = registry.getHealthStatus();
    expect(healthStatus).toBeDefined();
  });

  it('should perform health check on all providers', async () => {
    registry.register(mockProvider);

    const healthResults = await registry.healthCheck();
    expect(healthResults['test-provider']).toBeDefined();
    expect(healthResults['test-provider'].healthy).toBe(true);
  });

  it('should handle health check failures', async () => {
    const failingProvider = {
      ...mockProvider,
      id: 'failing-provider',
      client: {
        ...createMockClient(),
        healthCheck: async () => {
          throw new Error('Health check failed');
        },
      },
    };

    registry.register(failingProvider);

    const healthResults = await registry.healthCheck();
    expect(healthResults['failing-provider']).toBeDefined();
    expect(healthResults['failing-provider'].healthy).toBe(false);
    expect(healthResults['failing-provider'].errors).toContain('Health check failed');
  });

  it('should validate provider with missing required fields', () => {
    const invalidProvider = {
      ...mockProvider,
      name: '', // Invalid - empty name
    };

    const validation = registry.validateProvider(invalidProvider);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Provider name is required');
  });

  it('should validate provider with missing capabilities', () => {
    const invalidProvider = {
      ...mockProvider,
      capabilities: [], // Invalid - no capabilities
    };

    const validation = registry.validateProvider(invalidProvider);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('At least one capability is required');
  });

  it('should warn about missing rate limit', () => {
    const providerWithoutRateLimit = {
      ...mockProvider,
      id: 'no-rate-limit',
      rateLimit: undefined as any,
    };

    const validation = registry.validateProvider(providerWithoutRateLimit);
    expect(validation.warnings).toContain(
      'No rate limit specified - consider adding rate limiting'
    );
  });
});

function createMockClient(): DataSourceClient {
  return {
    async search(): Promise<SearchResult> {
      return {
        results: [
          {
            id: 'test-1',
            name: 'Test Result 1',
          },
        ],
        count: 1,
      };
    },

    async get(id: string): Promise<any> {
      return {
        id,
        name: `Test Result ${id}`,
      };
    },

    async batch(ids: string[]): Promise<any[]> {
      return ids.map((id) => ({
        id,
        name: `Test Result ${id}`,
      }));
    },

    async healthCheck() {
      return {
        healthy: true,
        responseTime: 100,
        lastCheck: new Date().toISOString(),
      };
    },
  };
}
