# Architecture Overview

This document provides a comprehensive overview of the Faces of Plants multi-source biodiversity data platform architecture.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Service Abstraction Layer](#service-abstraction-layer)
3. [Data Flow](#data-flow)
4. [Provider Integration](#provider-integration)
5. [Type System](#type-system)
6. [Performance Considerations](#performance-considerations)
7. [Error Handling](#error-handling)
8. [Extensibility](#extensibility)

## System Architecture

The platform follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                  Presentation Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Next.js Pages   │  │  React Hooks    │  │   Components    │ │
│  │ - Demo UI       │  │ - useMultiSource│  │ - Search Forms  │ │
│  │ - API Routes    │  │ - useHealth     │  │ - Result Cards  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Multi-Source API Endpoint                 │ │
│  │ - Request validation and routing                       │ │
│  │ - Response formatting and error handling               │ │
│  │ - Provider initialization and health checks            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Service Registry│  │  Query Engine   │  │  Abstractions   │ │
│  │ - Provider mgmt │  │ - Multi-source  │  │ - Common types  │ │
│  │ - Health checks │  │ - Orchestration │  │ - Interfaces    │ │
│  │ - Capabilities  │  │ - Deduplication │  │ - Validation    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Provider Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ GBIF Provider   │  │ iNat Provider   │  │  EOL Provider   │ │
│  │ - API client    │  │ - API client    │  │ - API client    │ │
│  │ - Data mapping  │  │ - Data mapping  │  │ - Data mapping  │ │
│  │ - Rate limiting │  │ - Rate limiting │  │ - Rate limiting │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External APIs                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   GBIF API      │  │ iNaturalist API │  │    EOL API      │ │
│  │ api.gbif.org    │  │ api.inaturalist │  │   eol.org       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Service Abstraction Layer

The service abstraction layer is the core of the platform's extensibility, providing:

### Core Interfaces

#### DataSourceProvider
```typescript
interface DataSourceProvider {
  id: string;                    // Unique provider identifier
  name: string;                  // Human-readable name
  version: string;               // Provider version
  baseUrl: string;              // API base URL
  capabilities: DataSourceCapability[]; // What the provider can do
  rateLimit: RateLimit;         // Rate limiting configuration
  client: DataSourceClient;     // Client implementation
}
```

#### DataSourceClient
```typescript
interface DataSourceClient {
  search(params: SearchParams): Promise<SearchResult>;
  get(id: string): Promise<UnifiedOccurrence>;
  batch(ids: string[]): Promise<UnifiedOccurrence[]>;
  healthCheck(): Promise<HealthStatus>;
}
```

#### UnifiedOccurrence
```typescript
interface UnifiedOccurrence {
  id: string;                   // Unified identifier
  source: string;               // Source provider
  sourceId: string;             // Original ID from source
  taxon: TaxonInfo;            // Taxonomic information
  location: LocationInfo;       // Geographic information
  observation: ObservationInfo; // Observation details
  metadata: MetadataInfo;       // Additional metadata
  confidence: number;           // Data quality score
  lastUpdated: string;          // Last modification date
  extensions?: Record<string, any>; // Provider-specific data
}
```

### Service Registry

The `ServiceRegistry` class manages provider lifecycle:

```typescript
class ServiceRegistry {
  // Provider management
  register(provider: DataSourceProvider): void;
  unregister(providerId: string): void;
  getProvider(id: string): DataSourceProvider | undefined;
  getProviders(): DataSourceProvider[];
  
  // Capability discovery
  findProvidersWithCapability(type: string): DataSourceProvider[];
  findProvidersWithOperation(operation: string): DataSourceProvider[];
  
  // Health monitoring
  healthCheck(): Promise<Record<string, HealthStatus>>;
  getHealthStatus(): Record<string, HealthStatus>;
  
  // Statistics and validation
  getRegistryInfo(): RegistryInfo;
  validateProvider(provider: DataSourceProvider): ValidationResult;
}
```

## Data Flow

### Query Processing Flow

1. **Request Reception**
   - API endpoint receives query request
   - Validates input parameters
   - Initializes providers if needed

2. **Provider Selection**
   - Determines which providers to query
   - Applies capability filtering
   - Checks provider health status

3. **Query Orchestration**
   - Transforms generic query to provider-specific format
   - Executes concurrent queries with rate limiting
   - Handles timeouts and retries

4. **Result Processing**
   - Normalizes results to unified format
   - Applies deduplication logic
   - Merges results based on strategy

5. **Response Formation**
   - Formats final response
   - Includes metadata and statistics
   - Handles errors gracefully

### Data Transformation Pipeline

```
External API Response → Provider-specific Mapping → Unified Format → Result Merging → Final Response
```

Each provider implements transformation logic:

```typescript
private transformToUnified(sourceData: ExternalAPIResponse): UnifiedOccurrence {
  return {
    id: `${this.id}:${sourceData.id}`,
    source: this.id,
    sourceId: sourceData.id.toString(),
    taxon: this.mapTaxonData(sourceData),
    location: this.mapLocationData(sourceData),
    observation: this.mapObservationData(sourceData),
    metadata: this.mapMetadata(sourceData),
    confidence: this.calculateConfidence(sourceData),
    lastUpdated: sourceData.lastModified || new Date().toISOString(),
    extensions: sourceData // Preserve original data
  };
}
```

## Provider Integration

### GBIF Provider

**Strengths:**
- Comprehensive taxonomic hierarchy
- Large institutional datasets
- High-quality scientific records
- Extensive occurrence data

**Implementation Details:**
- Uses GBIF Occurrence API v1
- Handles complex taxonomic queries
- Maps Darwin Core fields
- Implements occurrence-based confidence scoring

**Rate Limiting:**
- 1 request/second (sustainable)
- 100 requests/minute (burst)
- 10,000 requests/hour (daily limit)

### iNaturalist Provider

**Strengths:**
- Recent community observations
- High-quality photographs
- Validated identifications
- Real-time data updates

**Implementation Details:**
- Uses iNaturalist API v1
- Filters for research-grade observations
- Maps community identification data
- Implements photo-based confidence scoring

**Rate Limiting:**
- 2 requests/second
- 60 requests/minute
- 3,600 requests/hour

### Encyclopedia of Life Provider

**Strengths:**
- Comprehensive species information
- Rich media collections
- Taxonomic relationships
- Authoritative content

**Implementation Details:**
- Uses EOL API v1
- Aggregates page and media data
- Maps vernacular names
- Implements richness-based confidence scoring

**Rate Limiting:**
- 1 request/second
- 30 requests/minute
- 1,000 requests/hour

## Type System

The platform uses TypeScript extensively for type safety:

### Core Type Hierarchy

```
DataSourceProvider
├── DataSourceClient
├── DataSourceCapability[]
├── RateLimit
└── HealthStatus

UnifiedOccurrence
├── TaxonInfo
├── LocationInfo
├── ObservationInfo
├── MetadataInfo
└── extensions

SearchParams
├── query: string
├── filters: Record<string, any>
├── limit: number
├── offset: number
└── sort: SortOption[]

SearchResult
├── results: UnifiedOccurrence[]
├── count: number
├── totalCount: number
├── endOfRecords: boolean
└── metadata: SearchMetadata
```

### Provider-Specific Types

Each provider defines its own API types:

```typescript
// GBIF
interface GBIFOccurrence {
  key: number;
  scientificName: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  // ... other GBIF fields
}

// iNaturalist
interface iNaturalistObservation {
  id: number;
  observed_on: string;
  location: [number, number];
  taxon: any;
  // ... other iNaturalist fields
}

// EOL
interface EOLPage {
  identifier: number;
  scientificName: string;
  dataObjects: EOLDataObject[];
  // ... other EOL fields
}
```

## Performance Considerations

### Concurrent Processing

- Queries execute in parallel across providers
- Promise.allSettled used for fault tolerance
- Results streamed as they arrive

### Rate Limiting

Each provider implements intelligent rate limiting:

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  async waitForToken(): Promise<void> {
    this.refillTokens();
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }
    this.tokens--;
  }
}
```

### Caching Strategy

- Provider health status cached for 5 minutes
- Registry information cached for 1 hour
- Query results can be cached based on configuration

### Memory Management

- Streaming results for large datasets
- Pagination support to limit memory usage
- Automatic cleanup of expired cache entries

## Error Handling

### Error Hierarchy

```typescript
abstract class DataSourceError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
}

class NetworkError extends DataSourceError {
  readonly code = 'NETWORK_ERROR';
  readonly retryable = true;
}

class AuthenticationError extends DataSourceError {
  readonly code = 'AUTH_ERROR';
  readonly retryable = false;
}

class RateLimitError extends DataSourceError {
  readonly code = 'RATE_LIMIT';
  readonly retryable = true;
}
```

### Graceful Degradation

- Continues with available providers if some fail
- Returns partial results with error information
- Maintains service availability during provider outages

### Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      await new Promise(resolve => 
        setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1))
      );
    }
  }
}
```

## Extensibility

### Adding New Providers

1. **Define API Client**
   ```typescript
   export class NewProviderClient {
     async search(params: NewProviderParams): Promise<NewProviderResult> {
       // Implementation
     }
   }
   ```

2. **Implement Provider Interface**
   ```typescript
   export class NewProvider implements DataSourceProvider {
     id = 'new-provider';
     name = 'New Provider';
     // ... other required fields
   }
   ```

3. **Register Provider**
   ```typescript
   const newProvider = new NewProvider();
   serviceRegistry.register(newProvider);
   ```

### Capability Extensions

Add new capability types by extending the core types:

```typescript
interface CustomCapability extends DataSourceCapability {
  type: 'traits' | 'conservation' | 'genetics';
  // Additional fields
}
```

### Custom Data Extensions

Providers can include custom data in the `extensions` field:

```typescript
{
  id: 'provider:123',
  // ... standard fields
  extensions: {
    providerSpecificField: 'value',
    customMetrics: { score: 0.95 },
    originalResponse: { /* full API response */ }
  }
}
```

### Plugin Architecture

Future versions will support plugin-based extensions:

```typescript
interface DataSourcePlugin {
  name: string;
  version: string;
  install(registry: ServiceRegistry): void;
  uninstall(registry: ServiceRegistry): void;
}
```

## Security Considerations

### API Key Management

- Environment variable configuration
- Secure storage in production
- Rotation and expiration handling

### Rate Limiting Compliance

- Respect provider terms of service
- Implement circuit breakers
- Monitor usage patterns

### Data Privacy

- No storage of sensitive user data
- Transparent data source attribution
- Compliance with provider policies

## Monitoring and Observability

### Health Checks

- Provider availability monitoring
- Response time tracking
- Error rate monitoring

### Metrics Collection

- Query volume and patterns
- Provider performance statistics
- Error analysis and trends

### Logging

- Structured logging with correlation IDs
- Error tracking and alerting
- Performance profiling

---

This architecture provides a solid foundation for multi-source biodiversity data integration while maintaining flexibility for future enhancements and new provider additions.
