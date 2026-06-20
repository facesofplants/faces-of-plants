# Development Guide

This guide provides comprehensive information for developers working on the Faces of Plants multi-source biodiversity data platform.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Adding New Providers](#adding-new-providers)
4. [Testing](#testing)
5. [Code Standards](#code-standards)
6. [Debugging](#debugging)
7. [Performance Optimization](#performance-optimization)
8. [Deployment](#deployment)

## Development Environment Setup

### Prerequisites

- **Node.js**: 18+ (recommended: use nvm)
- **Package Manager**: pnpm (recommended) or npm
- **TypeScript**: 5.8+
- **AWS CLI**: For deployment (optional)
- **Git**: Version control

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd faces-of-plants

# Install dependencies
pnpm install

# Verify installation
pnpm typecheck
pnpm test:core
```

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Development settings
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Optional: API keys for enhanced rate limits
GBIF_API_KEY=your_gbif_key
INATURALIST_API_KEY=your_inaturalist_key
EOL_API_KEY=your_eol_key

# AWS settings (for deployment)
AWS_REGION=us-east-1
AWS_PROFILE=default
```

### Development Commands

```bash
# Start development server
pnpm dev

# Type checking
pnpm typecheck

# Run tests
pnpm test:core

# Lint code
pnpm lint

# Format code
pnpm format
```

## Project Structure

### Monorepo Organization

```
faces-of-plants/
├── packages/
│   ├── core/                    # Core abstractions and types
│   ├── functions/               # Provider implementations
│   └── web/                     # Next.js frontend
├── stacks/                      # SST infrastructure
├── docs/                        # Documentation
└── tests/                       # Integration tests
```

### Core Package (`packages/core/`)

Contains the foundational types and abstractions:

```
packages/core/src/
├── services/
│   ├── types.ts                 # Core type definitions
│   ├── registry.ts              # Service registry
│   ├── queryEngine.ts           # Multi-source query engine
│   └── __tests__/               # Unit tests
└── types.ts                     # Shared application types
```

### Functions Package (`packages/functions/`)

Contains provider implementations and setup:

```
packages/functions/
├── gbif/
│   ├── client.ts                # GBIF API client
│   └── provider.ts              # GBIF provider implementation
├── inaturalist/
│   ├── client.ts                # iNaturalist API client
│   └── provider.ts              # iNaturalist provider implementation
├── eol/
│   ├── client.ts                # EOL API client
│   └── provider.ts              # EOL provider implementation
└── registry/
    └── setup.ts                 # Provider registration and setup
```

### Web Package (`packages/web/`)

Contains the Next.js frontend:

```
packages/web/src/
├── app/
│   ├── api/
│   │   └── multi-source/
│   │       └── route.ts         # Multi-source API endpoint
│   ├── multi-source-demo/
│   │   └── page.tsx             # Demo interface
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
└── hooks/
    └── useMultiSourceSearch.ts  # React hooks for API
```

## Adding New Providers

### Step 1: Define API Client

Create a new client in `packages/functions/your-provider/client.ts`:

```typescript
export interface YourProviderParams {
  query: string;
  limit?: number;
  // Provider-specific parameters
}

export interface YourProviderResponse {
  id: number;
  name: string;
  // Provider-specific response fields
}

export class YourProviderClient {
  private baseUrl = 'https://api.yourprovider.com/v1';

  async search(params: YourProviderParams): Promise<YourProviderResponse[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.append('q', params.query);
    if (params.limit) url.searchParams.append('limit', params.limit.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return { status: response.ok ? 'healthy' : 'unhealthy' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }
}
```

### Step 2: Implement Provider Interface

Create the provider in `packages/functions/your-provider/provider.ts`:

```typescript
import { 
  DataSourceProvider, 
  DataSourceClient, 
  UnifiedOccurrence, 
  SearchParams, 
  SearchResult,
  HealthStatus,
  DataSourceCapability,
  RateLimit 
} from '@faces-of-plants/core/src/services/types';
import { YourProviderClient, YourProviderResponse } from './client';

export class YourProvider implements DataSourceProvider {
  id = 'your-provider';
  name = 'Your Provider Name';
  version = '1.0.0';
  baseUrl = 'https://api.yourprovider.com/v1';
  
  capabilities: DataSourceCapability[] = [
    {
      type: 'occurrence',
      operations: [
        {
          name: 'search',
          description: 'Search for occurrences',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term' },
              limit: { type: 'number', description: 'Result limit' }
            }
          }
        }
      ],
      filters: [
        { name: 'query', type: 'string', description: 'Search query' }
      ],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' }
        }
      },
      examples: [
        {
          description: 'Basic search',
          query: 'oak trees',
          parameters: { query: 'quercus' },
          expectedResults: 50
        }
      ]
    }
  ];

  rateLimit: RateLimit = {
    requestsPerSecond: 1,
    requestsPerMinute: 60,
    requestsPerHour: 3600,
    burstLimit: 5
  };

  client: YourProviderDataSourceClient;

  constructor() {
    this.client = new YourProviderDataSourceClient();
  }
}

class YourProviderDataSourceClient implements DataSourceClient {
  private providerClient: YourProviderClient;

  constructor() {
    this.providerClient = new YourProviderClient();
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Transform generic params to provider-specific
      const providerParams = this.transformSearchParams(params);
      
      // Execute search
      const results = await this.providerClient.search(providerParams);
      
      // Transform results to unified format
      const unifiedResults = results.map(this.transformToUnified);
      
      return {
        results: unifiedResults,
        count: unifiedResults.length,
        totalCount: unifiedResults.length,
        endOfRecords: unifiedResults.length < (params.limit || 50),
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: this.calculateQueryComplexity(params)
        }
      };
    } catch (error) {
      console.error('[YourProvider] Search error:', error);
      throw error;
    }
  }

  async get(id: string): Promise<UnifiedOccurrence> {
    // Implement single record retrieval
    throw new Error('Method not implemented');
  }

  async batch(ids: string[]): Promise<UnifiedOccurrence[]> {
    // Implement batch retrieval
    const results = await Promise.all(ids.map(id => this.get(id)));
    return results;
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const health = await this.providerClient.healthCheck();
      
      return {
        healthy: health.status === 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: health.status === 'unhealthy' ? [health.message || 'Unknown error'] : undefined
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private transformSearchParams(params: SearchParams): YourProviderParams {
    return {
      query: params.query || '',
      limit: params.limit || 50
      // Map other parameters as needed
    };
  }

  private transformToUnified(item: YourProviderResponse): UnifiedOccurrence {
    return {
      id: `your-provider:${item.id}`,
      source: 'your-provider',
      sourceId: item.id.toString(),
      taxon: {
        scientificName: item.name
        // Map taxonomic data
      },
      location: {
        // Map location data if available
      },
      observation: {
        basisOfRecord: 'UNKNOWN'
        // Map observation data
      },
      metadata: {
        datasetName: 'Your Provider Dataset',
        publisher: 'Your Provider',
        originalData: item
      },
      confidence: this.calculateConfidence(item),
      lastUpdated: new Date().toISOString(),
      extensions: {
        // Provider-specific extensions
        originalData: item
      }
    };
  }

  private calculateConfidence(item: YourProviderResponse): number {
    // Implement confidence calculation based on data quality indicators
    return 0.5; // Base confidence
  }

  private calculateQueryComplexity(params: SearchParams): number {
    let complexity = 1;
    if (params.query) complexity += 1;
    if (params.filters) complexity += Object.keys(params.filters).length;
    return complexity;
  }
}

export { YourProviderDataSourceClient };
```

### Step 3: Register the Provider

Add your provider to `packages/functions/registry/setup.ts`:

```typescript
import { YourProvider } from '../your-provider/provider';

export async function initializeProviders(): Promise<void> {
  console.log('[ServiceRegistry] Initializing providers...');
  
  try {
    // ... existing providers
    
    // Register your provider
    const yourProvider = new YourProvider();
    serviceRegistry.register(yourProvider);
    
    console.log('[ServiceRegistry] All providers registered successfully');
    
    await performHealthChecks();
    
  } catch (error) {
    console.error('[ServiceRegistry] Failed to initialize providers:', error);
    throw error;
  }
}
```

### Step 4: Add Tests

Create tests in `packages/core/src/services/__tests__/your-provider.test.ts`:

```typescript
import { YourProvider, YourProviderDataSourceClient } from '../../../functions/your-provider/provider';

describe('YourProvider', () => {
  let provider: YourProvider;
  let client: YourProviderDataSourceClient;

  beforeEach(() => {
    provider = new YourProvider();
    client = provider.client as YourProviderDataSourceClient;
  });

  test('should have correct provider metadata', () => {
    expect(provider.id).toBe('your-provider');
    expect(provider.name).toBe('Your Provider Name');
    expect(provider.version).toBe('1.0.0');
    expect(provider.capabilities.length).toBeGreaterThan(0);
  });

  test('should perform health check', async () => {
    const health = await client.healthCheck();
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('responseTime');
    expect(health).toHaveProperty('lastCheck');
  });

  test('should search and return unified results', async () => {
    const searchParams = { query: 'test', limit: 10 };
    const result = await client.search(searchParams);
    
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('metadata');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
```

## Testing

### Test Structure

```
packages/core/src/services/__tests__/
├── AbstractionLayer.test.ts     # Core abstraction tests
├── registry.test.ts             # Service registry tests
├── integration.test.ts          # Multi-provider integration tests
└── your-provider.test.ts        # Provider-specific tests
```

### Running Tests

```bash
# Run all tests
pnpm test:core

# Run specific test file
pnpm exec jest packages/core/src/services/__tests__/registry.test.ts

# Run tests in watch mode
pnpm exec jest --watch

# Run tests with coverage
pnpm exec jest --coverage
```

### Test Patterns

#### Provider Tests

```typescript
describe('ProviderName', () => {
  let provider: ProviderClass;

  beforeEach(() => {
    provider = new ProviderClass();
  });

  test('should implement required interfaces', () => {
    expect(provider).toHaveProperty('id');
    expect(provider).toHaveProperty('client');
    expect(provider.capabilities.length).toBeGreaterThan(0);
  });

  test('should handle search queries', async () => {
    const params = { query: 'test' };
    const result = await provider.client.search(params);
    
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });
});
```

#### Integration Tests

```typescript
describe('Multi-Provider Integration', () => {
  test('should register and query multiple providers', async () => {
    const registry = new ServiceRegistry();
    
    // Register providers
    registry.register(new Provider1());
    registry.register(new Provider2());
    
    // Test capabilities
    const providers = registry.findProvidersWithCapability('occurrence');
    expect(providers.length).toBe(2);
  });
});
```

### Mocking External APIs

```typescript
// Mock fetch for testing
global.fetch = jest.fn();

beforeEach(() => {
  (fetch as jest.MockedFunction<typeof fetch>).mockClear();
});

test('should handle API responses', async () => {
  (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ results: [{ id: 1, name: 'test' }] })
  } as Response);

  const client = new YourProviderClient();
  const results = await client.search({ query: 'test' });
  
  expect(results).toHaveLength(1);
  expect(results[0].name).toBe('test');
});
```

## Code Standards

### TypeScript Guidelines

1. **Strict Type Checking**: All code must pass `tsc --noEmit`
2. **Interface Definitions**: Use interfaces for public APIs
3. **Null Safety**: Handle undefined/null cases explicitly
4. **Generic Types**: Use generics for reusable components

```typescript
// Good: Explicit return type and error handling
async function fetchData(id: string): Promise<DataType | null> {
  try {
    const response = await api.getData(id);
    return response.data ?? null;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null;
  }
}

// Good: Generic interface
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
```

### Naming Conventions

- **Files**: kebab-case (`your-provider.ts`)
- **Classes**: PascalCase (`YourProvider`)
- **Functions**: camelCase (`transformToUnified`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_LIMIT`)
- **Interfaces**: PascalCase with 'I' prefix optional (`DataSourceProvider`)

### Error Handling

```typescript
// Custom error classes
class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Usage
throw new ProviderError(
  'API rate limit exceeded',
  'gbif',
  'RATE_LIMIT',
  true
);
```

### Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Searches for biodiversity occurrences across multiple data sources.
 * 
 * @param params - Search parameters including query and filters
 * @returns Promise resolving to search results
 * @throws {ProviderError} When all providers fail
 * 
 * @example
 * ```typescript
 * const results = await search({ query: 'quercus', limit: 50 });
 * console.log(`Found ${results.totalResults} occurrences`);
 * ```
 */
async function search(params: SearchParams): Promise<SearchResult> {
  // Implementation
}
```

## Debugging

### Development Tools

1. **VS Code Extensions**:
   - TypeScript and JavaScript Language Features
   - ESLint
   - Prettier
   - Jest Test Explorer

2. **Browser DevTools**:
   - Network tab for API debugging
   - Console for error investigation
   - React DevTools for component debugging

### Logging

Use structured logging with correlation IDs:

```typescript
import { randomUUID } from 'crypto';

class Logger {
  private correlationId = randomUUID();

  info(message: string, data?: any) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      data,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    }));
  }

  error(message: string, error?: Error) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    }));
  }
}
```

### Common Issues

#### Rate Limiting

```typescript
// Debug rate limiting issues
const rateLimiter = new RateLimiter(provider.rateLimit);
await rateLimiter.waitForToken(); // Add breakpoint here
```

#### API Response Mapping

```typescript
// Debug data transformation
console.log('Original API response:', originalData);
const unified = transformToUnified(originalData);
console.log('Unified format:', unified);
```

#### Provider Health

```typescript
// Debug provider connectivity
const health = await provider.client.healthCheck();
console.log(`Provider ${provider.id} health:`, health);
```

## Performance Optimization

### Query Optimization

1. **Concurrent Execution**: Use `Promise.allSettled()` for multi-provider queries
2. **Result Streaming**: Process results as they arrive
3. **Pagination**: Implement efficient pagination strategies

```typescript
async function optimizedSearch(params: SearchParams): Promise<SearchResult> {
  const providers = getActiveProviders();
  
  // Execute queries concurrently
  const promises = providers.map(async (provider) => {
    try {
      return await provider.client.search(params);
    } catch (error) {
      console.warn(`Provider ${provider.id} failed:`, error);
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  
  // Process successful results
  const successfulResults = results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => (result as PromiseFulfilledResult<SearchResult>).value);

  return mergeResults(successfulResults);
}
```

### Caching Strategies

```typescript
class CacheManager {
  private cache = new Map<string, { data: any; expiry: number }>();

  async get<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 300000): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
    
    return data;
  }
}
```

### Memory Management

```typescript
// Use generators for large result sets
async function* searchGenerator(params: SearchParams): AsyncGenerator<UnifiedOccurrence> {
  const providers = getActiveProviders();
  
  for (const provider of providers) {
    try {
      const result = await provider.client.search(params);
      for (const occurrence of result.results) {
        yield occurrence;
      }
    } catch (error) {
      console.warn(`Provider ${provider.id} failed:`, error);
    }
  }
}
```

## Deployment

### Environment Configuration

Create environment-specific configurations:

```typescript
// config/environments.ts
export const environments = {
  development: {
    apiUrl: 'http://localhost:3000',
    logLevel: 'debug',
    providers: {
      gbif: { timeout: 10000 },
      inaturalist: { timeout: 8000 },
      eol: { timeout: 12000 }
    }
  },
  production: {
    apiUrl: 'https://facesofplants.org',
    logLevel: 'info',
    providers: {
      gbif: { timeout: 5000 },
      inaturalist: { timeout: 5000 },
      eol: { timeout: 5000 }
    }
  }
};
```

### Build Process

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test:core

# Build for production
pnpm build

# Deploy with SST
pnpm deploy
```

### Monitoring

Implement health checks and monitoring:

```typescript
// Health check endpoint
export async function healthCheck() {
  const providers = getRegisteredProviders();
  const healthChecks = await Promise.allSettled(
    providers.map(p => p.client.healthCheck())
  );

  const healthy = healthChecks.filter(
    result => result.status === 'fulfilled' && result.value.healthy
  ).length;

  return {
    status: healthy === providers.length ? 'healthy' : 'degraded',
    providers: providers.length,
    healthy,
    timestamp: new Date().toISOString()
  };
}
```

---

This development guide provides the foundation for extending and maintaining the multi-source biodiversity data platform. For additional questions or clarifications, refer to the API documentation and architecture overview.
