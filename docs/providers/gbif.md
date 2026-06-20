# GBIF Provider Documentation

## Overview

The GBIF (Global Biodiversity Information Facility) provider is one of the core data sources for the Faces of Plants platform. GBIF provides access to over 1.5 billion biodiversity records from institutions worldwide, making it the largest source of scientific biodiversity data.

## Features

- **Comprehensive Coverage**: Access to occurrence records, species information, and taxonomic data
- **Scientific Quality**: Institutional-grade data with rigorous quality controls
- **Global Reach**: Data from museums, herbaria, and research institutions worldwide
- **Advanced Filtering**: Support for taxonomic, geographic, temporal, and quality filters

## API Specifications

### Base Information
- **Base URL**: `https://api.gbif.org/v1/`
- **Authentication**: Public API (no authentication required)
- **Rate Limits**: 
  - 1 request per second
  - 100 requests per minute
  - 10,000 requests per day
- **Data Format**: JSON

### Key Endpoints Used

#### 1. Species Search
```
GET /species/search
```
**Purpose**: Search for species by name, taxonomy, or other criteria
**Parameters**:
- `q`: Search query (species name, common name, etc.)
- `limit`: Maximum number of results (default: 20, max: 100)
- `offset`: Pagination offset
- `facet`: Enable faceted search results
- `kingdom`: Filter by taxonomic kingdom
- `phylum`: Filter by taxonomic phylum
- `class`: Filter by taxonomic class
- `order`: Filter by taxonomic order
- `family`: Filter by taxonomic family
- `genus`: Filter by taxonomic genus

#### 2. Occurrence Search
```
GET /occurrence/search
```
**Purpose**: Search for occurrence records (observations/specimens)
**Parameters**:
- `q`: Free text search
- `scientificName`: Exact or partial scientific name
- `country`: ISO country code (e.g., 'US', 'CA')
- `year`: Year of occurrence
- `month`: Month of occurrence
- `hasCoordinate`: Filter for records with coordinates
- `hasGeospatialIssue`: Filter for records with/without geospatial issues
- `limit`: Maximum number of results (default: 20, max: 300)
- `offset`: Pagination offset

#### 3. Species Details
```
GET /species/{key}
```
**Purpose**: Get detailed information about a specific species
**Parameters**:
- `key`: GBIF species key (numeric ID)

## Data Model

### UnifiedOccurrence Mapping

The GBIF provider maps GBIF occurrence records to our unified data model:

```typescript
interface UnifiedOccurrence {
  id: string;                    // GBIF occurrence key
  source: 'gbif';
  scientificName: string;        // GBIF scientificName
  commonName?: string;           // GBIF vernacularName
  kingdom?: string;              // GBIF kingdom
  phylum?: string;               // GBIF phylum
  class?: string;                // GBIF class
  order?: string;                // GBIF order
  family?: string;               // GBIF family
  genus?: string;                // GBIF genus
  species?: string;              // GBIF species
  location?: {
    country: string;             // GBIF country
    stateProvince?: string;      // GBIF stateProvince
    locality?: string;           // GBIF locality
    coordinates?: {
      latitude: number;          // GBIF decimalLatitude
      longitude: number;         // GBIF decimalLongitude
    };
  };
  date?: {
    year?: number;               // GBIF year
    month?: number;              // GBIF month
    day?: number;                // GBIF day
  };
  recordedBy?: string;           // GBIF recordedBy
  institutionCode?: string;      // GBIF institutionCode
  collectionCode?: string;       // GBIF collectionCode
  catalogNumber?: string;        // GBIF catalogNumber
  license?: string;              // GBIF license
  references?: string;           // GBIF references
  basisOfRecord?: string;        // GBIF basisOfRecord
  occurrenceStatus?: string;     // GBIF occurrenceStatus
  metadata: {
    source: 'gbif';
    originalId: string;          // GBIF occurrence key
    datasetKey?: string;         // GBIF datasetKey
    publishingOrgKey?: string;   // GBIF publishingOrgKey
    lastCrawled?: string;        // GBIF lastCrawled
    protocol?: string;           // GBIF protocol
    issues?: string[];           // GBIF issues array
  };
}
```

### Species Information Mapping

```typescript
interface SpeciesInfo {
  key: number;                   // GBIF species key
  scientificName: string;        // GBIF scientificName
  canonicalName?: string;        // GBIF canonicalName
  vernacularNames?: string[];    // GBIF vernacular names
  taxonomy: {
    kingdom?: string;            // GBIF kingdom
    phylum?: string;             // GBIF phylum
    class?: string;              // GBIF class
    order?: string;              // GBIF order
    family?: string;             // GBIF family
    genus?: string;              // GBIF genus
    species?: string;            // GBIF species
    rank?: string;               // GBIF rank
  };
  taxonomicStatus?: string;      // GBIF taxonomicStatus
  nomenclaturalStatus?: string;  // GBIF nomenclaturalStatus
  numDescendants?: number;       // GBIF numDescendants
  numOccurrences?: number;       // GBIF numOccurrences
  habitats?: string[];           // GBIF habitats
  threatStatuses?: string[];     // GBIF threat statuses
  descriptions?: string[];       // GBIF descriptions
  references?: string[];         // GBIF references
}
```

## Implementation Details

### Client Architecture

The GBIF provider is implemented with the following components:

#### 1. GBIF Client (`packages/functions/gbif/client.ts`)
- **Purpose**: Low-level HTTP client for GBIF API
- **Features**:
  - Rate limiting enforcement
  - Request/response transformation
  - Error handling and retries
  - Caching for commonly requested data

#### 2. GBIF Provider (`packages/functions/gbif/provider.ts`)
- **Purpose**: High-level provider interface conforming to the service abstraction
- **Features**:
  - Unified data model transformation
  - Query parameter mapping
  - Health check implementation
  - Capability reporting

### Key Features

#### Rate Limiting
```typescript
class GBIFClient {
  private rateLimiter = new RateLimiter({
    requestsPerSecond: 1,
    requestsPerMinute: 100,
    requestsPerDay: 10000
  });
  
  async makeRequest(endpoint: string, params?: any) {
    await this.rateLimiter.acquire();
    // ... make request
  }
}
```

#### Health Checks
```typescript
async healthCheck(): Promise<HealthStatus> {
  try {
    const response = await this.client.get('/species/search', { 
      q: 'test', 
      limit: 1 
    });
    
    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: response.responseTime,
      details: {
        endpoint: '/species/search',
        statusCode: response.status,
        rateLimit: this.rateLimiter.getStatus()
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message,
      details: { endpoint: '/species/search' }
    };
  }
}
```

#### Data Transformation
```typescript
private transformOccurrence(gbifRecord: any): UnifiedOccurrence {
  return {
    id: gbifRecord.key?.toString() || '',
    source: 'gbif',
    scientificName: gbifRecord.scientificName || '',
    commonName: gbifRecord.vernacularName,
    kingdom: gbifRecord.kingdom,
    phylum: gbifRecord.phylum,
    class: gbifRecord.class,
    order: gbifRecord.order,
    family: gbifRecord.family,
    genus: gbifRecord.genus,
    species: gbifRecord.species,
    location: this.extractLocation(gbifRecord),
    date: this.extractDate(gbifRecord),
    recordedBy: gbifRecord.recordedBy,
    institutionCode: gbifRecord.institutionCode,
    collectionCode: gbifRecord.collectionCode,
    catalogNumber: gbifRecord.catalogNumber,
    license: gbifRecord.license,
    references: gbifRecord.references,
    basisOfRecord: gbifRecord.basisOfRecord,
    occurrenceStatus: gbifRecord.occurrenceStatus,
    metadata: {
      source: 'gbif',
      originalId: gbifRecord.key?.toString() || '',
      datasetKey: gbifRecord.datasetKey,
      publishingOrgKey: gbifRecord.publishingOrgKey,
      lastCrawled: gbifRecord.lastCrawled,
      protocol: gbifRecord.protocol,
      issues: gbifRecord.issues || []
    }
  };
}
```

## Usage Examples

### Basic Species Search
```typescript
import { GBIFProvider } from './gbif/provider';

const provider = new GBIFProvider();

// Search for oak species
const results = await provider.search({
  query: 'Quercus',
  limit: 50,
  filters: {
    kingdom: 'Plantae',
    hasCoordinate: true
  }
});

console.log(`Found ${results.data.length} oak species`);
```

### Advanced Occurrence Search
```typescript
// Search for recent observations in the US
const results = await provider.search({
  query: 'oak',
  limit: 100,
  filters: {
    country: 'US',
    year: 2024,
    hasCoordinate: true,
    basisOfRecord: 'HUMAN_OBSERVATION'
  }
});

// Filter by specific region
const californiaResults = results.data.filter(
  record => record.location?.stateProvince === 'California'
);
```

### Health Monitoring
```typescript
// Check provider health
const health = await provider.healthCheck();

if (health.status === 'healthy') {
  console.log(`GBIF provider is healthy (${health.responseTime}ms)`);
} else {
  console.error(`GBIF provider is unhealthy: ${health.error}`);
}
```

## Error Handling

The GBIF provider handles various error conditions:

### API Errors
- **Rate Limit Exceeded**: Implements exponential backoff
- **Service Unavailable**: Retries with increasing delays
- **Invalid Parameters**: Returns descriptive error messages
- **Network Timeouts**: Configurable timeout with retries

### Data Quality Issues
- **Missing Required Fields**: Filters out incomplete records
- **Invalid Coordinates**: Validates latitude/longitude ranges
- **Inconsistent Taxonomy**: Flags taxonomic inconsistencies
- **Duplicate Records**: Deduplication based on key fields

## Performance Optimization

### Caching Strategy
- **Species Names**: Cache common species lookups for 24 hours
- **Taxonomic Hierarchy**: Cache family/genus hierarchies for 1 week
- **Static Data**: Cache country codes, basis of record types indefinitely

### Request Optimization
- **Batch Requests**: Combine multiple queries when possible
- **Pagination**: Efficient handling of large result sets
- **Field Selection**: Request only required fields to reduce payload size

## Best Practices

### Query Construction
1. **Be Specific**: Use scientific names when available
2. **Use Filters**: Apply appropriate filters to reduce result sets
3. **Validate Input**: Check query parameters before making requests
4. **Handle Pagination**: Implement proper pagination for large datasets

### Error Handling
1. **Graceful Degradation**: Continue with available data when possible
2. **User-Friendly Messages**: Translate API errors to user-friendly messages
3. **Logging**: Log errors for debugging and monitoring
4. **Retries**: Implement intelligent retry logic for transient failures

## Testing

### Unit Tests
```typescript
describe('GBIFProvider', () => {
  it('should search for species by name', async () => {
    const provider = new GBIFProvider();
    const results = await provider.search({ query: 'Quercus alba' });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].scientificName).toContain('Quercus');
  });
  
  it('should handle rate limiting', async () => {
    const provider = new GBIFProvider();
    
    // Make multiple rapid requests
    const promises = Array(10).fill(0).map(() => 
      provider.search({ query: 'test', limit: 1 })
    );
    
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe('GBIF Integration', () => {
  it('should return real data from GBIF API', async () => {
    const provider = new GBIFProvider();
    const results = await provider.search({ 
      query: 'Quercus alba',
      limit: 10 
    });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].source).toBe('gbif');
    expect(results.data[0].scientificName).toBeTruthy();
  });
});
```

## Monitoring and Observability

### Metrics to Track
- **Request Volume**: Number of requests per hour/day
- **Response Times**: Average and P95 response times
- **Error Rates**: Percentage of failed requests
- **Rate Limit Usage**: Current rate limit consumption
- **Data Quality**: Percentage of complete records

### Health Checks
- **API Availability**: Regular health check requests
- **Response Time**: Monitor for performance degradation
- **Error Patterns**: Track common error types
- **Rate Limit Status**: Monitor rate limit consumption

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - **Symptoms**: 429 HTTP status codes
   - **Solution**: Implement exponential backoff, reduce request frequency

2. **Empty Results**
   - **Symptoms**: Zero results for valid queries
   - **Solution**: Check query parameters, verify species names

3. **Slow Performance**
   - **Symptoms**: High response times
   - **Solution**: Optimize queries, implement caching, use pagination

4. **Data Quality Issues**
   - **Symptoms**: Incomplete or inconsistent data
   - **Solution**: Implement data validation, filter low-quality records

### Debug Mode
```typescript
const provider = new GBIFProvider({ debug: true });

// Enable detailed logging
provider.setLogLevel('debug');

// Monitor all requests
provider.on('request', (req) => {
  console.log('GBIF Request:', req.url, req.params);
});

provider.on('response', (res) => {
  console.log('GBIF Response:', res.status, res.data?.length);
});
```

## Future Enhancements

### Planned Features
1. **Advanced Caching**: Redis-based caching for high-traffic scenarios
2. **Batch Processing**: Bulk data import and processing capabilities
3. **Real-time Updates**: WebSocket support for real-time data updates
4. **Advanced Filtering**: More sophisticated filtering and search capabilities
5. **Data Validation**: Enhanced data quality checks and validation
6. **Performance Monitoring**: Detailed performance metrics and alerting

### Extension Points
- **Custom Transformations**: Plugin system for custom data transformations
- **Additional Endpoints**: Support for more GBIF API endpoints
- **Enhanced Caching**: Configurable caching strategies
- **Custom Rate Limiting**: Adaptive rate limiting based on API response
