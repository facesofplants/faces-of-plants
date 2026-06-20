'use client';

import { useCallback, useRef, useState } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import {
  storeOccurrences,
  getOccurrences,
  getStoredCount,
  type StoredOccurrence,
} from '../lib/indexeddb';

interface UseOfflineGBIFOptions {
  /**
   * Maximum age in ms before re-fetching from GBIF. Default: 7 days.
   */
  maxAge?: number;
}

interface UseOfflineGBIFReturn {
  /**
   * Occurrences loaded from IndexedDB + GBIF.
   */
  occurrences: GBIFOccurrence[];
  /**
   * Whether data is being fetched.
   */
  loading: boolean;
  /**
   * Error message if fetch fails.
   */
  error: string | null;
  /**
   * Whether data came from IndexedDB cache.
   */
  fromCache: boolean;
  /**
   * Total count from GBIF (may be larger than loaded).
   */
  totalCount: number;
  /**
   * Number of occurrences stored locally.
   */
  storedCount: number;
  /**
   * Search for occurrences (offline-first).
   */
  search: (species: string, country?: string, limit?: number) => Promise<void>;
  /**
   * Clear all stored data.
   */
  clearStorage: () => Promise<void>;
}

/**
 * Offline-first hook for GBIF occurrence data.
 * Checks IndexedDB first, then falls back to GBIF API.
 */
export function useOfflineGBIF(options: UseOfflineGBIFOptions = {}): UseOfflineGBIFReturn {
  const { maxAge = 7 * 24 * 60 * 60 * 1000 } = options;

  const [occurrences, setOccurrences] = useState<GBIFOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [storedCount, setStoredCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const updateStoredCount = useCallback(async () => {
    const count = await getStoredCount();
    setStoredCount(count);
  }, []);

  const search = useCallback(
    async (species: string, country?: string, limit: number = 300) => {
      // Abort any previous request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setFromCache(false);

      try {
        // 1. Try IndexedDB first
        const cached = await getOccurrences(species, country);
        if (cached.length > 0) {
          setOccurrences(cached as GBIFOccurrence[]);
          setFromCache(true);
          setTotalCount(cached.length);
          setLoading(false);
          await updateStoredCount();
          return;
        }

        // 2. Fetch from GBIF API
        const response = await fetch('/api/map-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            species,
            country,
            hasCoordinate: true,
            limit,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`GBIF API error: ${response.status}`);
        }

        const data = await response.json();
        const results: GBIFOccurrence[] = data.data?.results || [];

        // 3. Store in IndexedDB for future offline access
        if (results.length > 0) {
          await storeOccurrences(species, country || 'global', results);
        }

        setOccurrences(results);
        setTotalCount(data.data?.count || results.length);
        setFromCache(false);
        await updateStoredCount();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // Ignore aborted requests
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [maxAge, updateStoredCount]
  );

  const clearStorage = useCallback(async () => {
    // Clear IndexedDB (we'll just reload for now)
    indexedDB.deleteDatabase('faces-of-plants');
    setOccurrences([]);
    setStoredCount(0);
  }, []);

  return {
    occurrences,
    loading,
    error,
    fromCache,
    totalCount,
    storedCount,
    search,
    clearStorage,
  };
}
