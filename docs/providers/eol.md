# Encyclopedia of Life (EOL) Provider Documentation

## Overview

The Encyclopedia of Life (EOL) provider integrates with the EOL API to access comprehensive species information, media, and biodiversity data. EOL is a collaborative project that aims to document all known species on Earth, providing a centralized repository of species information, photos, videos, and scientific literature.

## Features

- **Comprehensive Species Pages**: Detailed information about species from multiple sources
- **Rich Media**: High-quality photos, videos, and audio recordings
- **Scientific Literature**: Links to research papers and scientific publications
- **Taxonomic Information**: Complete taxonomic hierarchies and classifications
- **Conservation Status**: IUCN Red List and other conservation assessments
- **Trait Data**: Ecological and morphological trait information
- **Multiple Data Sources**: Aggregated data from museums, research institutions, and citizen science projects

## API Specifications

### Base Information
- **Base URL**: `https://eol.org/api/`
- **Authentication**: Public API (no authentication required)
- **Rate Limits**: 
  - 1 request per second per IP address
  - 30 requests per minute per IP address
  - 5,000 requests per day per IP address
- **Data Format**: JSON and XML (JSON preferred)

### Key Endpoints Used

#### 1. Pages Search
```
GET /search/1.0.json
```
**Purpose**: Search for species pages by name or other criteria
**Parameters**:
- `q`: Search query (species name, common name, etc.)
- `page`: Page number for pagination (default: 1)
- `per_page`: Number of results per page (default: 30, max: 50)
- `filter_by_taxon_concept_id`: Filter by taxon concept ID
- `filter_by_hierarchy_entry_id`: Filter by hierarchy entry ID
- `filter_by_string`: Additional string filter
- `cache_ttl`: Cache time-to-live in seconds

#### 2. Pages Details
```
GET /pages/1.0/{page_id}.json
```
**Purpose**: Get detailed information about a specific species page
**Parameters**:
- `page_id`: EOL page ID
- `images`: Number of images to return (default: 75, max: 75)
- `videos`: Number of videos to return (default: 75, max: 75)
- `sounds`: Number of sounds to return (default: 75, max: 75)
- `maps`: Number of maps to return (default: 75, max: 75)
- `text`: Number of text articles to return (default: 75, max: 75)
- `iucn`: Include IUCN Red List status (true/false)
- `subjects`: Filter text by subject (e.g., "TaxonBiology")
- `licenses`: Filter by license type (e.g., "cc-by", "cc-by-nc")
- `details`: Include detailed information (true/false)
- `common_names`: Include common names (true/false)
- `synonyms`: Include synonyms (true/false)
- `references`: Include references (true/false)
- `taxonomy`: Include taxonomic information (true/false)
- `vetted`: Filter by vetted status (1=trusted, 2=unreviewed, 3=untrusted, 4=all)
- `cache_ttl`: Cache time-to-live in seconds

#### 3. Hierarchy Entries
```
GET /hierarchy_entries/1.0/{hierarchy_entry_id}.json
```
**Purpose**: Get information about a specific hierarchy entry
**Parameters**:
- `hierarchy_entry_id`: Hierarchy entry ID
- `common_names`: Include common names (true/false)
- `synonyms`: Include synonyms (true/false)
- `cache_ttl`: Cache time-to-live in seconds

#### 4. Data Objects
```
GET /data_objects/1.0/{data_object_id}.json
```
**Purpose**: Get information about a specific data object (image, video, text, etc.)
**Parameters**:
- `data_object_id`: Data object ID
- `cache_ttl`: Cache time-to-live in seconds

#### 5. Collections
```
GET /collections/1.0/{collection_id}.json
```
**Purpose**: Get information about a specific collection
**Parameters**:
- `collection_id`: Collection ID
- `page`: Page number for pagination
- `per_page`: Number of results per page
- `filter`: Filter criteria
- `sort_by`: Sort order
- `cache_ttl`: Cache time-to-live in seconds

## Data Model

### UnifiedOccurrence Mapping

The EOL provider maps EOL pages to our unified data model (note: EOL provides species information rather than occurrence records):

```typescript
interface UnifiedOccurrence {
  id: string;                    // EOL page ID
  source: 'eol';
  scientificName: string;        // From page.scientific_name
  commonName?: string;           // From preferred common name
  kingdom?: string;              // From taxonomic hierarchy
  phylum?: string;               // From taxonomic hierarchy
  class?: string;                // From taxonomic hierarchy
  order?: string;                // From taxonomic hierarchy
  family?: string;               // From taxonomic hierarchy
  genus?: string;                // From taxonomic hierarchy
  species?: string;              // From taxonomic hierarchy
  location?: {
    // EOL provides global species information
    // Location data comes from referenced sources
    distribution?: string[];     // From text articles about distribution
  };
  recordedBy?: string;           // From data object attribution
  institutionCode?: string;      // 'Encyclopedia of Life'
  collectionCode?: string;       // 'Species Pages'
  catalogNumber?: string;        // EOL page ID
  license?: string;              // From page or data object license
  references?: string;           // EOL page URL
  basisOfRecord?: string;        // 'LiteratureOccurrence' or 'MachineObservation'
  occurrenceStatus?: string;     // 'present'
  media?: {
    images?: Array<{
      url: string;               // Image URL
      thumbnailUrl?: string;     // Thumbnail URL
      license?: string;          // Image license
      attribution?: string;      // Image attribution
      description?: string;      // Image description
      mediaType?: string;        // MIME type
    }>;
    videos?: Array<{
      url: string;               // Video URL
      thumbnailUrl?: string;     // Video thumbnail
      license?: string;          // Video license
      attribution?: string;      // Video attribution
      description?: string;      // Video description
      mediaType?: string;        // MIME type
    }>;
    sounds?: Array<{
      url: string;               // Audio URL
      license?: string;          // Audio license
      attribution?: string;      // Audio attribution
      description?: string;      // Audio description
      mediaType?: string;        // MIME type
    }>;
  };
  metadata: {
    source: 'eol';
    originalId: string;          // EOL page ID
    pageUrl?: string;            // EOL page URL
    lastModified?: string;       // Page last modified date
    dataObjectsCount?: number;   // Number of data objects
    textArticlesCount?: number;  // Number of text articles
    imagesCount?: number;        // Number of images
    videosCount?: number;        // Number of videos
    soundsCount?: number;        // Number of sounds
    conservationStatus?: Array<{
      status: string;            // Conservation status
      source: string;            // Status source (e.g., IUCN)
      category?: string;         // Status category
    }>;
    commonNames?: Array<{
      name: string;              // Common name
      language?: string;         // Language code
      preferred?: boolean;       // Is preferred name
    }>;
    synonyms?: Array<{
      name: string;              // Synonym
      relationship?: string;     // Relationship type
    }>;
    taxonomicHierarchy?: Array<{
      scientificName: string;    // Taxon name
      rank: string;              // Taxonomic rank
      id?: string;               // Taxon ID
    }>;
    vetted?: number;             // Vetted status (1-4)
    richness?: number;           // Richness score
    subjects?: string[];         // Article subjects
    references?: Array<{
      title?: string;            // Reference title
      author?: string;           // Reference author
      journal?: string;          // Journal name
      year?: number;             // Publication year
      doi?: string;              // DOI identifier
      url?: string;              // Reference URL
    }>;
  };
}
```

### EOL Page Information

```typescript
interface EOLPage {
  id: number;                    // EOL page ID
  scientificName: string;        // Scientific name
  richness?: number;             // Richness score
  synonyms?: Array<{
    scientificName: string;      // Synonym name
    relationship: string;        // Relationship type
    resource?: string;           // Source resource
  }>;
  vernacularNames?: Array<{
    vernacularName: string;      // Common name
    language?: string;           // Language
    eol_preferred?: boolean;     // EOL preferred
    preferred?: boolean;         // Generally preferred
  }>;
  dataObjects?: Array<{
    id: string;                  // Data object ID
    dataType: string;            // Data type (image, video, sound, text)
    mediaURL?: string;           // Media URL
    thumbnailURL?: string;       // Thumbnail URL
    eolMediaURL?: string;        // EOL media URL
    eolThumbnailURL?: string;    // EOL thumbnail URL
    title?: string;              // Title
    description?: string;        // Description
    subject?: string;            // Subject
    license?: string;            // License
    rightsHolder?: string;       // Rights holder
    audience?: string;           // Target audience
    language?: string;           // Language
    created?: string;            // Creation date
    modified?: string;           // Modification date
    bibliographicCitation?: string; // Citation
    source?: string;             // Source URL
    mediaType?: string;          // MIME type
    agents?: Array<{
      full_name: string;         // Agent name
      role: string;              // Agent role
    }>;
    references?: Array<{
      body: string;              // Reference body
      url?: string;              // Reference URL
    }>;
  }>;
  taxonConcept?: {
    id: number;                  // Taxon concept ID
    scientificName: string;      // Scientific name
    nameAccordingTo?: string;    // Name according to
    canonicalForm?: string;      // Canonical form
    sourceIdentifier?: string;   // Source identifier
  };
  hierarchyEntries?: Array<{
    id: number;                  // Hierarchy entry ID
    name: string;                // Taxon name
    rank: string;                // Taxonomic rank
    parentId?: number;           // Parent hierarchy entry ID
    scientificName: string;      // Scientific name
    taxonomicStatus?: string;    // Taxonomic status
    source?: string;             // Source
    vernacularName?: string;     // Vernacular name
    ancestry?: Array<{
      id: number;                // Ancestor ID
      name: string;              // Ancestor name
      rank: string;              // Ancestor rank
    }>;
  }>;
  references?: Array<{
    body: string;                // Reference body
    url?: string;                // Reference URL
  }>;
  conservationStatuses?: Array<{
    code: string;                // Status code
    label: string;               // Status label
    source: string;              // Status source
  }>;
}
```

## Implementation Details

### Client Architecture

The EOL provider consists of:

#### 1. EOL Client (`packages/functions/eol/client.ts`)
- **Purpose**: Low-level HTTP client for EOL API
- **Features**:
  - Rate limiting enforcement (1 req/sec, 30 req/min)
  - Request/response transformation
  - Error handling and retries
  - Caching for pages and media
  - Media URL resolution and validation

#### 2. EOL Provider (`packages/functions/eol/provider.ts`)
- **Purpose**: High-level provider interface conforming to service abstraction
- **Features**:
  - Unified data model transformation
  - Query parameter mapping
  - Health check implementation
  - Capability reporting
  - Media processing and optimization

### Key Features

#### Rate Limiting
```typescript
class EOLClient {
  private rateLimiter = new RateLimiter({
    requestsPerSecond: 1,
    requestsPerMinute: 30,
    requestsPerDay: 5000
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
    const response = await this.client.get('/search/1.0.json', { 
      q: 'Quercus',
      per_page: 1
    });
    
    return {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: response.responseTime,
      details: {
        endpoint: '/search/1.0.json',
        statusCode: response.status,
        rateLimit: this.rateLimiter.getStatus(),
        totalResults: response.data.totalResults
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message,
      details: { endpoint: '/search/1.0.json' }
    };
  }
}
```

#### Data Transformation
```typescript
private transformPage(eolPage: any): UnifiedOccurrence {
  const media = this.extractMedia(eolPage.dataObjects || []);
  const taxonomy = this.extractTaxonomy(eolPage.hierarchyEntries || []);
  
  return {
    id: eolPage.id?.toString() || '',
    source: 'eol',
    scientificName: eolPage.scientificName || '',
    commonName: this.getPreferredCommonName(eolPage.vernacularNames || []),
    kingdom: taxonomy.kingdom,
    phylum: taxonomy.phylum,
    class: taxonomy.class,
    order: taxonomy.order,
    family: taxonomy.family,
    genus: taxonomy.genus,
    species: taxonomy.species,
    location: {
      distribution: this.extractDistribution(eolPage.dataObjects || [])
    },
    recordedBy: this.extractAttribution(eolPage.dataObjects || []),
    institutionCode: 'Encyclopedia of Life',
    collectionCode: 'Species Pages',
    catalogNumber: eolPage.id?.toString() || '',
    license: this.extractLicense(eolPage.dataObjects || []),
    references: `https://eol.org/pages/${eolPage.id}`,
    basisOfRecord: 'LiteratureOccurrence',
    occurrenceStatus: 'present',
    media: media,
    metadata: {
      source: 'eol',
      originalId: eolPage.id?.toString() || '',
      pageUrl: `https://eol.org/pages/${eolPage.id}`,
      richness: eolPage.richness,
      dataObjectsCount: eolPage.dataObjects?.length || 0,
      textArticlesCount: this.countByType(eolPage.dataObjects, 'text'),
      imagesCount: this.countByType(eolPage.dataObjects, 'image'),
      videosCount: this.countByType(eolPage.dataObjects, 'video'),
      soundsCount: this.countByType(eolPage.dataObjects, 'sound'),
      conservationStatus: this.extractConservationStatus(eolPage.conservationStatuses || []),
      commonNames: this.extractCommonNames(eolPage.vernacularNames || []),
      synonyms: this.extractSynonyms(eolPage.synonyms || []),
      taxonomicHierarchy: this.extractHierarchy(eolPage.hierarchyEntries || []),
      vetted: eolPage.vetted,
      references: this.extractReferences(eolPage.references || [])
    }
  };
}

private extractMedia(dataObjects: any[]) {
  const media: any = {};
  
  const images = dataObjects.filter(obj => obj.dataType === 'image');
  if (images.length > 0) {
    media.images = images.map(img => ({
      url: img.mediaURL || img.eolMediaURL,
      thumbnailUrl: img.thumbnailURL || img.eolThumbnailURL,
      license: img.license,
      attribution: img.rightsHolder || this.extractAgentAttribution(img.agents),
      description: img.description,
      mediaType: img.mediaType
    }));
  }
  
  const videos = dataObjects.filter(obj => obj.dataType === 'video');
  if (videos.length > 0) {
    media.videos = videos.map(video => ({
      url: video.mediaURL || video.eolMediaURL,
      thumbnailUrl: video.thumbnailURL || video.eolThumbnailURL,
      license: video.license,
      attribution: video.rightsHolder || this.extractAgentAttribution(video.agents),
      description: video.description,
      mediaType: video.mediaType
    }));
  }
  
  const sounds = dataObjects.filter(obj => obj.dataType === 'sound');
  if (sounds.length > 0) {
    media.sounds = sounds.map(sound => ({
      url: sound.mediaURL || sound.eolMediaURL,
      license: sound.license,
      attribution: sound.rightsHolder || this.extractAgentAttribution(sound.agents),
      description: sound.description,
      mediaType: sound.mediaType
    }));
  }
  
  return Object.keys(media).length > 0 ? media : undefined;
}

private extractTaxonomy(hierarchyEntries: any[]) {
  const taxonomy: any = {};
  
  hierarchyEntries.forEach(entry => {
    const rank = entry.rank?.toLowerCase();
    if (rank && entry.scientificName) {
      taxonomy[rank] = entry.scientificName;
    }
  });
  
  return taxonomy;
}
```

## Usage Examples

### Basic Species Search
```typescript
import { EOLProvider } from './eol/provider';

const provider = new EOLProvider();

// Search for oak species
const results = await provider.search({
  query: 'Quercus',
  limit: 20
});

console.log(`Found ${results.data.length} oak species in EOL`);
results.data.forEach(species => {
  console.log(`- ${species.scientificName} (${species.commonName})`);
});
```

### Detailed Species Information
```typescript
// Get detailed page information
const detailedResults = await provider.search({
  query: 'Quercus alba',
  limit: 1,
  options: {
    includeMedia: true,
    includeText: true,
    includeConservationStatus: true
  }
});

const species = detailedResults.data[0];
console.log(`Species: ${species.scientificName}`);
console.log(`Common name: ${species.commonName}`);
console.log(`Images: ${species.media?.images?.length || 0}`);
console.log(`Videos: ${species.media?.videos?.length || 0}`);
console.log(`Conservation status: ${species.metadata.conservationStatus?.[0]?.status}`);
```

### Media Processing
```typescript
// Search for species with high-quality images
const mediaResults = await provider.search({
  query: 'wildflower',
  limit: 50,
  filters: {
    hasImages: true,
    vetted: 1, // Only trusted content
    licenseType: 'cc-by' // Only Creative Commons licensed
  }
});

// Process images
mediaResults.data.forEach(species => {
  if (species.media?.images) {
    species.media.images.forEach(image => {
      console.log(`Image: ${image.url}`);
      console.log(`License: ${image.license}`);
      console.log(`Attribution: ${image.attribution}`);
    });
  }
});
```

### Taxonomic Hierarchy
```typescript
// Get taxonomic hierarchy information
const hierarchyResults = await provider.search({
  query: 'Sequoia sempervirens',
  limit: 1
});

const species = hierarchyResults.data[0];
const hierarchy = species.metadata.taxonomicHierarchy;

console.log('Taxonomic hierarchy:');
hierarchy?.forEach(taxon => {
  console.log(`${taxon.rank}: ${taxon.scientificName}`);
});
```

### Conservation Status
```typescript
// Search for species with conservation status
const conservationResults = await provider.search({
  query: 'endangered plants',
  limit: 100,
  filters: {
    hasConservationStatus: true
  }
});

// Group by conservation status
const statusGroups = conservationResults.data.reduce((groups, species) => {
  const status = species.metadata.conservationStatus?.[0]?.status;
  if (status) {
    groups[status] = groups[status] || [];
    groups[status].push(species);
  }
  return groups;
}, {} as Record<string, any[]>);

Object.entries(statusGroups).forEach(([status, species]) => {
  console.log(`${status}: ${species.length} species`);
});
```

## Error Handling

The EOL provider handles various error conditions:

### API Errors
- **Rate Limit Exceeded**: Implements exponential backoff
- **Service Unavailable**: Retries with increasing delays
- **Invalid Parameters**: Returns descriptive error messages
- **Page Not Found**: Handles missing species pages gracefully

### Data Quality Issues
- **Missing Media**: Filters out data objects without valid URLs
- **Incomplete Taxonomy**: Handles partial taxonomic information
- **Broken Links**: Validates media URLs and references
- **License Issues**: Filters by license requirements

### Error Recovery
```typescript
try {
  const results = await provider.search({
    query: 'unknown species',
    limit: 50
  });
} catch (error) {
  if (error.code === 'NO_RESULTS') {
    console.log('No species found for query');
    // Try alternative search
    const alternativeResults = await provider.search({
      query: 'plant',
      limit: 10
    });
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Rate limit exceeded, retrying...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    // Retry request
  }
}
```

## Performance Optimization

### Caching Strategy
- **Species Pages**: Cache page details for 24 hours
- **Media URLs**: Cache media metadata for 12 hours
- **Taxonomic Hierarchy**: Cache hierarchy information for 1 week
- **Search Results**: Cache search results for 1 hour

### Request Optimization
- **Batch Processing**: Process multiple pages in parallel
- **Selective Loading**: Load only required data objects
- **Media Filtering**: Pre-filter media by type and quality
- **Pagination**: Efficient handling of large result sets

### Memory Management
```typescript
class EOLClient {
  private cache = new Map();
  private maxCacheSize = 1000;
  
  async getPage(pageId: string, options: any = {}) {
    const cacheKey = `page:${pageId}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const page = await this.makeRequest(`/pages/1.0/${pageId}.json`, options);
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(cacheKey, page);
    return page;
  }
}
```

## Best Practices

### Query Construction
1. **Use Scientific Names**: More reliable than common names
2. **Filter by Vetted Status**: Use vetted=1 for trusted content
3. **Specify Media Requirements**: Request specific media types
4. **Limit Result Size**: Use appropriate page sizes (10-50)
5. **Include Metadata**: Request additional information when needed

### Data Handling
1. **Validate Media URLs**: Check that media URLs are accessible
2. **Respect Licenses**: Honor license requirements for media
3. **Attribution**: Always provide proper attribution
4. **Quality Assessment**: Consider vetted status in data evaluation

### Performance
1. **Caching**: Implement aggressive caching for frequently accessed data
2. **Batch Processing**: Process multiple requests efficiently
3. **Error Handling**: Implement robust error recovery
4. **Rate Limiting**: Respect API rate limits

## Testing

### Unit Tests
```typescript
describe('EOLProvider', () => {
  it('should search for species by name', async () => {
    const provider = new EOLProvider();
    const results = await provider.search({
      query: 'Quercus alba'
    });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].source).toBe('eol');
    expect(results.data[0].scientificName).toContain('Quercus');
  });
  
  it('should handle rate limiting', async () => {
    const provider = new EOLProvider();
    
    // Make multiple requests
    const promises = Array(5).fill(0).map(() => 
      provider.search({ query: 'test', limit: 1 })
    );
    
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
  
  it('should extract media correctly', async () => {
    const provider = new EOLProvider();
    const results = await provider.search({
      query: 'Quercus alba',
      limit: 1,
      options: { includeMedia: true }
    });
    
    const species = results.data[0];
    expect(species.media?.images).toBeDefined();
    expect(species.media?.images?.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```typescript
describe('EOL Integration', () => {
  it('should return real data from EOL API', async () => {
    const provider = new EOLProvider();
    const results = await provider.search({
      query: 'oak',
      limit: 5
    });
    
    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].source).toBe('eol');
    expect(results.data[0].scientificName).toBeTruthy();
  });
});
```

## Monitoring and Observability

### Metrics to Track
- **Request Volume**: Number of requests per hour/day
- **Response Times**: Average and P95 response times
- **Error Rates**: Percentage of failed requests
- **Cache Hit Rates**: Effectiveness of caching strategy
- **Media Availability**: Percentage of species with media
- **Data Quality**: Vetted vs. unvetted content ratio

### Health Monitoring
```typescript
class EOLMonitor {
  async checkHealth() {
    const startTime = Date.now();
    
    try {
      const response = await this.client.get('/search/1.0.json', {
        q: 'test',
        per_page: 1
      });
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        totalResults: response.data.totalResults,
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

1. **Empty Search Results**
   - **Cause**: EOL may not have data for specific queries
   - **Solution**: Broaden search terms, try alternative names

2. **Missing Media**
   - **Cause**: Not all species have associated media
   - **Solution**: Filter by data types, check vetted status

3. **Slow Response Times**
   - **Cause**: Complex queries or large result sets
   - **Solution**: Optimize queries, implement caching, use pagination

4. **Broken Media Links**
   - **Cause**: Media URLs may become invalid over time
   - **Solution**: Validate URLs, implement fallback mechanisms

### Debug Mode
```typescript
const provider = new EOLProvider({ debug: true });

// Enable detailed logging
provider.setLogLevel('debug');

// Monitor all requests
provider.on('request', (req) => {
  console.log('EOL Request:', req.url, req.params);
});

provider.on('response', (res) => {
  console.log('EOL Response:', res.status, res.data?.results?.length);
});
```

## Future Enhancements

### Planned Features
1. **Advanced Search**: Full-text search across articles and descriptions
2. **Trait Data**: Integration with trait databases
3. **Phylogenetic Information**: Evolutionary relationships
4. **Geographic Distribution**: Enhanced distribution mapping
5. **Literature Integration**: Direct access to scientific papers
6. **Community Features**: User-generated content integration

### API Extensions
- **Batch Operations**: Bulk data retrieval
- **Real-time Updates**: WebSocket support for live updates
- **Custom Collections**: User-defined species collections
- **Advanced Filtering**: More sophisticated search capabilities
- **Data Export**: Enhanced export formats
- **Analytics**: Usage statistics and trends

## Contributing

### Adding New Features
1. **Fork the repository** and create a feature branch
2. **Implement the feature** following existing patterns
3. **Add comprehensive tests** for new functionality
4. **Update documentation** including this file
5. **Submit a pull request** with detailed description

### Code Standards
- Follow TypeScript best practices
- Use consistent naming conventions
- Add JSDoc comments for all public methods
- Implement proper error handling
- Maintain backwards compatibility

### Testing Requirements
- Unit tests for all new functions
- Integration tests for API interactions
- Error handling tests
- Performance tests for large datasets
- Documentation tests for code examples
