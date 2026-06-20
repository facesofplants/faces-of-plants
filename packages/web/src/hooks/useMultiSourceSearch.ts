import { useState, useCallback } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

export interface MultiSourceSearchParams {
  query?: string;
  sources?: string[];
  filters?: Record<string, unknown>;
  options?: {
    maxResults?: number;
    timeout?: number;
    mergeStrategy?: 'union' | 'intersection' | 'priority';
    deduplication?: boolean;
    requireAllSources?: boolean;
  };
}

export interface MultiSourceSearchResult {
  results: GBIFOccurrence[];
  sources: SourceExecutionResult[];
  metadata: {
    totalCount: number;
    executionTime: number;
    sourcesQueried: number;
    sourcesSuccessful: number;
    deduplicationApplied: boolean;
    mergeStrategy: string;
    queryComplexity: number;
  };
}

export interface SourceExecutionResult {
  source: string;
  success: boolean;
  results: GBIFOccurrence[];
  count: number;
  totalCount?: number;
  executionTime: number;
  error?: string;
  metadata?: {
    cacheHit: boolean;
    rateLimit?: boolean;
    queryTransformed?: boolean;
  };
}

export interface DataSourceInfo {
  id: string;
  name: string;
  version: string;
  baseUrl?: string;
  capabilities: {
    type: string;
    operations: string[];
    filters: string[];
  }[];
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export function useMultiSourceSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MultiSourceSearchResult | null>(null);

  const search = useCallback(async (params: MultiSourceSearchParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/multi-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResult(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    search,
    isLoading,
    error,
    result,
  };
}

export function useDataSources() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<DataSourceInfo[]>([]);

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/multi-source?action=sources');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch sources');
      }

      setSources(data.data.sources);
      return data.data.sources;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sources,
    fetchSources,
    isLoading,
    error,
  };
}

interface HealthCheckResult {
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    totalProviders: number;
    healthyProviders: number;
  };
  sources: Record<
    string,
    {
      healthy: boolean;
      responseTime?: number;
      lastCheck?: string;
    }
  >;
}

export function useHealthCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/multi-source?action=health');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Health check failed');
      }

      setHealth(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    health,
    checkHealth,
    isLoading,
    error,
  };
}

// Convenience hook for backward compatibility with existing map search
export function useEnhancedMapSearch() {
  const { search, isLoading, error, result } = useMultiSourceSearch();

  const searchMap = useCallback(
    async (params: {
      species?: string;
      country?: string;
      hasCoordinate?: boolean;
      limit?: number;
      basisOfRecord?: string[];
      countries?: string[];
      dateRange?: { start: string; end: string };
      elevationRange?: { min: number; max: number };
      selectedHabitats?: string[];
    }) => {
      // Transform legacy parameters to multi-source format
      const multiSourceParams: MultiSourceSearchParams = {
        query: params.species,
        filters: {
          country: params.country,
          hasCoordinate: params.hasCoordinate,
          basisOfRecord: params.basisOfRecord,
          countries: params.countries,
          dateRange: params.dateRange,
          elevationRange: params.elevationRange,
          selectedHabitats: params.selectedHabitats,
        },
        options: {
          maxResults: params.limit || 200,
          mergeStrategy: 'union',
          deduplication: true,
        },
      };

      return await search(multiSourceParams);
    },
    [search],
  );

  return {
    searchMap,
    isLoading,
    error,
    result,
  };
}
