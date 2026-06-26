import { RetryService } from '../../core/src/services';
import { type GBIFSearchParams, type GBIFOccurrence } from '../../core/src/types';

interface GBIFClientOptions {
  baseUrl?: string;
  userAgent?: string;
}

export class GBIFClient {
  private baseUrl: string;
  private retryService: RetryService;
  private userAgent: string;

  constructor(options: GBIFClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.GBIF_API_URL || 'https://api.gbif.org/v1';
    this.retryService = new RetryService();
    this.userAgent =
      options.userAgent ||
      process.env.GBIF_USER_AGENT ||
      'FaceOfPlants/0.4.1 (https://facesofplants.org; facesofplants@gmail.com)';
  }

  private async fetchWithHeaders(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      return await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchOccurrences(params: GBIFSearchParams): Promise<{
    results: GBIFOccurrence[];
    count: number;
    endOfRecords: boolean;
  }> {
    return this.retryService.executeWithRetry(async () => {
      const searchParams = new URLSearchParams();

      // Always filter for Plantae kingdom (kingdomKey=6 is deterministic vs string match)
      const enhancedParams = {
        ...params,
        kingdomKey: 6,
      };

      Object.entries(enhancedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          // Only add mediaType if present and not empty
          if (key === 'mediaType' && value) {
            searchParams.append('mediaType', String(value));
          } else if (key !== 'mediaType') {
            searchParams.append(key, value.toString());
          }
        }
      });

      const requestUrl = `${this.baseUrl}/occurrence/search?${searchParams.toString()}`;
      console.log(`[GBIFClient] Fetching from URL: ${requestUrl}`);
      console.log(`[GBIFClient] Filtering for Plantae kingdom only (kingdomKey=6)`);

      const response = await this.fetchWithHeaders(requestUrl);

      console.log(`[GBIFClient] Response Status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GBIFClient] Response Error: ${errorText}`);
        throw new Error(`GBIF API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as {
        results: any[];
        count: number;
        endOfRecords: boolean;
      };

      return {
        results: data.results || [],
        count: data.count || 0,
        endOfRecords: data.endOfRecords || false,
      };
    }, 'GBIF searchOccurrences');
  }

  async getSpeciesInfo(key: string): Promise<any> {
    return this.retryService.executeWithRetry(async () => {
      const response = await this.fetchWithHeaders(`${this.baseUrl}/species/${key}`);

      if (!response.ok) {
        throw new Error(`GBIF API error: ${response.status}`);
      }

      return response.json();
    }, 'GBIF getSpeciesInfo');
  }
}
