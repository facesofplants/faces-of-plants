'use client';

import { type LatLngBounds } from 'leaflet';
import { useState, useCallback } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import { storeOccurrences, getOccurrences } from '../../lib/indexeddb';

import type { FilterState } from '../AdvancedFilters';

interface MapSearchParams {
  species?: string;
  country?: string;
  hasCoordinate?: boolean;
  limit?: number;
  // Advanced filters
  basisOfRecord?: string[];
  countries?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  elevationRange?: {
    min?: number;
    max?: number;
  };
  selectedHabitats?: string[];
  boundingBox?: [[number, number], [number, number]];
  hasImage?: boolean;
}

export const useMapSearch = () => {
  const [occurrences, setOccurrences] = useState<GBIFOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const searchOccurrences = useCallback(async (params: MapSearchParams = {}) => {
    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const searchParams = {
        hasCoordinate: true,
        limit: 200,
        ...params,
      };

      console.log('[useMapSearch] Searching with params:', searchParams);

      // 1. Try IndexedDB first (offline-first)
      if (searchParams.species) {
        const cached = await getOccurrences(
          searchParams.species,
          searchParams.country
        );
        if (cached.length > 0) {
          console.log('[useMapSearch] Loaded from IndexedDB:', cached.length);
          setOccurrences(cached as GBIFOccurrence[]);
          setFromCache(true);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch from GBIF API
      const response = await fetch('/api/map-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      console.log('[useMapSearch] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useMapSearch] Response data:', data);

      if (data.success && data.data && Array.isArray(data.data.results)) {
        const results = data.data.results;
        console.log('[useMapSearch] Setting occurrences:', results.length);

        // 3. Store in IndexedDB for offline access
        if (searchParams.species && results.length > 0) {
          await storeOccurrences(
            searchParams.species,
            searchParams.country || 'global',
            results
          );
        }

        setOccurrences(results);
        setFromCache(false);
      } else {
        console.log('[useMapSearch] No results or error:', data.error);
        setError(data.error || 'No results found');
        setOccurrences([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchInBounds = useCallback(
    async (bounds: LatLngBounds, species?: string) => {
      // For now, just do a regular search with the species
      // TODO: Implement bounds-based search later
      if (species) {
        await searchOccurrences({ species, limit: 300 });
      }
    },
    [searchOccurrences],
  );

  const searchWithFilters = useCallback(
    async (
      species?: string,
      filters?: FilterState,
      boundingBox?: [[number, number], [number, number]],
    ) => {
      const searchParams: MapSearchParams = {
        species,
        hasCoordinate: true,
        limit: 300,
      };

      // Apply advanced filters
      if (filters) {
        if (filters.basisOfRecord && filters.basisOfRecord.length > 0) {
          searchParams.basisOfRecord = filters.basisOfRecord;
        }
        if (filters.countries && filters.countries.length > 0) {
          searchParams.countries = filters.countries;
        }
        if (filters.dateRange) {
          searchParams.dateRange = filters.dateRange;
        }
        if (filters.elevationRange) {
          searchParams.elevationRange = filters.elevationRange;
        }
        if (filters.selectedHabitats && filters.selectedHabitats.length > 0) {
          searchParams.selectedHabitats = filters.selectedHabitats;
        }
        if (filters.hasImage) {
          searchParams.hasImage = filters.hasImage;
        }
      }
      if (boundingBox) {
        searchParams.boundingBox = boundingBox;
      }
      await searchOccurrences(searchParams);
    },
    [searchOccurrences],
  );

  return {
    occurrences,
    loading,
    error,
    fromCache,
    searchOccurrences,
    searchInBounds,
    searchWithFilters,
  };
};
