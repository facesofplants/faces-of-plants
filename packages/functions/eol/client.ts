/**
 * Encyclopedia of Life (EOL) API Client
 *
 * EOL provides access to comprehensive biodiversity information including
 * species pages, images, and occurrence data from various sources.
 *
 * API Documentation: https://eol.org/docs/what-is-eol/data-services/classic-apis
 */

export interface EOLSearchParams {
  q: string;
  page?: number;
  per_page?: number;
  filter_by_taxon_concept_id?: number;
  filter_by_hierarchy_entry_id?: number;
  filter_by_string?: string;
  cache_ttl?: number;
}

export interface EOLSearchResult {
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  results: EOLSearchResultItem[];
}

export interface EOLSearchResultItem {
  id: number;
  title: string;
  link: string;
  content: string;
  richness_score: number;
  synonyms: string[];
  common_names: EOLCommonName[];
}

export interface EOLCommonName {
  name: string;
  language: string;
  preferred?: boolean;
}

export interface EOLPageParams {
  id: number;
  images_per_page?: number;
  images_page?: number;
  videos_per_page?: number;
  videos_page?: number;
  sounds_per_page?: number;
  sounds_page?: number;
  maps_per_page?: number;
  maps_page?: number;
  texts_per_page?: number;
  texts_page?: number;
  subjects?: string;
  licenses?: string;
  details?: boolean;
  common_names?: boolean;
  synonyms?: boolean;
  references?: boolean;
  taxonomy?: boolean;
  vetted?: number;
  cache_ttl?: number;
}

export interface EOLPage {
  identifier: number;
  scientificName: string;
  richness_score: number;
  synonyms: EOLSynonym[];
  vernacularNames: EOLVernacularName[];
  dataObjects: EOLDataObject[];
  taxonConcepts: EOLTaxonConcept[];
  dwc: EOLDarwinCore;
}

export interface EOLSynonym {
  synonym: string;
  relationship: string;
  resource: string;
}

export interface EOLVernacularName {
  vernacularName: string;
  language: string;
  eol_preferred?: boolean;
  preferred?: boolean;
}

export interface EOLDataObject {
  identifier: string;
  dataObjectVersionID: number;
  dataType: string;
  dataSubtype: string;
  vettedStatus: string;
  dataRating: number;
  subject: string;
  title: string;
  language: string;
  license: string;
  rights: string;
  rightsHolder: string;
  audience: string;
  source: string;
  description: string;
  mediaURL: string;
  eolMediaURL: string;
  eolThumbnailURL: string;
  agents: EOLAgent[];
  created: string;
  modified: string;
}

export interface EOLAgent {
  role: string;
  homepage: string;
  logoURL: string;
  full_name: string;
}

export interface EOLTaxonConcept {
  identifier: number;
  scientificName: string;
  nameAccordingTo: string;
  canonicalForm: string;
  sourceIdentifier: string;
  taxonRank: string;
  parentNameUsageID: number;
  taxonomicStatus: string;
}

export interface EOLDarwinCore {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  scientificName: string;
  taxonRank: string;
}

export interface EOLHierarchyEntry {
  taxonID: number;
  parentNameUsageID: number;
  scientificName: string;
  taxonRank: string;
  source: string;
  nameAccordingTo: string;
  vernacularNames: EOLVernacularName[];
  synonyms: EOLSynonym[];
  children: EOLHierarchyEntry[];
}

export interface EOLHealthStatus {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

import { RetryService } from '../../core/src/services';

interface EOLClientOptions {
  apiKey?: string;
  userAgent?: string;
}

export class EOLClient {
  private baseUrl = 'https://eol.org/api';
  private userAgent: string;
  private apiKey?: string;
  private retryService: RetryService;

  constructor(options: EOLClientOptions = {}) {
    this.retryService = new RetryService();
    this.apiKey = options.apiKey;
    this.userAgent = options.userAgent || process.env.EOL_USER_AGENT || 'faces-of-plants/1.0.0';
  }

  async searchPages(params: EOLSearchParams): Promise<EOLSearchResult> {
    return this.retryService.executeWithRetry(async () => {
      const url = new URL(`${this.baseUrl}/search/1.0.json`);

      // Add search parameters
      url.searchParams.append('q', params.q);
      if (params.page) {
        url.searchParams.append('page', params.page.toString());
      }
      if (params.per_page) {
        url.searchParams.append('per_page', params.per_page.toString());
      }
      if (params.filter_by_taxon_concept_id) {
        url.searchParams.append(
          'filter_by_taxon_concept_id',
          params.filter_by_taxon_concept_id.toString()
        );
      }
      if (params.filter_by_hierarchy_entry_id) {
        url.searchParams.append(
          'filter_by_hierarchy_entry_id',
          params.filter_by_hierarchy_entry_id.toString()
        );
      }
      if (params.filter_by_string) {
        url.searchParams.append('filter_by_string', params.filter_by_string);
      }
      if (params.cache_ttl) {
        url.searchParams.append('cache_ttl', params.cache_ttl.toString());
      }
      if (this.apiKey) {
        url.searchParams.append('key', this.apiKey);
      }

      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`EOL API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as any;

        return {
          totalResults: data.totalResults || 0,
          startIndex: data.startIndex || 0,
          itemsPerPage: data.itemsPerPage || 0,
          results: data.results || [],
        };
      } catch (error) {
        console.error('[EOLClient] Search error:', error);
        throw error;
      }
    }, 'EOL searchPages');
  }

  async getPage(params: EOLPageParams): Promise<EOLPage> {
    return this.retryService.executeWithRetry(async () => {
      const url = new URL(`${this.baseUrl}/pages/1.0/${params.id}.json`);

      // Add page parameters
      if (params.images_per_page) {
        url.searchParams.append('images_per_page', params.images_per_page.toString());
      }
      if (params.images_page) {
        url.searchParams.append('images_page', params.images_page.toString());
      }
      if (params.videos_per_page) {
        url.searchParams.append('videos_per_page', params.videos_per_page.toString());
      }
      if (params.videos_page) {
        url.searchParams.append('videos_page', params.videos_page.toString());
      }
      if (params.sounds_per_page) {
        url.searchParams.append('sounds_per_page', params.sounds_per_page.toString());
      }
      if (params.sounds_page) {
        url.searchParams.append('sounds_page', params.sounds_page.toString());
      }
      if (params.maps_per_page) {
        url.searchParams.append('maps_per_page', params.maps_per_page.toString());
      }
      if (params.maps_page) {
        url.searchParams.append('maps_page', params.maps_page.toString());
      }
      if (params.texts_per_page) {
        url.searchParams.append('texts_per_page', params.texts_per_page.toString());
      }
      if (params.texts_page) {
        url.searchParams.append('texts_page', params.texts_page.toString());
      }
      if (params.subjects) {
        url.searchParams.append('subjects', params.subjects);
      }
      if (params.licenses) {
        url.searchParams.append('licenses', params.licenses);
      }
      if (params.details) {
        url.searchParams.append('details', params.details.toString());
      }
      if (params.common_names) {
        url.searchParams.append('common_names', params.common_names.toString());
      }
      if (params.synonyms) {
        url.searchParams.append('synonyms', params.synonyms.toString());
      }
      if (params.references) {
        url.searchParams.append('references', params.references.toString());
      }
      if (params.taxonomy) {
        url.searchParams.append('taxonomy', params.taxonomy.toString());
      }
      if (params.vetted) {
        url.searchParams.append('vetted', params.vetted.toString());
      }
      if (params.cache_ttl) {
        url.searchParams.append('cache_ttl', params.cache_ttl.toString());
      }
      if (this.apiKey) {
        url.searchParams.append('key', this.apiKey);
      }

      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`EOL API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as EOLPage;
        return data;
      } catch (error) {
        console.error('[EOLClient] Get page error:', error);
        throw error;
      }
    }, 'EOL getPage');
  }

  async getHierarchyEntries(id: number): Promise<EOLHierarchyEntry[]> {
    return this.retryService.executeWithRetry(async () => {
      const url = new URL(`${this.baseUrl}/hierarchy_entries/1.0/${id}.json`);

      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`EOL API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        return data.children || [];
      } catch (error) {
        console.error('[EOLClient] Get hierarchy entries error:', error);
        throw error;
      }
    }, 'EOL getHierarchyEntries');
  }

  async healthCheck(): Promise<EOLHealthStatus> {
    try {
      // Health checks should not retry to get accurate status
      // Test with a simple search
      const response = await fetch(`${this.baseUrl}/search/1.0.json?q=test&per_page=1`, {
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { status: 'healthy' };
      } else {
        return {
          status: 'unhealthy',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
