# API Reference

This document provides comprehensive documentation for the Faces of Plants multi-source biodiversity data API.

## Table of Contents

1. [Base URL](#base-url)
2. [Authentication](#authentication)
3. [Multi-Source Endpoints](#multi-source-endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

## Base URL

**Development:** `http://localhost:3000`  
**Production:** `https://your-domain.com`

## Authentication

Currently, the API does not require authentication for public data access. Provider-specific rate limits apply.

## Multi-Source Endpoints

### Query Data Sources

Query across multiple biodiversity data sources with unified results.

#### `GET /api/multi-source`

Simple query interface with URL parameters.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search term (species name, keyword) |
| `sources` | string | No | Comma-separated provider IDs (`gbif,inaturalist,eol`) |
| `limit` | integer | No | Maximum results per source (default: 50, max: 200) |
| `offset` | integer | No | Results offset for pagination (default: 0) |
| `action` | string | No | Special actions: `sources`, `health`, `stats`, `info` |

**Example Request:**
```http
GET /api/multi-source?query=quercus&sources=gbif,inaturalist&limit=25
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "gbif:2878688123",
        "source": "gbif",
        "sourceId": "2878688123",
        "taxon": {
          "scientificName": "Quercus alba",
          "canonicalName": "Quercus alba",
          "vernacularName": "White Oak",
          "kingdom": "Plantae",
          "family": "Fagaceae",
          "genus": "Quercus",
          "species": "Quercus alba",
          "taxonRank": "SPECIES"
        },
        "location": {
          "latitude": 40.7589,
          "longitude": -73.9851,
          "country": "United States"
        },
        "observation": {
          "eventDate": "2024-06-15",
          "year": 2024,
          "basisOfRecord": "HUMAN_OBSERVATION"
        },
        "confidence": 0.95,
        "lastUpdated": "2024-06-15T10:30:00Z"
      }
    ],
    "totalResults": 1247,
    "sources": ["gbif", "inaturalist"],
    "executionTime": 1250,
    "pagination": {
      "offset": 0,
      "limit": 25,
      "hasMore": true
    }
  }
}
```

#### `POST /api/multi-source`

Advanced query interface with request body configuration.

**Request Body:**
```json
{
  "query": "oak trees",
  "sources": ["gbif", "inaturalist", "eol"],
  "filters": {
    "country": "US",
    "year": 2024,
    "hasImages": true,
    "taxonRank": "SPECIES"
  },
  "options": {
    "maxResults": 100,
    "timeout": 30000,
    "mergeStrategy": "union",
    "deduplication": true,
    "requireAllSources": false
  }
}
```

**Response:** Same format as GET request.

### System Information

#### `GET /api/multi-source?action=sources`

Get information about available data sources.

**Response:**
```json
{
  "success": true,
  "data": {
    "sources": [
      {
        "id": "gbif",
        "name": "Global Biodiversity Information Facility",
        "version": "1.0.0",
        "baseUrl": "https://api.gbif.org/v1",
        "capabilities": [
          {
            "type": "occurrence",
            "operations": ["search", "get", "batch"],
            "filters": ["country", "year", "taxonKey"]
          }
        ],
        "rateLimit": {
          "requestsPerSecond": 1,
          "requestsPerMinute": 100,
          "requestsPerHour": 10000
        }
      }
    ],
    "totalSources": 3
  }
}
```

#### `GET /api/multi-source?action=health`

Check the health status of all providers.

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": {
      "status": "healthy",
      "totalProviders": 3,
      "healthyProviders": 3,
      "lastCheck": "2024-07-04T15:30:00Z"
    },
    "sources": {
      "gbif": {
        "healthy": true,
        "responseTime": 245,
        "lastCheck": "2024-07-04T15:30:00Z"
      },
      "inaturalist": {
        "healthy": true,
        "responseTime": 189,
        "lastCheck": "2024-07-04T15:30:00Z"
      },
      "eol": {
        "healthy": false,
        "responseTime": 5000,
        "lastCheck": "2024-07-04T15:30:00Z",
        "errors": ["Connection timeout"]
      }
    }
  }
}
```

#### `GET /api/multi-source?action=stats`

Get provider statistics and performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "registry": {
      "totalProviders": 3,
      "healthyProviders": 3,
      "lastHealthCheck": "2024-07-04T15:30:00Z",
      "capabilities": {
        "occurrence": 3,
        "images": 2,
        "taxonomy": 3
      }
    },
    "providers": [
      {
        "id": "gbif",
        "name": "Global Biodiversity Information Facility",
        "version": "1.0.0",
        "capabilities": 3,
        "healthy": true,
        "lastCheck": "2024-07-04T15:30:00Z",
        "responseTime": 245
      }
    ]
  }
}
```

#### `GET /api/multi-source?action=info`

Get general API information and available endpoints.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Multi-Source Biodiversity Data API",
    "version": "1.0.0",
    "description": "Unified API for querying multiple biodiversity data sources",
    "registry": {
      "totalProviders": 3,
      "healthyProviders": 3,
      "capabilities": {
        "occurrence": 3,
        "images": 2,
        "taxonomy": 3
      }
    },
    "endpoints": {
      "query": "POST /api/multi-source",
      "sources": "GET /api/multi-source?action=sources",
      "health": "GET /api/multi-source?action=health",
      "stats": "GET /api/multi-source?action=stats"
    }
  }
}
```

## Data Models

### UnifiedOccurrence

The standardized occurrence record format used across all providers.

```typescript
interface UnifiedOccurrence {
  id: string;                    // Unique identifier: "provider:originalId"
  source: string;                // Provider ID (gbif, inaturalist, eol)
  sourceId: string;              // Original ID from the source
  taxon: TaxonInfo;             // Taxonomic information
  location?: LocationInfo;       // Geographic information
  observation: ObservationInfo;  // Observation details
  metadata: MetadataInfo;        // Additional metadata
  confidence: number;            // Quality confidence score (0-1)
  lastUpdated: string;           // ISO 8601 timestamp
  extensions?: Record<string, any>; // Provider-specific data
}
```

### TaxonInfo

Taxonomic classification information.

```typescript
interface TaxonInfo {
  scientificName?: string;       // Full scientific name
  canonicalName?: string;        // Canonical form of scientific name
  vernacularName?: string;       // Common name
  kingdom?: string;              // Kingdom
  phylum?: string;               // Phylum
  class?: string;                // Class
  order?: string;                // Order
  family?: string;               // Family
  genus?: string;                // Genus
  species?: string;              // Species
  taxonRank?: string;            // Taxonomic rank
  taxonomicStatus?: string;      // Status (accepted, synonym, etc.)
  taxonKey?: string;             // External taxonomy key
}
```

### LocationInfo

Geographic and location information.

```typescript
interface LocationInfo {
  latitude?: number;             // Decimal latitude
  longitude?: number;            // Decimal longitude
  coordinateUncertainty?: number; // Uncertainty in meters
  country?: string;              // Country name
  stateProvince?: string;        // State or province
  locality?: string;             // Specific locality description
  elevation?: number;            // Elevation in meters
  depth?: number;                // Depth in meters (for marine)
}
```

### ObservationInfo

Details about the observation or specimen.

```typescript
interface ObservationInfo {
  eventDate?: string;            // Date of observation (ISO 8601)
  year?: number;                 // Year of observation
  month?: number;                // Month of observation
  day?: number;                  // Day of observation
  basisOfRecord?: string;        // Type of record (HUMAN_OBSERVATION, etc.)
  recordedBy?: string;           // Observer/collector
  identifiedBy?: string;         // Identifier
  individualCount?: number;      // Number of individuals
  lifeStage?: string;            // Life stage
  sex?: string;                  // Sex
  establishmentMeans?: string;   // How species was established
  associatedMedia?: string[];    // URLs to images, sounds, etc.
}
```

### MetadataInfo

Additional metadata and provenance information.

```typescript
interface MetadataInfo {
  license?: string;              // Data license
  rightsHolder?: string;         // Rights holder
  datasetName?: string;          // Source dataset name
  publisher?: string;            // Data publisher
  references?: string;           // Reference URL
  originalData?: any;            // Original API response
  processingNotes?: string[];    // Processing information
}
```

### SearchParams

Parameters for searching across data sources.

```typescript
interface SearchParams {
  query?: string;                // Free text search
  limit?: number;                // Maximum results (default: 50)
  offset?: number;               // Pagination offset (default: 0)
  filters?: Record<string, any>; // Provider-specific filters
  sort?: SortOption[];           // Sorting preferences
}
```

### SearchResult

Response format for search operations.

```typescript
interface SearchResult {
  results: UnifiedOccurrence[];  // Array of occurrence records
  count: number;                 // Number of results returned
  totalCount?: number;           // Total available results
  endOfRecords: boolean;         // Whether more results available
  metadata?: SearchMetadata;     // Search execution metadata
}
```

### SearchMetadata

Metadata about search execution.

```typescript
interface SearchMetadata {
  executionTime: number;         // Query execution time (ms)
  cacheHit: boolean;            // Whether result was cached
  dataSourceVersion: string;     // Provider version used
  queryComplexity: number;       // Complexity score
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error type or message",
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details",
    "timestamp": "2024-07-04T15:30:00Z"
  }
}
```

### HTTP Status Codes

| Code | Description | When Used |
|------|-------------|-----------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid parameters or request format |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | All providers unavailable |

### Common Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `MISSING_QUERY` | Query parameter required | No |
| `INVALID_SOURCES` | Invalid provider IDs specified | No |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Yes |
| `PROVIDER_UNAVAILABLE` | One or more providers unavailable | Yes |
| `TIMEOUT` | Request timeout | Yes |
| `VALIDATION_ERROR` | Parameter validation failed | No |

## Rate Limiting

### Provider-Specific Limits

Each provider has its own rate limiting configuration:

| Provider | Requests/Second | Requests/Minute | Requests/Hour |
|----------|----------------|-----------------|---------------|
| GBIF | 1 | 100 | 10,000 |
| iNaturalist | 2 | 60 | 3,600 |
| EOL | 1 | 30 | 1,000 |

### Rate Limit Headers

When rate limits are approached, responses include headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1625481600
X-RateLimit-Provider: gbif
```

## Examples

### Basic Species Search

Search for oak trees across all sources:

```bash
curl "https://api.example.com/api/multi-source?query=quercus&limit=10"
```

### Filtered Search

Search for recent observations with images:

```bash
curl -X POST "https://api.example.com/api/multi-source" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "quercus alba",
    "sources": ["gbif", "inaturalist"],
    "filters": {
      "year": 2024,
      "hasImages": true,
      "country": "US"
    },
    "options": {
      "maxResults": 50,
      "deduplication": true
    }
  }'
```

### Geographic Search

Search within a specific geographic area:

```bash
curl -X POST "https://api.example.com/api/multi-source" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "plantae",
    "filters": {
      "lat": 40.7589,
      "lng": -73.9851,
      "radius": 10
    },
    "options": {
      "maxResults": 25
    }
  }'
```

### Health Check

Check system health:

```bash
curl "https://api.example.com/api/multi-source?action=health"
```

### Provider Information

Get available providers:

```bash
curl "https://api.example.com/api/multi-source?action=sources"
```

### JavaScript/TypeScript Usage

```typescript
import { useState, useEffect } from 'react';

interface SearchResult {
  success: boolean;
  data: {
    results: any[];
    totalResults: number;
    sources: string[];
  };
}

function useMultiSourceSearch() {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string, sources?: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query,
        ...(sources && { sources: sources.join(',') })
      });

      const response = await fetch(`/api/multi-source?${params}`);
      const data = await response.json();

      if (data.success) {
        setResults(data);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, search };
}

// Usage
function SearchComponent() {
  const { results, loading, error, search } = useMultiSourceSearch();

  useEffect(() => {
    search('quercus', ['gbif', 'inaturalist']);
  }, []);

  if (loading) return <div>Searching...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!results) return <div>No results</div>;

  return (
    <div>
      <h2>Found {results.data.totalResults} results</h2>
      {results.data.results.map((result, index) => (
        <div key={index}>
          <h3>{result.taxon.scientificName}</h3>
          <p>Source: {result.source}</p>
          <p>Confidence: {result.confidence}</p>
        </div>
      ))}
    </div>
  );
}
```

---

This API provides a powerful and flexible interface for accessing biodiversity data across multiple sources while maintaining consistency and ease of use.
