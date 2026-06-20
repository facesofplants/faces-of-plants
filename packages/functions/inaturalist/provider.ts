import {
  type DataSourceProvider,
  type DataSourceClient,
  type UnifiedOccurrence,
  type SearchParams,
  type SearchResult,
  type HealthStatus,
  type DataSourceCapability,
  type RateLimit,
} from '@faces-of-plants/core/src/services/types';

import {
  iNaturalistClient,
  type iNaturalistObservation,
  type iNaturalistSearchParams,
} from './client';

export class iNaturalistProvider implements DataSourceProvider {
  id = 'inaturalist';
  name = 'iNaturalist';
  version = '1.0.0';
  baseUrl = 'https://api.inaturalist.org/v1';

  capabilities: DataSourceCapability[] = [
    {
      type: 'occurrence',
      operations: [
        {
          name: 'search',
          description: 'Search for citizen science observations',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Free text search' },
              taxon_name: { type: 'string', description: 'Scientific or common name' },
              place_id: { type: 'number', description: 'iNaturalist place ID' },
              lat: { type: 'number', description: 'Latitude' },
              lng: { type: 'number', description: 'Longitude' },
              radius: { type: 'number', description: 'Search radius in km' },
              d1: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
              d2: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
              quality_grade: {
                type: 'string',
                enum: ['research', 'needs_id', 'casual'],
                description: 'Quality grade filter',
              },
              per_page: {
                type: 'number',
                minimum: 1,
                maximum: 200,
                description: 'Results per page',
              },
            },
          },
        },
        {
          name: 'get',
          description: 'Get observation by ID',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'iNaturalist observation ID' },
            },
            required: ['id'],
          },
        },
      ],
      filters: [
        { name: 'q', type: 'string', description: 'Free text search' },
        { name: 'taxon_name', type: 'string', description: 'Scientific or common name' },
        { name: 'place_id', type: 'number', description: 'iNaturalist place ID' },
        {
          name: 'quality_grade',
          type: 'string',
          description: 'Quality grade',
          enum: ['research', 'needs_id', 'casual'],
        },
        { name: 'iconic_taxa', type: 'array', description: 'Iconic taxon filters' },
        { name: 'lat', type: 'number', description: 'Latitude for geographic search' },
        { name: 'lng', type: 'number', description: 'Longitude for geographic search' },
        { name: 'radius', type: 'number', description: 'Search radius in kilometers' },
        { name: 'd1', type: 'string', description: 'Start date (YYYY-MM-DD)' },
        { name: 'd2', type: 'string', description: 'End date (YYYY-MM-DD)' },
      ],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          observed_on: { type: 'string' },
          location: { type: 'array', items: { type: 'number' } },
          taxon: { type: 'object' },
          quality_grade: { type: 'string' },
          photos: { type: 'array' },
        },
      },
      examples: [
        {
          description: 'Find recent plant observations with photos',
          query: 'recent plant observations',
          parameters: { iconic_taxa: ['Plantae'], quality_grade: 'research' },
          expectedResults: 100,
        },
        {
          description: 'Search for oak trees in a specific area',
          query: 'oak trees california',
          parameters: { taxon_name: 'Quercus', place_id: 14 },
          expectedResults: 50,
        },
      ],
    },
    {
      type: 'images',
      operations: [
        {
          name: 'search',
          description: 'Search for observation photos',
          parameters: {
            type: 'object',
            properties: {
              taxon_name: { type: 'string', description: 'Scientific or common name' },
              quality_grade: { type: 'string', enum: ['research'] },
            },
          },
        },
      ],
      filters: [
        { name: 'taxon_name', type: 'string', description: 'Scientific or common name' },
        { name: 'has_photos', type: 'boolean', description: 'Only observations with photos' },
      ],
      schema: {
        type: 'object',
        properties: {
          photos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                license_code: { type: 'string' },
                attribution: { type: 'string' },
              },
            },
          },
        },
      },
      examples: [
        {
          description: 'Get photos of research-grade plant observations',
          query: 'plant photos',
          parameters: { iconic_taxa: ['Plantae'], quality_grade: 'research' },
          expectedResults: 200,
        },
      ],
    },
  ];

  rateLimit: RateLimit = {
    requestsPerSecond: 2, // iNaturalist is more conservative
    requestsPerMinute: 60,
    requestsPerHour: 3600,
    burstLimit: 5,
  };

  client: iNaturalistDataSourceClient;

  constructor() {
    this.client = new iNaturalistDataSourceClient();
  }
}

class iNaturalistDataSourceClient implements DataSourceClient {
  private inatClient: iNaturalistClient;

  constructor() {
    this.inatClient = new iNaturalistClient();
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Transform generic search params to iNaturalist-specific params
      const inatParams = this.transformSearchParams(params);

      const result = await this.inatClient.searchObservations(inatParams);

      return {
        results: result.results.map(this.transformToUnified),
        count: result.results.length,
        totalCount: result.total_results,
        endOfRecords: result.results.length < result.per_page,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: this.calculateQueryComplexity(params),
        },
      };
    } catch (error) {
      console.error('[iNaturalistDataSourceClient] Search error:', error);
      throw error;
    }
  }

  async get(id: string): Promise<UnifiedOccurrence> {
    try {
      const result = await this.inatClient.getObservation(parseInt(id));
      return this.transformToUnified(result);
    } catch (error) {
      console.error('[iNaturalistDataSourceClient] Get error:', error);
      throw error;
    }
  }

  async batch(ids: string[]): Promise<UnifiedOccurrence[]> {
    try {
      const results = await Promise.all(ids.map((id) => this.get(id)));
      return results;
    } catch (error) {
      console.error('[iNaturalistDataSourceClient] Batch error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const health = await this.inatClient.healthCheck();

      return {
        healthy: health.status === 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: health.status === 'unhealthy' ? [health.message || 'Unknown error'] : undefined,
        metadata: {
          endpoint: 'https://api.inaturalist.org/v1',
          testQuery: 'observations?per_page=1',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          endpoint: 'https://api.inaturalist.org/v1',
          testQuery: 'observations?per_page=1',
        },
      };
    }
  }

  private transformSearchParams(params: SearchParams): iNaturalistSearchParams {
    const inatParams: iNaturalistSearchParams = {
      per_page: params.limit || 100,
      page: params.offset ? Math.floor(params.offset / (params.limit || 100)) + 1 : 1,
      quality_grade: 'research', // Default to research grade for better quality
      iconic_taxa: ['Plantae'], // Default to plants
    };

    // Add query
    if (params.query) {
      inatParams.q = params.query;
    }

    // Add filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          switch (key) {
            case 'taxon_name':
              inatParams.taxon_name = value as string;
              break;
            case 'place_id':
              inatParams.place_id = value as number;
              break;
            case 'lat':
              inatParams.lat = value as number;
              break;
            case 'lng':
              inatParams.lng = value as number;
              break;
            case 'radius':
              inatParams.radius = value as number;
              break;
            case 'quality_grade':
              inatParams.quality_grade = value as 'research' | 'needs_id' | 'casual';
              break;
            case 'iconic_taxa':
              inatParams.iconic_taxa = value as string[];
              break;
            case 'd1':
              inatParams.d1 = value as string;
              break;
            case 'd2':
              inatParams.d2 = value as string;
              break;
            case 'country':
              // iNaturalist doesn't have direct country filter, could map to place_id
              break;
            case 'year':
              // Convert year to date range
              if (typeof value === 'string' || typeof value === 'number') {
                const year = value.toString();
                inatParams.d1 = `${year}-01-01`;
                inatParams.d2 = `${year}-12-31`;
              }
              break;
          }
        }
      });
    }

    return inatParams;
  }

  private transformToUnified(inatObservation: iNaturalistObservation): UnifiedOccurrence {
    const [latitude, longitude] = inatObservation.location || [undefined, undefined];

    return {
      id: `inaturalist:${inatObservation.id}`,
      source: 'inaturalist',
      sourceId: inatObservation.id.toString(),
      taxon: {
        scientificName: inatObservation.scientific_name,
        canonicalName: inatObservation.taxon?.name,
        vernacularName: inatObservation.common_name || inatObservation.taxon?.preferred_common_name,
        kingdom: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'kingdom'),
        phylum: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'phylum'),
        class: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'class'),
        order: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'order'),
        family: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'family'),
        genus: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'genus'),
        species: this.extractTaxonRank(inatObservation.taxon?.ancestry, 'species'),
        taxonRank: inatObservation.taxon?.rank,
        taxonomicStatus: 'accepted', // iNaturalist generally uses accepted names
        taxonKey: inatObservation.taxon?.id?.toString(),
      },
      location: {
        latitude,
        longitude,
        coordinateUncertainty: inatObservation.positional_accuracy || undefined,
        locality: inatObservation.place_guess,
        // iNaturalist doesn't provide structured location data like country, state
      },
      observation: {
        eventDate: inatObservation.observed_on,
        year: inatObservation.observed_on_details?.year,
        month: inatObservation.observed_on_details?.month,
        basisOfRecord: 'HUMAN_OBSERVATION',
        recordedBy: inatObservation.user.name || inatObservation.user.login,
        identifiedBy: inatObservation.user.name || inatObservation.user.login,
        individualCount: 1, // iNaturalist typically records individual observations
        associatedMedia: inatObservation.photos.map((photo) => photo.medium_url),
      },
      metadata: {
        license: this.mapLicense(inatObservation.photos[0]?.license_code),
        rightsHolder: inatObservation.photos[0]?.attribution,
        datasetName: 'iNaturalist Research-grade Observations',
        publisher: 'iNaturalist',
        references: inatObservation.uri,
        originalData: inatObservation,
        processingNotes: [
          `Quality grade: ${inatObservation.quality_grade}`,
          `Identifications: ${inatObservation.identifications_count}`,
        ],
      },
      confidence: this.calculateConfidence(inatObservation),
      lastUpdated: inatObservation.updated_at,
      extensions: {
        qualityGrade: inatObservation.quality_grade,
        identificationsCount: inatObservation.identifications_count,
        photos: inatObservation.photos,
        geoprivacy: inatObservation.geoprivacy,
        iconicTaxonName: inatObservation.iconic_taxon_name,
        timeObservedAt: inatObservation.time_observed_at,
        speciesGuess: inatObservation.species_guess,
      },
    };
  }

  private extractTaxonRank(ancestry: string | undefined, rank: string): string | undefined {
    // iNaturalist ancestry is a slash-separated string of taxon IDs
    // We'd need additional API calls to resolve these to names
    // For now, return undefined - this could be enhanced later
    return undefined;
  }

  private mapLicense(licenseCode: string | null): string | undefined {
    const licenseMap: Record<string, string> = {
      'cc-by': 'CC BY',
      'cc-by-nc': 'CC BY-NC',
      'cc-by-sa': 'CC BY-SA',
      'cc-by-nc-sa': 'CC BY-NC-SA',
      'cc-by-nd': 'CC BY-ND',
      'cc-by-nc-nd': 'CC BY-NC-ND',
      cc0: 'CC0',
    };

    return licenseCode ? licenseMap[licenseCode] || licenseCode : undefined;
  }

  private calculateConfidence(observation: iNaturalistObservation): number {
    let confidence = 0.5; // Base confidence for citizen science data

    // Increase confidence based on quality grade
    switch (observation.quality_grade) {
      case 'research':
        confidence += 0.4;
        break;
      case 'needs_id':
        confidence += 0.2;
        break;
      case 'casual':
        confidence += 0.1;
        break;
    }

    // Increase confidence based on number of identifications
    if (observation.identifications_count > 3) {
      confidence += 0.1;
    }

    // Increase confidence if has photos
    if (observation.photos.length > 0) {
      confidence += 0.1;
    }

    // Increase confidence if has precise location
    if (observation.positional_accuracy && observation.positional_accuracy < 100) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private calculateQueryComplexity(params: SearchParams): number {
    let complexity = 1;

    if (params.query) {
      complexity += 1;
    }
    if (params.filters) {
      complexity += Object.keys(params.filters).length;
    }
    if (params.sort) {
      complexity += params.sort.length;
    }

    return complexity;
  }
}

export { iNaturalistDataSourceClient };
