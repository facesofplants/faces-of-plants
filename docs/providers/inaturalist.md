# iNaturalist Provider Documentation

## Overview

The iNaturalist provider connects to the iNaturalist API to access the world's largest collection of citizen science biodiversity observations. iNaturalist is a joint initiative of the National Academy of Sciences and the National Geographic Society, hosting over 50 million observations from citizen scientists worldwide.

## Features

- **Citizen Science Data**: Community-contributed observations with photos
- **Photo Validation**: Computer vision and community validation of species identifications
- **Global Community**: Observations from millions of naturalists worldwide
- **Rich Media**: High-quality photos and detailed observation metadata
- **Research Grade**: Scientifically validated observations suitable for research

## API Specifications

### Base Information
- **Base URL**: `https://api.inaturalist.org/v1/`
- **Authentication**: Public API (no authentication required for basic access)
- **Rate Limits**: 
  - 2 requests per second per IP address
  - 60 requests per minute per IP address
  - 10,000 requests per day per IP address
- **Data Format**: JSON

### Key Endpoints Used

#### 1. Observations Search
```
GET /observations
```
**Purpose**: Search for observations by various criteria
**Parameters**:
- `q`: Search query (species name, description, etc.)
- `taxon_name`: Scientific or common name
- `taxon_id`: iNaturalist taxon ID
- `place_id`: iNaturalist place ID
- `user_id`: Observer user ID
- `per_page`: Number of results per page (default: 30, max: 200)
- `page`: Page number for pagination
- `order`: Sort order (created_at, observed_on, species_guess, etc.)
- `order_by`: Sort direction (asc, desc)
- `photos`: Filter for observations with photos (true/false)
- `sounds`: Filter for observations with sounds (true/false)
- `quality_grade`: Filter by quality grade (casual, needs_id, research)
- `iconic_taxa`: Filter by iconic taxa (Plantae, Animalia, etc.)
- `identified`: Filter for identified observations (true/false)
- `geo`: Filter for observations with coordinates (true/false)
- `observed_on`: Date or date range (YYYY-MM-DD)
- `created_on`: Date or date range when observation was created
- `updated_since`: ISO 8601 datetime for incremental updates
- `acc`: Positional accuracy threshold in meters

#### 2. Taxa Search
```
GET /taxa
```
**Purpose**: Search for taxa (species, genera, families, etc.)
**Parameters**:
- `q`: Search query (name)
- `is_active`: Filter for active taxa (true/false)
- `taxon_id`: Specific taxon ID
- `parent_id`: Parent taxon ID
- `rank`: Taxonomic rank (species, genus, family, etc.)
- `rank_level`: Numeric rank level
- `per_page`: Number of results per page (default: 30, max: 200)
- `page`: Page number for pagination
- `order`: Sort order (name, observations_count, etc.)
- `order_by`: Sort direction (asc, desc)

#### 3. Taxa Details
```
GET /taxa/{id}
```
**Purpose**: Get detailed information about a specific taxon
**Parameters**:
- `id`: iNaturalist taxon ID

#### 4. Places Search
```
GET /places
```
**Purpose**: Search for geographic places
**Parameters**:
- `q`: Search query (place name)
- `per_page`: Number of results per page
- `page`: Page number for pagination

## Data Model

### UnifiedOccurrence Mapping

The iNaturalist provider maps iNaturalist observations to our unified data model:

```typescript
interface UnifiedOccurrence {
  id: string;                    // iNaturalist observation ID
  source: 'inaturalist';
  scientificName: string;        // From taxon.name
  commonName?: string;           // From taxon preferred common name
  kingdom?: string;              // From taxon.kingdom
  phylum?: string;               // From taxon.phylum
  class?: string;                // From taxon.class
  order?: string;                // From taxon.order
  family?: string;               // From taxon.family
  genus?: string;                // From taxon.genus
  species?: string;              // From taxon.species
  location?: {
    country?: string;            // From place_guess or geojson
    stateProvince?: string;      // From place_guess parsing
    locality?: string;           // From place_guess
    coordinates?: {
      latitude: number;          // From location.latitude
      longitude: number;         // From location.longitude
    };
  };
  date?: {
    year?: number;               // From observed_on
    month?: number;              // From observed_on
    day?: number;                // From observed_on
  };
  recordedBy?: string;           // From user.name or user.login
  institutionCode?: string;      // 'iNaturalist'
  collectionCode?: string;       // 'Observations'
  catalogNumber?: string;        // Observation ID
  license?: string;              // From license_code
  references?: string;           // iNaturalist URL
  basisOfRecord?: string;        // 'HumanObservation'
  occurrenceStatus?: string;     // 'present'
  media?: {
    photos?: Array<{
      url: string;               // Photo URL
      license?: string;          // Photo license
      attribution?: string;      // Photo attribution
    }>;
    sounds?: Array<{
      url: string;               // Sound URL
      license?: string;          // Sound license
      attribution?: string;      // Sound attribution
    }>;
  };
  metadata: {
    source: 'inaturalist';
    originalId: string;          // iNaturalist observation ID
    qualityGrade?: string;       // casual, needs_id, research
    identificationCount?: number; // Number of identifications
    commentsCount?: number;      // Number of comments
    positionalAccuracy?: number; // Coordinate accuracy in meters
    geoprivacy?: string;         // Privacy level
    captive?: boolean;           // Whether organism is captive
    observedOn?: string;         // Original observed_on datetime
    createdAt?: string;          // When observation was created
    updatedAt?: string;          // When observation was last updated
    timeZone?: string;           // Observation timezone
    speciesGuess?: string;       // Original species guess
    description?: string;        // Observation description
    tags?: string[];             // Observation tags
    projectIds?: number[];       // Associated project IDs
    communityTaxonId?: number;   // Community-agreed taxon ID
  };
}
```

### Taxa Information Mapping

```typescript
interface TaxonInfo {
  id: number;                    // iNaturalist taxon ID
  name: string;                  // Scientific name
  preferredCommonName?: string;  // Preferred common name
  commonNames?: Array<{
    name: string;                // Common name
    locale: string;              // Language code
    lexicon: string;             // Lexicon type
  }>;
  taxonomy: {
    kingdom?: string;            // Taxonomic kingdom
    phylum?: string;             // Taxonomic phylum
    class?: string;              // Taxonomic class
    order?: string;              // Taxonomic order
    family?: string;             // Taxonomic family
    genus?: string;              // Taxonomic genus
    species?: string;            // Taxonomic species
    rank?: string;               // Taxonomic rank
    rankLevel?: number;          // Numeric rank level
  };
  isActive: boolean;             // Whether taxon is active
  ancestry?: string;             // Ancestor taxon IDs
  childTaxaCount?: number;       // Number of child taxa
  observationsCount?: number;    // Number of observations
  listedTaxaCount?: number;      // Number of listed taxa
  description?: string;          // Taxon description
  wikipediaUrl?: string;         // Wikipedia URL
  conservationStatus?: {
    status: string;              // Conservation status
    authority: string;           // Status authority
    place?: string;              // Geographic scope
  };
  conservationStatuses?: Array<{
    status: string;              // Conservation status
    authority: string;           // Status authority
    place?: string;              // Geographic scope
  }>;
  establishmentMeans?: {
    place: string;               // Geographic scope
    establishmentMeans: string;  // Native, introduced, etc.
  };
  photos?: Array<{
    url: string;                 // Photo URL
    license?: string;            // Photo license
    attribution?: string;        // Photo attribution
  }>;
}
```

## Implementation Details

### Client Architecture

The iNaturalist provider consists of:

#### 1. iNaturalist Client (`packages/functions/inaturalist/client.ts`)
- **Purpose**: Low-level HTTP client for iNaturalist API
- **Features**:
  - Rate limiting enforcement (2 req/sec, 60 req/min)
  - Request/response transformation
  - Error handling and retries
  - Caching for taxa and common queries
  - Photo URL resolution and validation

#### 2. iNaturalist Provider (`packages/functions/inaturalist/provider.ts`)
- **Purpose**: High-level provider interface conforming to service abstraction
- **Features**:
  - Unified data model transformation
  - Query parameter mapping
  - Health check implementation
  - Capability reporting
  - Photo and media handling

### Key Features

#### Rate Limiting
```typescript
class iNaturalistClient {
  private rateLimiter = new RateLimiter({
    requestsPerSecond: 2,
    requestsPerMinute: 60,
    requestsPerDay: 10000
  });
  
  async makeRequest(endpoint: string, params?: any) {
    await this.rateLimiter.acquire();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'FacesOfPlants/1.0 (https://facesofplants.org)',
        'Accept': 'application/json'
      },
      params: this.buildParams(params)
    });
    
    return this.handleResponse(response);
  }
}
```

#### Health Checks
```typescript
async healthCheck(): Promise<HealthStatus> {
  try {
    const response = await this.client.get('/observations', { 
      per_page: 1,
      iconic_taxa: 'Plantae',
      photos: true
    });
    
    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: response.responseTime,
      details: {
        endpoint: '/observations',
        statusCode: response.status,
        rateLimit: this.rateLimiter.getStatus(),
        totalResults: response.data.total_results
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message,
      details: { endpoint: '/observations' }
    };
  }
}
```

#### Data Transformation
```typescript
private transformObservation(inatObservation: any): UnifiedOccurrence {
  const taxon = inatObservation.taxon;
  const location = inatObservation.geojson?.coordinates;
  
  return {
    id: inatObservation.id.toString(),
    source: 'inaturalist',
    scientificName: taxon?.name || inatObservation.species_guess || '',
    commonName: taxon?.preferred_common_name,
    kingdom: taxon?.kingdom,
    phylum: taxon?.phylum,
    class: taxon?.class,
    order: taxon?.order,
    family: taxon?.family,
    genus: taxon?.genus,
    species: taxon?.species,
    location: this.extractLocation(inatObservation),
    date: this.extractDate(inatObservation),
    recordedBy: inatObservation.user?.name || inatObservation.user?.login,
    institutionCode: 'iNaturalist',
    collectionCode: 'Observations',
    catalogNumber: inatObservation.id.toString(),
    license: inatObservation.license_code,
    references: inatObservation.uri,
    basisOfRecord: 'HumanObservation',
    occurrenceStatus: 'present',
    media: this.extractMedia(inatObservation),
    metadata: {
      source: 'inaturalist',
      originalId: inatObservation.id.toString(),
      qualityGrade: inatObservation.quality_grade,
      identificationCount: inatObservation.num_identification_agreements,
      commentsCount: inatObservation.comments_count,
      positionalAccuracy: inatObservation.positional_accuracy,
      geoprivacy: inatObservation.geoprivacy,
      captive: inatObservation.captive,
      observedOn: inatObservation.observed_on,
      createdAt: inatObservation.created_at,
      updatedAt: inatObservation.updated_at,
      timeZone: inatObservation.time_zone,
      speciesGuess: inatObservation.species_guess,
      description: inatObservation.description,
      tags: inatObservation.tags || [],
      projectIds: inatObservation.project_ids || [],
      communityTaxonId: inatObservation.community_taxon?.id
    }
  };
}

private extractMedia(observation: any) {
  const media: any = {};
  
  if (observation.photos && observation.photos.length > 0) {
    media.photos = observation.photos.map((photo: any) => ({
      url: photo.url,
      license: photo.license_code,
      attribution: photo.attribution
    }));
  }
  
  if (observation.sounds && observation.sounds.length > 0) {
    media.sounds = observation.sounds.map((sound: any) => ({
      url: sound.file_url,
      license: sound.license_code,
      attribution: sound.attribution
    }));
  }
  
  return Object.keys(media).length > 0 ? media : undefined;
}
```

#### Photo Processing
```typescript
private processPhotos(photos: any[]): Array<{url: string, license?: string, attribution?: string}> {
  return photos.map(photo => {
    // Get the best available photo size
    const photoUrl = photo.url || 
                     photo.original_url || 
                     photo.large_url || 
                     photo.medium_url || 
                     photo.small_url;
    
    return {
      url: photoUrl,
      license: photo.license_code,
      attribution: photo.attribution || `© ${photo.user?.name || 'Unknown'}`
    };
  }).filter(photo => photo.url); // Filter out photos without URLs
}
```

## Usage Examples

### Basic Plant Observations Search
```typescript
import { iNaturalistProvider } from './inaturalist/provider';

const provider = new iNaturalistProvider();

// Search for oak observations with photos
const results = await provider.search({
  query: 'oak',
  limit: 50,
  filters: {
    iconicTaxa: 'Plantae',
    photos: true,
    qualityGrade: 'research',
    geo: true
  }
});

console.log(`Found ${results.data.length} oak observations`);
```

### Advanced Search with Location
```typescript
// Search for plant observations in California
const results = await provider.search({
  query: 'wildflower',
  limit: 100,
  filters: {
    iconicTaxa: 'Plantae',
    placeId: 14, // California
    qualityGrade: 'research',
    observedOn: '2024-01-01,2024-12-31', // Date range
    photos: true
  }
});

// Filter by specific coordinates
const nearSanFrancisco = results.data.filter(record => {
  const coords = record.location?.coordinates;
  if (!coords) return false;
  
  const distance = calculateDistance(
    coords.latitude, coords.longitude,
    37.7749, -122.4194 // San Francisco coordinates
  );
  
  return distance < 50; // Within 50km
});
```

### Taxa Information Lookup
```typescript
// Get detailed information about a specific taxon
const taxonInfo = await provider.getTaxonInfo(47126); // Quercus (oak genus)

console.log(`Taxon: ${taxonInfo.name}`);
console.log(`Common name: ${taxonInfo.preferredCommonName}`);
console.log(`Observations: ${taxonInfo.observationsCount}`);
console.log(`Child taxa: ${taxonInfo.childTaxaCount}`);
```

### Quality Grade Filtering
```typescript
// Get only research-grade observations
const researchGrade = await provider.search({
  query: 'Sequoia sempervirens',
  filters: {
    qualityGrade: 'research',
    photos: true,
    geo: true
  }
});

// Get observations that need identification
const needsId = await provider.search({
  query: 'unknown plant',
  filters: {
    qualityGrade: 'needs_id',
    photos: true,
    iconicTaxa: 'Plantae'
  }
});
```

## Error Handling

The iNaturalist provider handles various error conditions:

### API Errors
- **Rate Limit Exceeded**: Implements exponential backoff with jitter
- **Service Unavailable**: Retries with increasing delays
- **Invalid Parameters**: Returns descriptive error messages
- **Network Timeouts**: Configurable timeout with retries

### Data Quality Issues
- **Missing Photos**: Filters out observations without photos when requested
- **Invalid Coordinates**: Validates latitude/longitude ranges
- **Incomplete Taxonomy**: Handles observations with partial taxonomic information
- **Quality Grades**: Respects different quality levels (casual, needs_id, research)

### Common Error Scenarios
```typescript
try {
  const results = await provider.search({
    query: 'plant',
    filters: { placeId: 999999 } // Invalid place ID
  });
} catch (error) {
  if (error.code === 'INVALID_PLACE_ID') {
    // Handle invalid place ID
    console.warn('Invalid place ID, using global search');
    const globalResults = await provider.search({ query: 'plant' });
  }
}
```

## Performance Optimization

### Caching Strategy
- **Taxa Information**: Cache taxon details for 24 hours
- **Place Information**: Cache place details for 1 week
- **Common Queries**: Cache frequent searches for 1 hour
- **Photo URLs**: Cache photo metadata for 12 hours

### Request Optimization
- **Batch Processing**: Process multiple observations in parallel
- **Pagination**: Efficient handling of large result sets
- **Field Selection**: Request only required fields to reduce payload
- **Photo Filtering**: Pre-filter photos by quality and size

### Memory Management
```typescript
class iNaturalistClient {
  private cache = new LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 60 // 1 hour TTL
  });
  
  async searchObservations(params: any) {
    const cacheKey = this.buildCacheKey(params);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const results = await this.makeRequest('/observations', params);
    this.cache.set(cacheKey, results);
    
    return results;
  }
}
```

## Best Practices

### Query Construction
1. **Use Iconic Taxa**: Filter by 'Plantae' for plant observations
2. **Specify Photo Requirements**: Use `photos: true` for observations with images
3. **Quality Filtering**: Use appropriate quality grades for your use case
4. **Geographic Filtering**: Use place IDs or coordinates for location-based searches
5. **Date Ranges**: Use date filters for temporal analysis

### Data Handling
1. **Respect Privacy**: Honor geoprivacy settings
2. **Photo Attribution**: Always include proper photo attribution
3. **License Compliance**: Respect license requirements for media
4. **Quality Assessment**: Consider quality grades in data analysis

### Performance
1. **Pagination**: Use appropriate page sizes (30-200 per page)
2. **Caching**: Implement caching for frequently accessed data
3. **Rate Limiting**: Respect API rate limits
4. **Batch Processing**: Process multiple requests efficiently

## Testing

### Unit Tests
```typescript
describe('iNaturalistProvider', () => {
  it('should search for plant observations', async () => {
    const provider = new iNaturalistProvider();
    const results = await provider.search({
      query: 'oak',
      filters: { iconicTaxa: 'Plantae', photos: true }
    });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].source).toBe('inaturalist');
    expect(results.data[0].media?.photos).toBeDefined();
  });
  
  it('should handle rate limiting', async () => {
    const provider = new iNaturalistProvider();
    
    // Make multiple rapid requests
    const promises = Array(5).fill(0).map(() => 
      provider.search({ query: 'test', limit: 1 })
    );
    
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
  
  it('should transform observation data correctly', async () => {
    const provider = new iNaturalistProvider();
    const results = await provider.search({
      query: 'Quercus alba',
      limit: 1,
      filters: { qualityGrade: 'research' }
    });
    
    const observation = results.data[0];
    expect(observation.scientificName).toBeTruthy();
    expect(observation.metadata.qualityGrade).toBe('research');
    expect(observation.basisOfRecord).toBe('HumanObservation');
  });
});
```

### Integration Tests
```typescript
describe('iNaturalist Integration', () => {
  it('should return real data from iNaturalist API', async () => {
    const provider = new iNaturalistProvider();
    const results = await provider.search({
      query: 'oak',
      limit: 10,
      filters: { iconicTaxa: 'Plantae', photos: true }
    });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].source).toBe('inaturalist');
    expect(results.data[0].media?.photos).toBeDefined();
  });
});
```

## Monitoring and Observability

### Metrics to Track
- **Request Volume**: Number of requests per hour/day
- **Response Times**: Average and P95 response times
- **Error Rates**: Percentage of failed requests
- **Quality Grade Distribution**: Breakdown of observation quality grades
- **Photo Availability**: Percentage of observations with photos
- **Geographic Coverage**: Distribution of observations by location

### Health Monitoring
```typescript
class iNaturalistMonitor {
  async checkHealth() {
    const startTime = Date.now();
    
    try {
      const response = await this.client.get('/observations', {
        per_page: 1,
        iconic_taxa: 'Plantae'
      });
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        totalObservations: response.data.total_results,
        rateLimit: this.client.getRateLimitStatus()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **No Results for Valid Queries**
   - **Cause**: Overly restrictive filters
   - **Solution**: Simplify filters, check place IDs and date ranges

2. **Missing Photos**
   - **Cause**: Not all observations have photos
   - **Solution**: Add `photos: true` filter

3. **Rate Limit Exceeded**
   - **Cause**: Too many requests too quickly
   - **Solution**: Implement proper rate limiting and exponential backoff

4. **Invalid Coordinates**
   - **Cause**: Some observations have invalid or missing coordinates
   - **Solution**: Validate coordinates and filter out invalid ones

### Debug Mode
```typescript
const provider = new iNaturalistProvider({ debug: true });

// Enable detailed logging
provider.setLogLevel('debug');

// Monitor requests and responses
provider.on('request', (req) => {
  console.log('iNaturalist Request:', req.url, req.params);
});

provider.on('response', (res) => {
  console.log('iNaturalist Response:', res.status, res.data?.results?.length);
});
```

## Data Privacy and Ethics

### Privacy Considerations
- **Geoprivacy**: Respect user privacy settings for location data
- **Sensitive Species**: Some species locations are obscured for conservation
- **User Information**: Minimize collection of personal user data
- **Data Retention**: Implement appropriate data retention policies

### Ethical Guidelines
- **Attribution**: Always provide proper attribution for photos and data
- **License Compliance**: Respect Creative Commons and other licenses
- **Conservation**: Consider conservation implications of location data
- **Community Guidelines**: Follow iNaturalist community guidelines

## Future Enhancements

### Planned Features
1. **Advanced Photo Processing**: Image recognition and quality assessment
2. **Real-time Updates**: WebSocket support for live observations
3. **Project Integration**: Support for iNaturalist projects and collections
4. **Identification Assistance**: Integration with iNaturalist's computer vision
5. **Social Features**: Community interactions and discussions
6. **Conservation Status**: Enhanced conservation status information

### API Extensions
- **Batch Operations**: Bulk data processing capabilities
- **Custom Filters**: Advanced filtering and search capabilities
- **Data Export**: Enhanced data export formats
- **Analytics**: Observation trends and statistics
- **Notifications**: Real-time alerts for new observations

## Contributing

### Adding New Features
1. **Fork the repository** and create a feature branch
2. **Implement the feature** following existing patterns
3. **Add tests** for new functionality
4. **Update documentation** including this file
5. **Submit a pull request** with detailed description

### Code Style
- Follow existing TypeScript patterns
- Use meaningful variable and function names
- Add JSDoc comments for public methods
- Maintain consistent error handling patterns

### Testing Guidelines
- Write unit tests for all new functions
- Include integration tests for API interactions
- Test error conditions and edge cases
- Maintain test coverage above 80%
