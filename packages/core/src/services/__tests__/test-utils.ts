/**
 * Test utilities and helpers for common testing patterns
 */

import type {
  DataSourceProvider,
  DataSourceClient,
  SearchResult,
  HealthStatus,
  DataSourceCapability,
  RateLimit,
  SearchParams,
  UnifiedOccurrence,
} from '../types';

/**
 * Creates a mock DataSourceClient for testing
 */
export function createMockClient(overrides?: Partial<DataSourceClient>): DataSourceClient {
  return {
    async search(params: SearchParams): Promise<SearchResult> {
      return {
        results: [createMockUnifiedOccurrence('test-1')],
        count: 1,
        totalCount: 1,
        endOfRecords: true,
      };
    },

    async get(id: string): Promise<any> {
      return createMockUnifiedOccurrence(id);
    },

    async batch(ids: string[]): Promise<any[]> {
      return ids.map((id) => createMockUnifiedOccurrence(id));
    },

    async healthCheck(): Promise<HealthStatus> {
      return {
        healthy: true,
        responseTime: 100,
        lastCheck: new Date().toISOString(),
      };
    },

    ...overrides,
  };
}

/**
 * Creates a mock DataSourceProvider for testing
 */
export function createMockProvider(
  id = 'test-provider',
  overrides?: Partial<DataSourceProvider>
): DataSourceProvider {
  const defaultCapabilities: DataSourceCapability[] = [
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
              limit: { type: 'number' },
            },
          },
        },
      ],
      filters: [
        { name: 'q', type: 'string', description: 'Query text' },
        { name: 'limit', type: 'number', description: 'Result limit' },
      ],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          scientificName: { type: 'string' },
        },
      },
      examples: [
        {
          description: 'Test query',
          query: 'test',
          parameters: { q: 'test', limit: 10 },
        },
      ],
    },
  ];

  const defaultRateLimit: RateLimit = {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerHour: 36000,
  };

  return {
    id,
    name: `Test Provider ${id}`,
    version: '1.0.0',
    capabilities: defaultCapabilities,
    client: createMockClient(),
    rateLimit: defaultRateLimit,
    ...overrides,
  };
}

/**
 * Creates multiple mock providers for testing
 */
export function createMockProviders(count: number): DataSourceProvider[] {
  return Array.from({ length: count }, (_, i) => createMockProvider(`test-provider-${i + 1}`));
}

/**
 * Creates a mock SearchResult for testing
 */
export function createMockSearchResult(
  resultCount = 5,
  overrides?: Partial<SearchResult>
): SearchResult {
  const results = Array.from({ length: resultCount }, (_, i) =>
    createMockUnifiedOccurrence(`result-${i + 1}`)
  );

  return {
    results,
    count: resultCount,
    totalCount: resultCount,
    endOfRecords: true,
    ...overrides,
  };
}

/**
 * Creates a mock UnifiedOccurrence for testing
 */
export function createMockUnifiedOccurrence(
  id = 'test-occurrence',
  overrides?: Partial<UnifiedOccurrence>
): UnifiedOccurrence {
  return {
    id,
    source: 'test-provider',
    sourceId: id,
    taxon: {
      scientificName: 'Testus mockus',
      canonicalName: 'Testus mockus',
      vernacularName: 'Test Plant',
      kingdom: 'Plantae',
      family: 'Testaceae',
      genus: 'Testus',
      species: 'mockus',
    },
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      country: 'United States',
      countryCode: 'US',
      stateProvince: 'New York',
      locality: 'Test Location',
    },
    observation: {
      eventDate: '2023-01-01',
      year: 2023,
      month: 1,
      day: 1,
      basisOfRecord: 'HUMAN_OBSERVATION',
      recordedBy: 'Test Observer',
    },
    metadata: {
      license: 'CC-BY',
      datasetName: 'Test Dataset',
      originalData: {},
    },
    confidence: 0.95,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Waits for a specified amount of time (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a spy function that tracks calls
 */
export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T
): T & { calls: any[][]; callCount: number; reset: () => void } {
  const calls: any[][] = [];

  const spy = ((...args: any[]) => {
    calls.push(args);
    return implementation ? implementation(...args) : undefined;
  }) as any;

  spy.calls = calls;
  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });
  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Asserts that a function throws an error
 */
export async function assertThrows(
  fn: () => any | Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  let thrown = false;
  let error: any;

  try {
    await fn();
  } catch (e) {
    thrown = true;
    error = e;
  }

  if (!thrown) {
    throw new Error('Expected function to throw an error');
  }

  if (expectedError) {
    const message = error?.message || String(error);
    if (typeof expectedError === 'string') {
      if (!message.includes(expectedError)) {
        throw new Error(
          `Expected error message to include "${expectedError}", but got "${message}"`
        );
      }
    } else if (expectedError instanceof RegExp) {
      if (!expectedError.test(message)) {
        throw new Error(`Expected error message to match ${expectedError}, but got "${message}"`);
      }
    }
  }
}

/**
 * Creates a mock capability for testing
 */
export function createMockCapability(
  type: DataSourceCapability['type'] = 'occurrence',
  overrides?: Partial<DataSourceCapability>
): DataSourceCapability {
  return {
    type,
    operations: [
      {
        name: 'search',
        description: 'Search operation',
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
      },
    },
    examples: [
      {
        description: 'Example query',
        query: 'test',
        parameters: { q: 'test' },
      },
    ],
    ...overrides,
  };
}
