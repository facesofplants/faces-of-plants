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

import { EOLClient, type EOLSearchParams, type EOLSearchResultItem, type EOLPage } from './client';

export class EOLProvider implements DataSourceProvider {
  id = 'eol';
  name = 'Encyclopedia of Life';
  version = '1.0.0';
  baseUrl = 'https://eol.org/api';

  capabilities: DataSourceCapability[] = [
    {
      type: 'occurrence',
      operations: [
        {
          name: 'search',
          description: 'Search for species information and media',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Search query' },
              page: { type: 'number', description: 'Page number' },
              per_page: {
                type: 'number',
                minimum: 1,
                maximum: 500,
                description: 'Results per page',
              },
              filter_by_taxon_concept_id: {
                type: 'number',
                description: 'Filter by taxon concept ID',
              },
              filter_by_hierarchy_entry_id: {
                type: 'number',
                description: 'Filter by hierarchy entry ID',
              },
              filter_by_string: { type: 'string', description: 'Filter by string match' },
            },
          },
        },
        {
          name: 'get',
          description: 'Get species page by ID',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'EOL page ID' },
            },
            required: ['id'],
          },
        },
      ],
      filters: [
        { name: 'q', type: 'string', description: 'Search query' },
        { name: 'taxon_concept_id', type: 'number', description: 'Taxon concept ID' },
        { name: 'hierarchy_entry_id', type: 'number', description: 'Hierarchy entry ID' },
        { name: 'filter_by_string', type: 'string', description: 'String filter' },
        { name: 'richness_score', type: 'number', description: 'Minimum richness score' },
      ],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          scientificName: { type: 'string' },
          vernacularNames: { type: 'array' },
          synonyms: { type: 'array' },
          dataObjects: { type: 'array' },
          richness_score: { type: 'number' },
        },
      },
      examples: [
        {
          description: 'Search for oak trees',
          query: 'oak tree',
          parameters: { q: 'Quercus', per_page: 50 },
          expectedResults: 30,
        },
        {
          description: 'Find species with high richness score',
          query: 'plant species',
          parameters: { q: 'plant', filter_by_string: 'species' },
          expectedResults: 100,
        },
      ],
    },
    {
      type: 'images',
      operations: [
        {
          name: 'search',
          description: 'Search for species images and media',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Search query' },
              images_per_page: { type: 'number', description: 'Number of images per page' },
              subjects: { type: 'string', description: 'Subject filter' },
              licenses: { type: 'string', description: 'License filter' },
            },
          },
        },
      ],
      filters: [
        { name: 'subjects', type: 'string', description: 'Subject categories' },
        { name: 'licenses', type: 'string', description: 'License types' },
        { name: 'vetted', type: 'number', description: 'Vetted status' },
      ],
      schema: {
        type: 'object',
        properties: {
          mediaURL: { type: 'string' },
          eolMediaURL: { type: 'string' },
          eolThumbnailURL: { type: 'string' },
          license: { type: 'string' },
          rightsHolder: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
      examples: [
        {
          description: 'Find plant images',
          query: 'plant photos',
          parameters: { q: 'plant', subjects: 'GeneralDescription' },
          expectedResults: 50,
        },
      ],
    },
    {
      type: 'taxonomy',
      operations: [
        {
          name: 'search',
          description: 'Search taxonomic information',
          parameters: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Taxonomic search query' },
              hierarchy_entry_id: { type: 'number', description: 'Hierarchy entry ID' },
            },
          },
        },
      ],
      filters: [
        { name: 'taxon_rank', type: 'string', description: 'Taxonomic rank' },
        { name: 'taxonomic_status', type: 'string', description: 'Taxonomic status' },
      ],
      schema: {
        type: 'object',
        properties: {
          scientificName: { type: 'string' },
          taxonRank: { type: 'string' },
          taxonomicStatus: { type: 'string' },
          kingdom: { type: 'string' },
          phylum: { type: 'string' },
          class: { type: 'string' },
          order: { type: 'string' },
          family: { type: 'string' },
          genus: { type: 'string' },
        },
      },
      examples: [
        {
          description: 'Get taxonomic hierarchy',
          query: 'plant taxonomy',
          parameters: { q: 'Plantae' },
          expectedResults: 20,
        },
      ],
    },
  ];

  rateLimit: RateLimit = {
    requestsPerSecond: 1, // EOL is conservative with rate limits
    requestsPerMinute: 30,
    requestsPerHour: 1000,
    burstLimit: 3,
  };

  client: EOLDataSourceClient;

  constructor() {
    this.client = new EOLDataSourceClient();
  }
}

class EOLDataSourceClient implements DataSourceClient {
  private eolClient: EOLClient;

  constructor() {
    this.eolClient = new EOLClient();
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Transform generic search params to EOL-specific params
      const eolParams = this.transformSearchParams(params);

      const result = await this.eolClient.searchPages(eolParams);

      // Get detailed information for each result
      const detailedResults = await Promise.all(
        result.results.slice(0, Math.min(result.results.length, 20)).map(async (item) => {
          try {
            const page = await this.eolClient.getPage({
              id: item.id,
              images_per_page: 5,
              common_names: true,
              synonyms: true,
              taxonomy: true,
              details: true,
            });
            return this.transformToUnified(item, page);
          } catch (error) {
            console.warn(`[EOLDataSourceClient] Failed to get page details for ${item.id}:`, error);
            return this.transformToUnified(item);
          }
        })
      );

      return {
        results: detailedResults,
        count: detailedResults.length,
        totalCount: result.totalResults,
        endOfRecords: result.results.length < (eolParams.per_page || 30),
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          dataSourceVersion: '1.0.0',
          queryComplexity: this.calculateQueryComplexity(params),
        },
      };
    } catch (error) {
      console.error('[EOLDataSourceClient] Search error:', error);
      throw error;
    }
  }

  async get(id: string): Promise<UnifiedOccurrence> {
    try {
      const page = await this.eolClient.getPage({
        id: parseInt(id),
        images_per_page: 10,
        common_names: true,
        synonyms: true,
        taxonomy: true,
        details: true,
      });

      return this.transformToUnified(undefined, page);
    } catch (error) {
      console.error('[EOLDataSourceClient] Get error:', error);
      throw error;
    }
  }

  async batch(ids: string[]): Promise<UnifiedOccurrence[]> {
    try {
      const results = await Promise.all(ids.map((id) => this.get(id)));
      return results;
    } catch (error) {
      console.error('[EOLDataSourceClient] Batch error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const health = await this.eolClient.healthCheck();

      return {
        healthy: health.status === 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: health.status === 'unhealthy' ? [health.message || 'Unknown error'] : undefined,
        metadata: {
          endpoint: 'https://eol.org/api',
          testQuery: 'search/1.0.json?q=test&per_page=1',
        },
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          endpoint: 'https://eol.org/api',
          testQuery: 'search/1.0.json?q=test&per_page=1',
        },
      };
    }
  }

  private transformSearchParams(params: SearchParams): EOLSearchParams {
    const eolParams: EOLSearchParams = {
      q: params.query || '',
      per_page: params.limit || 30,
      page: params.offset ? Math.floor(params.offset / (params.limit || 30)) + 1 : 1,
    };

    // Add filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          switch (key) {
            case 'taxon_concept_id':
              eolParams.filter_by_taxon_concept_id = value as number;
              break;
            case 'hierarchy_entry_id':
              eolParams.filter_by_hierarchy_entry_id = value as number;
              break;
            case 'filter_by_string':
              eolParams.filter_by_string = value as string;
              break;
          }
        }
      });
    }

    return eolParams;
  }

  private transformToUnified(searchItem?: EOLSearchResultItem, page?: EOLPage): UnifiedOccurrence {
    const identifier = page?.identifier || searchItem?.id;
    const scientificName = page?.scientificName || searchItem?.title || '';

    // Extract common names
    const pageCommonNames = page?.vernacularNames || [];
    const searchCommonNames = searchItem?.common_names || [];

    const preferredCommonName =
      pageCommonNames.find((cn) => cn.eol_preferred || cn.preferred)?.vernacularName ||
      pageCommonNames.find((cn) => cn.language === 'en')?.vernacularName ||
      searchCommonNames.find((cn) => cn.preferred)?.name ||
      searchCommonNames.find((cn) => cn.language === 'en')?.name ||
      pageCommonNames[0]?.vernacularName ||
      searchCommonNames[0]?.name;

    // Extract media URLs
    const mediaUrls: string[] = [];
    if (page?.dataObjects) {
      page.dataObjects
        .filter((obj) => obj.dataType === 'StillImage' && obj.mediaURL)
        .forEach((obj) => {
          if (obj.mediaURL) {
            mediaUrls.push(obj.mediaURL);
          }
          if (obj.eolMediaURL) {
            mediaUrls.push(obj.eolMediaURL);
          }
        });
    }

    // Extract taxonomic information
    const dwc = page?.dwc;

    return {
      id: `eol:${identifier}`,
      source: 'eol',
      sourceId: identifier?.toString() || '',
      taxon: {
        scientificName,
        canonicalName: scientificName,
        vernacularName: preferredCommonName,
        kingdom: dwc?.kingdom,
        phylum: dwc?.phylum,
        class: dwc?.class,
        order: dwc?.order,
        family: dwc?.family,
        genus: dwc?.genus,
        species: dwc?.scientificName,
        taxonRank: dwc?.taxonRank,
        taxonomicStatus: page?.taxonConcepts?.[0]?.taxonomicStatus || 'accepted',
        taxonKey: identifier?.toString(),
      },
      location: {
        // EOL doesn't provide specific occurrence locations
        // It's more of a species information aggregator
      },
      observation: {
        basisOfRecord: 'LITERATURE',
        // EOL aggregates information from multiple sources
        // Individual occurrence data is limited
        associatedMedia: mediaUrls.slice(0, 5), // Limit to first 5 images
      },
      metadata: {
        license: page?.dataObjects?.[0]?.license,
        rightsHolder: page?.dataObjects?.[0]?.rightsHolder,
        datasetName: 'Encyclopedia of Life',
        publisher: 'Encyclopedia of Life',
        references: searchItem?.link || `https://eol.org/pages/${identifier}`,
        originalData: { searchItem, page },
        processingNotes: [
          `Richness score: ${page?.richness_score || searchItem?.richness_score || 'N/A'}`,
          `Common names: ${pageCommonNames.length + searchCommonNames.length}`,
          `Synonyms: ${page?.synonyms?.length || searchItem?.synonyms?.length || 0}`,
          `Media objects: ${page?.dataObjects?.length || 0}`,
        ],
      },
      confidence: this.calculateConfidence(searchItem, page),
      lastUpdated: new Date().toISOString(), // EOL doesn't provide last modified dates consistently
      extensions: {
        richnessScore: page?.richness_score || searchItem?.richness_score,
        vernacularNames: [...pageCommonNames, ...searchCommonNames],
        synonyms: page?.synonyms || searchItem?.synonyms || [],
        dataObjects: page?.dataObjects || [],
        taxonConcepts: page?.taxonConcepts || [],
        eolPageId: identifier,
      },
    };
  }

  private calculateConfidence(searchItem?: EOLSearchResultItem, page?: EOLPage): number {
    let confidence = 0.6; // Base confidence for aggregated data

    // Increase confidence based on richness score
    const richnessScore = page?.richness_score || searchItem?.richness_score || 0;
    if (richnessScore > 50) {
      confidence += 0.3;
    } else if (richnessScore > 20) {
      confidence += 0.2;
    } else if (richnessScore > 5) {
      confidence += 0.1;
    }

    // Increase confidence if has media
    if (page?.dataObjects && page.dataObjects.length > 0) {
      confidence += 0.1;
    }

    // Increase confidence if has multiple common names
    const totalCommonNames =
      (page?.vernacularNames?.length || 0) + (searchItem?.common_names?.length || 0);
    if (totalCommonNames > 1) {
      confidence += 0.05;
    }

    // Increase confidence if has taxonomic information
    if (page?.dwc && page.dwc.kingdom) {
      confidence += 0.05;
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

export { EOLDataSourceClient };
