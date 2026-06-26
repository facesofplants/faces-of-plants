/**
 * iNaturalist API client
 * Provides access to citizen science biodiversity observations
 */

import { RetryService } from '../../core/src/services';

export interface iNaturalistObservation {
  id: number;
  observed_on: string;
  observed_on_details: {
    date: string;
    week: number;
    month: number;
    year: number;
  };
  time_observed_at: string | null;
  place_guess: string;
  location: [number, number] | null; // [lat, lng]
  positional_accuracy: number | null;
  geoprivacy: string | null;
  taxon: {
    id: number;
    name: string;
    rank: string;
    common_name?: {
      name: string;
    };
    preferred_common_name?: string;
    iconic_taxon_name?: string;
    ancestry?: string;
  } | null;
  user: {
    id: number;
    login: string;
    name?: string;
  };
  photos: Array<{
    id: number;
    license_code: string | null;
    url: string;
    attribution: string;
    square_url: string;
    medium_url: string;
    large_url: string;
  }>;
  quality_grade: 'research' | 'needs_id' | 'casual';
  identifications_count: number;
  species_guess: string | null;
  scientific_name: string;
  common_name: string | null;
  iconic_taxon_name: string | null;
  created_at: string;
  updated_at: string;
  uri: string;
}

export interface iNaturalistSearchParams {
  q?: string;
  taxon_name?: string;
  place_id?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  d1?: string; // start date YYYY-MM-DD
  d2?: string; // end date YYYY-MM-DD
  created_d1?: string;
  created_d2?: string;
  quality_grade?: 'research' | 'needs_id' | 'casual';
  iconic_taxa?: string[];
  order?: 'desc' | 'asc';
  order_by?: 'created_at' | 'observed_on' | 'votes' | 'id';
  page?: number;
  per_page?: number;
  only_id?: boolean;
  locale?: string;
}

export interface iNaturalistSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: iNaturalistObservation[];
}

interface iNaturalistClientOptions {
  userAgent?: string;
}

export class iNaturalistClient {
  private readonly baseUrl = 'https://api.inaturalist.org/v1';
  private userAgent: string;
  private retryService: RetryService;

  constructor(options: iNaturalistClientOptions = {}) {
    this.retryService = new RetryService();
    this.userAgent = options.userAgent || process.env.INATURALIST_USER_AGENT || 'faces-of-plants/1.0';
  }

  async searchObservations(params: iNaturalistSearchParams): Promise<iNaturalistSearchResponse> {
    return this.retryService.executeWithRetry(async () => {
      const searchParams = new URLSearchParams();

      // Add search parameters
      if (params.q) {
        searchParams.append('q', params.q);
      }
      if (params.taxon_name) {
        searchParams.append('taxon_name', params.taxon_name);
      }
      if (params.place_id) {
        searchParams.append('place_id', params.place_id.toString());
      }
      if (params.lat) {
        searchParams.append('lat', params.lat.toString());
      }
      if (params.lng) {
        searchParams.append('lng', params.lng.toString());
      }
      if (params.radius) {
        searchParams.append('radius', params.radius.toString());
      }
      if (params.d1) {
        searchParams.append('d1', params.d1);
      }
      if (params.d2) {
        searchParams.append('d2', params.d2);
      }
      if (params.created_d1) {
        searchParams.append('created_d1', params.created_d1);
      }
      if (params.created_d2) {
        searchParams.append('created_d2', params.created_d2);
      }
      if (params.quality_grade) {
        searchParams.append('quality_grade', params.quality_grade);
      }
      if (params.iconic_taxa?.length) {
        params.iconic_taxa.forEach((taxon) => searchParams.append('iconic_taxa[]', taxon));
      }
      if (params.order) {
        searchParams.append('order', params.order);
      }
      if (params.order_by) {
        searchParams.append('order_by', params.order_by);
      }
      if (params.page) {
        searchParams.append('page', params.page.toString());
      }
      if (params.per_page) {
        searchParams.append('per_page', params.per_page.toString());
      }
      if (params.only_id) {
        searchParams.append('only_id', params.only_id.toString());
      }
      if (params.locale) {
        searchParams.append('locale', params.locale);
      }

      const url = `${this.baseUrl}/observations?${searchParams.toString()}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<iNaturalistSearchResponse>;
    }, 'iNaturalist searchObservations');
  }

  async getObservation(id: number): Promise<iNaturalistObservation> {
    return this.retryService.executeWithRetry(async () => {
      const url = `${this.baseUrl}/observations/${id}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { results: iNaturalistObservation[] };
      return data.results[0];
    }, 'iNaturalist getObservation');
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message?: string }> {
    try {
      // Health checks should not retry to get accurate status
      const response = await fetch(`${this.baseUrl}/observations?per_page=1`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
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
