import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { type CacheService } from '../../core/src/services/CacheService';
import {
  type DataSourceProvider,
  type DataSourceClient,
  type UnifiedOccurrence,
  type SearchParams,
  type SearchResult,
  type HealthStatus,
  type DataSourceCapability,
  type RateLimit,
} from '../../core/src/services/types';
import { type GBIFOccurrence, type GBIFSearchParams } from '../../core/src/types';

import { GBIFClient } from './client';

interface GBIFProviderOptions {
  userAgent?: string;
}

export class GBIFProvider implements DataSourceProvider {
  id = 'gbif';
  name = 'Global Biodiversity Information Facility';
  version = '1.0.0';
  baseUrl = 'https://api.gbif.org/v1';

  capabilities: DataSourceCapability[] = [
    {
      type: 'occurrence',
      operations: [
        {
          name: 'search',
          description: 'Search for occurrence records',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Free text search' },
              scientificName: { type: 'string', description: 'Scientific name' },
              country: { type: 'string', description: 'Country code' },
              year: { type: 'string', description: 'Year or year range' },
              hasCoordinate: { type: 'boolean', description: 'Has coordinate data' },
              limit: { type: 'number', minimum: 1, maximum: 300, description: 'Number of results' },
              offset: { type: 'number', minimum: 0, description: 'Offset for pagination' },
            },
          },
        },
        {
          name: 'get',
          description: 'Get occurrence by key',
          parameters: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'GBIF occurrence key' },
            },
            required: ['key'],
          },
        },
        {
          name: 'batch',
          description: 'Get multiple occurrences by keys',
          parameters: {
            type: 'object',
            properties: {
              keys: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of GBIF occurrence keys (max 100)',
              },
            },
            required: ['keys'],
          },
        },
      ],
      filters: [
        { name: 'q', type: 'string', description: 'Free text search' },
        { name: 'scientificName', type: 'string', description: 'Scientific name' },
        { name: 'country', type: 'string', description: 'Country code (ISO 3166-1 alpha-2)' },
        {
          name: 'year',
          type: 'string',
          description: 'Year or year range (e.g., "2020" or "2020,2021")',
        },
        {
          name: 'hasCoordinate',
          type: 'boolean',
          description: 'Filter to records with coordinates',
        },
        { name: 'hasGeospatialIssue', type: 'boolean', description: 'Filter by geospatial issues' },
        {
          name: 'basisOfRecord',
          type: 'string',
          description: 'Basis of record',
          enum: [
            'OBSERVATION',
            'HUMAN_OBSERVATION',
            'MACHINE_OBSERVATION',
            'MATERIAL_SAMPLE',
            'PRESERVED_SPECIMEN',
            'FOSSIL_SPECIMEN',
            'LIVING_SPECIMEN',
            'LITERATURE',
          ],
        },
        { name: 'kingdom', type: 'string', description: 'Kingdom name' },
        { name: 'phylum', type: 'string', description: 'Phylum name' },
        { name: 'class', type: 'string', description: 'Class name' },
        { name: 'order', type: 'string', description: 'Order name' },
        { name: 'family', type: 'string', description: 'Family name' },
        { name: 'genus', type: 'string', description: 'Genus name' },
        { name: 'species', type: 'string', description: 'Species name' },
      ],
      schema: {
        type: 'object',
        properties: {
          // This would be the full GBIF occurrence schema
          // For brevity, including key fields
          key: { type: 'number' },
          scientificName: { type: 'string' },
          decimalLatitude: { type: 'number' },
          decimalLongitude: { type: 'number' },
          country: { type: 'string' },
          eventDate: { type: 'string' },
          basisOfRecord: { type: 'string' },
        },
      },
      examples: [
        {
          description: 'Find oak trees in California',
          query: 'oak trees California',
          parameters: { q: 'oak', country: 'US' },
          expectedResults: 1000,
        },
        {
          description: 'Find recent plant observations with coordinates',
          query: 'recent plant observations',
          parameters: { kingdom: 'Plantae', hasCoordinate: true, year: '2023' },
          expectedResults: 5000,
        },
      ],
    },
    {
      type: 'taxonomy',
      operations: [
        {
          name: 'get',
          description: 'Get species information',
          parameters: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'GBIF species key' },
            },
            required: ['key'],
          },
        },
      ],
      filters: [{ name: 'key', type: 'string', description: 'GBIF species key' }],
      schema: {
        type: 'object',
        properties: {
          key: { type: 'number' },
          scientificName: { type: 'string' },
          canonicalName: { type: 'string' },
          rank: { type: 'string' },
          taxonomicStatus: { type: 'string' },
        },
      },
      examples: [
        {
          description: 'Get species information',
          query: 'species info',
          parameters: { key: '5289001' },
          expectedResults: 1,
        },
      ],
    },
  ];

  rateLimit: RateLimit = {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerHour: 36000,
    burstLimit: 20,
  };

  client: GBIFDataSourceClient;

  constructor(cacheService?: CacheService, options?: GBIFProviderOptions) {
    this.client = new GBIFDataSourceClient(cacheService, options);
  }
}

class GBIFDataSourceClient implements DataSourceClient {
  private gbifClient: GBIFClient;
  private cacheService?: CacheService;

  constructor(cacheService?: CacheService, options?: GBIFProviderOptions) {
    this.gbifClient = new GBIFClient({ userAgent: options?.userAgent });
    this.cacheService = cacheService;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Transform generic search params to GBIF-specific params
      const gbifParams = this.transformSearchParams(params);

      // Check cache if cache service is available (cache-aside pattern)
      let cacheHit = false;
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('gbif', 'search', gbifParams);
        const cachedResult = await this.cacheService.get<SearchResult>(cacheKey);

        if (cachedResult) {
          console.log('[GBIFDataSourceClient] Cache hit for key:', cacheKey);
          cacheHit = true;

          // Update metadata to reflect cache hit
          return {
            ...cachedResult,
            metadata: {
              ...cachedResult.metadata,
              executionTime: Date.now() - startTime,
              cacheHit: true,
              dataSourceVersion: cachedResult.metadata?.dataSourceVersion || 'unknown',
              queryComplexity: cachedResult.metadata?.queryComplexity ?? 0,
            },
          };
        }

        console.log('[GBIFDataSourceClient] Cache miss for key:', cacheKey);
      }

      // Cache miss or no cache service - fetch from external API
      const result = await this.gbifClient.searchOccurrences(gbifParams);

      const searchResult: SearchResult = {
        results: result.results.map(this.transformToUnified),
        count: result.results.length,
        totalCount: result.count,
        endOfRecords: result.endOfRecords,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: this.calculateQueryComplexity(params),
        },
      };

      // Store successful response in cache
      if (this.cacheService && !cacheHit) {
        const cacheKey = this.cacheService.generateCacheKey('gbif', 'search', gbifParams);
        await this.cacheService.set(cacheKey, searchResult);
        console.log('[GBIFDataSourceClient] Cached result for key:', cacheKey);
      }

      return searchResult;
    } catch (error) {
      console.error('[GBIFDataSourceClient] Search error:', error);
      throw error;
    }
  }

  async get(id: string): Promise<UnifiedOccurrence> {
    try {
      const result = await this.gbifClient.getSpeciesInfo(id);
      return this.transformToUnified(result);
    } catch (error) {
      console.error('[GBIFDataSourceClient] Get error:', error);
      throw error;
    }
  }

  async batch(ids: string[]): Promise<UnifiedOccurrence[]> {
    try {
      const results = await Promise.all(ids.map((id) => this.get(id)));
      return results;
    } catch (error) {
      console.error('[GBIFDataSourceClient] Batch error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Perform a simple test query
      await this.gbifClient.searchOccurrences({ limit: 1, hasCoordinate: true });

      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        metadata: {
          endpoint: 'https://api.gbif.org/v1',
          testQuery: 'occurrence/search?limit=1&hasCoordinate=true',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          endpoint: 'https://api.gbif.org/v1',
          testQuery: 'occurrence/search?limit=1&hasCoordinate=true',
        },
      };
    }
  }

  private transformSearchParams(params: SearchParams): GBIFSearchParams {
    const gbifParams: GBIFSearchParams = {
      kingdomKey: 6, // Always filter for plants (kingdomKey=6 is deterministic vs string match)
      hasCoordinate: true, // Default to true for map display
      limit: params.limit || 100,
      offset: params.offset || 0,
    };

    // Add query
    if (params.query) {
      gbifParams.q = params.query;
    }

    // Add filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Type assertion for known GBIF parameters
          (gbifParams as any)[key] = value;
        }
      });
    }

    return gbifParams;
  }

  private transformToUnified(gbifOccurrence: GBIFOccurrence): UnifiedOccurrence {
    return {
      id: `gbif:${gbifOccurrence.key}`,
      source: 'gbif',
      sourceId: gbifOccurrence.key?.toString() || '',
      taxon: {
        scientificName: gbifOccurrence.scientificName,
        canonicalName: gbifOccurrence.canonicalName,
        vernacularName: gbifOccurrence.vernacularName,
        kingdom: gbifOccurrence.kingdom,
        phylum: gbifOccurrence.phylum,
        class: gbifOccurrence.class,
        order: gbifOccurrence.order,
        family: gbifOccurrence.family,
        genus: gbifOccurrence.genus,
        species: gbifOccurrence.species,
        taxonomicStatus: gbifOccurrence.taxonomicStatus,
        acceptedName: gbifOccurrence.acceptedScientificName,
        taxonKey: gbifOccurrence.taxonKey?.toString(),
        parentTaxonKey: gbifOccurrence.speciesKey?.toString(),
      },
      location: {
        latitude: gbifOccurrence.decimalLatitude,
        longitude: gbifOccurrence.decimalLongitude,
        country: gbifOccurrence.country,
        countryCode: gbifOccurrence.countryCode,
        stateProvince: gbifOccurrence.stateProvince,
        locality: gbifOccurrence.locality,
        elevation: gbifOccurrence.elevation,
        depth: gbifOccurrence.depth,
        coordinateUncertainty: gbifOccurrence.coordinateUncertaintyInMeters,
        geodeticDatum: gbifOccurrence.geodeticDatum,
        continent: gbifOccurrence.continent,
        waterBody: gbifOccurrence.waterBody,
        higherGeography: gbifOccurrence.higherGeography,
      },
      observation: {
        eventDate: gbifOccurrence.eventDate,
        year: gbifOccurrence.year,
        month: gbifOccurrence.month,
        day: gbifOccurrence.day,
        basisOfRecord: gbifOccurrence.basisOfRecord,
        institutionCode: gbifOccurrence.institutionCode,
        collectionCode: gbifOccurrence.collectionCode,
        catalogNumber: gbifOccurrence.catalogNumber,
        recordedBy: gbifOccurrence.recordedBy,
        identifiedBy: gbifOccurrence.identifiedBy,
        individualCount: gbifOccurrence.individualCount,
        lifeStage: gbifOccurrence.lifeStage,
        reproductiveCondition: gbifOccurrence.reproductiveCondition,
        behavior: gbifOccurrence.behavior,
        establishmentMeans: gbifOccurrence.establishmentMeans,
        occurrenceStatus: gbifOccurrence.occurrenceStatus,
        preparations: gbifOccurrence.preparations,
        associatedMedia: gbifOccurrence.associatedMedia,
      },
      metadata: {
        license: gbifOccurrence.license,
        rightsHolder: gbifOccurrence.rightsHolder,
        datasetName: gbifOccurrence.datasetName,
        publisher: gbifOccurrence.publishingCountry,
        publishingOrganization: gbifOccurrence.publishingOrgKey,
        protocol: gbifOccurrence.protocol,
        lastCrawled: gbifOccurrence.lastCrawled,
        lastParsed: gbifOccurrence.lastParsed,
        references: gbifOccurrence.references,
        datasetKey: gbifOccurrence.datasetName,
        installationKey: gbifOccurrence.installationKey,
        originalData: gbifOccurrence,
      },
      confidence: 1.0, // GBIF data is high confidence
      lastUpdated: gbifOccurrence.lastParsed || new Date().toISOString(),
      extensions: {
        // Store GBIF-specific fields that don't map to unified model
        crawlId: gbifOccurrence.crawlId,
        hostingOrganizationKey: gbifOccurrence.hostingOrganizationKey,
        acceptedTaxonKey: gbifOccurrence.acceptedTaxonKey,
        iucnRedListCategory: gbifOccurrence.iucnRedListCategory,
        coordinateAccuracy: gbifOccurrence.coordinateAccuracy,
        coordinatePrecision: gbifOccurrence.coordinatePrecision,
      },
    };
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

export { GBIFDataSourceClient };
