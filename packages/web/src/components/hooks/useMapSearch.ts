'use client';

import { useState, useCallback, useRef } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import type { FilterState } from '../AdvancedFilters';
import { getUserPosition } from '../../lib/geolocation';

// Generate a stable session ID per browser tab/session
const SESSION_ID = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

const GEOLOCATION_CACHE_KEY = 'fop-search-geolocation';
const GEOLOCATION_CACHE_TTL_MS = 30 * 60 * 1000;

const RELATIVE_AREA_PATTERNS = [
  /\b(?:near me|around me|close to me|my area|my location|current location|where i am|nearby)\b/iu,
  /\b(?:vicino a me|intorno a me|attorno a me|nella mia zona|nella mia area|mia posizione|dove mi trovo|qui vicino)\b/iu,
  /\b(?:cerca de m[ií]|alrededor de m[ií]|en mi zona|en mi área|mi ubicación|donde estoy)\b/iu,
  /\b(?:près de moi|autour de moi|dans ma zone|dans mon secteur|ma position|là où je suis)\b/iu,
  /\b(?:in meiner nähe|nahe bei mir|um mich herum|in meinem gebiet|mein standort|wo ich bin)\b/iu,
  /\b(?:perto de mim|na minha área|na minha zona|minha localização|onde estou)\b/iu,
  /(?:附近|周边|我的位置|当前位置|近く|周辺|내 주변|내 위치)/u,
];

function queryNeedsUserLocation(query: string): boolean {
  return RELATIVE_AREA_PATTERNS.some((pattern) => pattern.test(query));
}

function stripRelativeAreaPhrases(query: string): string {
  let cleaned = query;
  for (const pattern of RELATIVE_AREA_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  return cleaned
    .replace(/\b(?:in|near|around|at|from|within|vicino a|intorno a|attorno a|près de|autour de|cerca de|alrededor de|perto de|na|en|dans|bei)\s*$/giu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function buildBoundingBoxFromPosition(lat: number, lng: number, radiusKm: number = 25): [[number, number], [number, number]] {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  return [
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  ];
}

function readCachedUserPosition(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(GEOLOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (!parsed || typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number' || typeof parsed.ts !== 'number') {
      return null;
    }
    if (Date.now() - parsed.ts > GEOLOCATION_CACHE_TTL_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function cacheUserPosition(lat: number, lng: number) {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(GEOLOCATION_CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {
    // Ignore storage failures.
  }
}

async function resolveUserSearchBoundingBox(): Promise<[[number, number], [number, number]]> {
  const cached = readCachedUserPosition();
  if (cached) {
    return buildBoundingBoxFromPosition(cached.lat, cached.lng);
  }

  const position = await getUserPosition();
  cacheUserPosition(position.lat, position.lng);
  return buildBoundingBoxFromPosition(position.lat, position.lng);
}

interface MapSearchParams {
  species?: string;
  country?: string;
  hasCoordinate?: boolean;
  limit?: number;
  basisOfRecord?: string[];
  countries?: string[];
  dateRange?: { start: string; end: string };
  boundingBox?: [[number, number], [number, number]];
  forceBoundingBox?: boolean;
  geoContext?: 'user-area';
  hasImage?: boolean;
}

interface ResolverInfo {
  originalQuery?: string;
  resolvedName?: string;
  displayName?: string;
  source?: string;
  country?: string;
  areaName?: string;
  areaScope?: 'country' | 'subcountry' | 'unknown';
  llmUsed?: boolean;
  strategyMessage?: string;
}

export interface SuggestedBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export type SearchStep = {
  phase: 'resolving' | 'searching' | 'loading' | 'done' | 'error';
  message: string;
};

export const useMapSearch = () => {
  const [occurrences, setOccurrences] = useState<GBIFOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedSpecies, setMatchedSpecies] = useState<{ scientificName: string; count: number } | null>(null);
  const [resolverInfo, setResolverInfo] = useState<ResolverInfo | null>(null);
  const [suggestedBounds, setSuggestedBounds] = useState<SuggestedBounds | null>(null);
  const [searchStep, setSearchStep] = useState<SearchStep | null>(null);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastQsRef = useRef<URLSearchParams | null>(null);
  const nextOffsetRef = useRef<number>(0);
  const totalCountRef = useRef<number>(0);
  const endOfRecordsRef = useRef<boolean>(false);

  const stopLoading = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    // Keep current results, just stop fetching
    if (occurrences.length > 0) {
      setSearchStep({
        phase: 'done',
        message: `${occurrences.length} occurrences loaded (stopped)`,
      });
    }
  }, [occurrences.length]);

  const searchOccurrences = useCallback(async (params: MapSearchParams = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setMatchedSpecies(null);
    setResolverInfo(null);
    setSuggestedBounds(null);
    setCanLoadMore(false);
    setSearchStep({ phase: 'resolving', message: `Resolving "${params.species}"…` });

    try {
      // Build base query string
      const qs = new URLSearchParams();
      if (params.species) qs.set('species', params.species);
      if (params.country) qs.set('country', params.country);
      qs.set('hasCoordinate', String(params.hasCoordinate ?? true));
      qs.set('limit', '300');
      qs.set('sessionId', SESSION_ID);
      if (params.basisOfRecord?.length) qs.set('basisOfRecord', params.basisOfRecord.join(','));
      if (params.countries?.length) qs.set('countries', params.countries.join(','));
      if (params.hasImage) qs.set('hasImage', 'true');
      if (params.dateRange) {
        qs.set('dateStart', params.dateRange.start);
        qs.set('dateEnd', params.dateRange.end);
      }
      if (params.boundingBox) {
        const [[swLat, swLng], [neLat, neLng]] = params.boundingBox;
        qs.set('bbox', `${swLat},${swLng},${neLat},${neLng}`);
      }
      if (params.geoContext) qs.set('geoContext', params.geoContext);

      // Store qs for loadMore
      lastQsRef.current = qs;
      endOfRecordsRef.current = false;

      const initialPages = 1; // Load first page eagerly; additional pages via "Load more"
      let allResults: GBIFOccurrence[] = [];
      let totalCount = 0;
      let resolvedName = '';

      for (let page = 0; page < initialPages; page++) {
        if (controller.signal.aborted) break;

        const pageQs = new URLSearchParams(qs);
        pageQs.set('offset', String(page * 300));

        if (page === 0) {
          setSearchStep({ phase: 'searching', message: 'Querying GBIF…' });
        } else {
          setSearchStep({ phase: 'loading', message: `Loading page ${page + 1}/${initialPages}… (${allResults.length} so far)` });
        }

        const url = `/api/map-search?${pageQs.toString()}`;
        if (page === 0) console.log('[useMapSearch] Calling API:', url);

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || `API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Search failed');

        const results: GBIFOccurrence[] = data.data?.results || [];
        totalCount = data.data?.count || totalCount;

        // On first page, store resolver info and suggested bounds
        if (page === 0 && data.data?.resolver) {
          const r = data.data.resolver;
          setResolverInfo(r);
          resolvedName = r.displayName || r.resolvedName || '';
          const resolvedMsg = r.strategyMessage
            ? r.strategyMessage
            : r.resolvedName
            ? `Resolved → ${r.resolvedName}${r.country ? ` (${r.country})` : ''} via ${r.source}`
            : `Searching for "${r.originalQuery}"…`;
          setSearchStep({ phase: 'searching', message: resolvedMsg });
        }
        if (page === 0 && data.data?.suggestedBounds) {
          setSuggestedBounds(data.data.suggestedBounds);
        }

        if (page === 0) {
          allResults = results;
        } else {
          allResults = [...allResults, ...results];
        }

        setOccurrences(allResults);

        if (allResults.length > 0) {
          const speciesCounts = new Map<string, number>();
          allResults.forEach((o) => {
            const name = o.species || o.scientificName || 'Unknown';
            speciesCounts.set(name, (speciesCounts.get(name) || 0) + 1);
          });
          let topSpecies = '';
          let topCount = 0;
          speciesCounts.forEach((count, name) => {
            if (count > topCount) { topSpecies = name; topCount = count; }
          });
          setMatchedSpecies({ scientificName: topSpecies, count: totalCount });
        } else if (page === 0) {
          // No results at all — still set matchedSpecies so UI can show "0 total"
          setMatchedSpecies({ scientificName: resolvedName || params.species || '', count: 0 });
        }

        console.log(`[useMapSearch] Page ${page + 1}/${initialPages}: ${results.length} new, ${allResults.length} total`);

        // Stop if end of records
        if (results.length < 300 || data.data?.endOfRecords) {
          endOfRecordsRef.current = true;
          break;
        }
      }

      // Track next offset for loadMore
      nextOffsetRef.current = allResults.length;
      totalCountRef.current = totalCount;

      // Determine if more pages are available
      const moreAvailable = !endOfRecordsRef.current && allResults.length < totalCount;
      setCanLoadMore(moreAvailable);

      setSearchStep({
        phase: 'done',
        message: allResults.length > 0
          ? `${allResults.length} occurrences found${totalCount > allResults.length ? ` (${totalCount.toLocaleString()} total)` : ''}`
          : 'No occurrences found',
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[useMapSearch] Error:', err);
      const msg = err instanceof Error ? err.message : 'Search failed';
      setError(msg);
      setSearchStep({ phase: 'error', message: msg });
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load one additional page (300 occurrences) */
  const loadMore = useCallback(async () => {
    const qs = lastQsRef.current;
    if (!qs || endOfRecordsRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const pageQs = new URLSearchParams(qs);
      pageQs.set('offset', String(nextOffsetRef.current));

      setSearchStep({ phase: 'loading', message: `Loading more… (${occurrences.length} so far)` });

      const response = await fetch(`/api/map-search?${pageQs.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Load failed');

      const results: GBIFOccurrence[] = data.data?.results || [];
      const totalCount = data.data?.count || totalCountRef.current;
      totalCountRef.current = totalCount;

      const newAll = [...occurrences, ...results];
      setOccurrences(newAll);
      nextOffsetRef.current = newAll.length;

      if (results.length < 300 || data.data?.endOfRecords) {
        endOfRecordsRef.current = true;
        setCanLoadMore(false);
      } else {
        setCanLoadMore(newAll.length < totalCount);
      }

      setMatchedSpecies(prev => prev ? { ...prev, count: totalCount } : null);
      setSearchStep({
        phase: 'done',
        message: `${newAll.length} occurrences loaded${totalCount > newAll.length ? ` (${totalCount.toLocaleString()} total)` : ''}`,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchStep({ phase: 'error', message: err instanceof Error ? err.message : 'Load failed' });
    } finally {
      setLoading(false);
    }
  }, [occurrences]);

  const searchWithFilters = useCallback(
    async (species?: string, filters?: FilterState, boundingBox?: [[number, number], [number, number]]) => {
      let normalizedSpecies = species?.trim();
      let effectiveBoundingBox = boundingBox;
      let forceBoundingBox = false;
      let geoContext: 'user-area' | undefined;

      if (normalizedSpecies && queryNeedsUserLocation(normalizedSpecies)) {
        setError(null);
        setSearchStep({ phase: 'resolving', message: 'Requesting your location…' });

        try {
          effectiveBoundingBox = await resolveUserSearchBoundingBox();
          forceBoundingBox = true;
          geoContext = 'user-area';
          normalizedSpecies = stripRelativeAreaPhrases(normalizedSpecies) || 'plants';
        } catch {
          const message = 'To search in your area, allow browser geolocation or set your position manually in Nearby.';
          setError(message);
          setSearchStep({ phase: 'error', message });
          return;
        }
      }

      await searchOccurrences({
        species: normalizedSpecies,
        hasCoordinate: true,
        limit: 900,
        basisOfRecord: filters?.basisOfRecord,
        countries: filters?.countries,
        dateRange: filters?.dateRange,
        hasImage: filters?.hasImage,
        boundingBox: effectiveBoundingBox,
        forceBoundingBox,
        geoContext,
      });
    },
    [searchOccurrences],
  );

  return {
    occurrences, loading, error, matchedSpecies, resolverInfo, suggestedBounds,
    searchStep, canLoadMore, searchOccurrences, searchWithFilters, loadMore, stopLoading,
  };
};
