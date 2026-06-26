'use client';

import { MagnifyingGlass, House, IdentificationCard, GitPullRequest, Brain, X, Funnel, CirclesFour, ChartBar, Images, Download, Clock, MapPin } from '@phosphor-icons/react';
import dynamicImport from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { type FilterState } from '../../components/AdvancedFilters';
import AdvancedFilters from '../../components/AdvancedFilters';
import { useMapSearch } from '../../components/hooks/useMapSearch';
import { CorridorPanel } from '../../components/CorridorPanel';
import { NearbyPanel } from '../../components/NearbyPanel';
import { PlantIdentifier } from '../../components/PlantIdentifier';
import { SDMPanel } from '../../components/SDMPanel';
import { TechnicalSheetPanel } from '../../components/TechnicalSheetPanel';
import TemporalSlider from '../../components/TemporalSlider';
import { useMode, getTextColors } from '../../context/ModeContext';

const InteractiveMap = dynamicImport(() => import('../../components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-gray-600">Loading map...</div>
    </div>
  ),
});



const TOOLS = [
  { key: 'nearby' as const, icon: House, label: 'Nearby', color: 'green', featureKey: 'feature:nearby' },
  { key: 'identify' as const, icon: IdentificationCard, label: 'Identify', color: 'blue', featureKey: 'feature:plantnet' },
  { key: 'corridors' as const, icon: GitPullRequest, label: 'Corridors', color: 'purple', featureKey: 'feature:corridors' },
  { key: 'sdm' as const, icon: Brain, label: 'SDM', color: 'indigo', featureKey: 'feature:sdm' },
] as const;

const ToolsPage = () => {
  const { theme } = useMode();
  const textColors = getTextColors(theme);
  const urlParams = useSearchParams();
  const { occurrences, loading, error, matchedSpecies, resolverInfo, suggestedBounds, searchStep, canLoadMore, searchWithFilters, loadMore, stopLoading } = useMapSearch();

  const [searchQuery, setSearchQuery] = useState(urlParams?.get('q') || '');
  const [initialQueryTriggered, setInitialQueryTriggered] = useState(false);

  useEffect(() => {
    const q = urlParams?.get('q');
    if (q && !initialQueryTriggered) {
      setSearchQuery(q);
      setInitialQueryTriggered(true);
    }
  }, [urlParams, initialQueryTriggered]);

  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showTemporalSlider, setShowTemporalSlider] = useState(false);
  const [enableClustering, setEnableClustering] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [hasImageOnly, setHasImageOnly] = useState(false);
  const [filters, _setFilters] = useState<FilterState>({
    selectedHabitats: [],
    basisOfRecord: [],
    countries: [],
  });
  const setFilters = (updater: FilterState | ((prev: FilterState) => FilterState)) => {
    _setFilters((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return { ...next, hasImage: hasImageOnly };
    });
  };
  const [boundingBox, setBoundingBox] = useState<[[number, number], [number, number]] | null>(null);
  const boundingBoxRef = useRef<[[number, number], [number, number]] | null>(null);
  const suppressBoundsSearch = useRef(false);

  // When suggestedBounds arrive from LLM, suppress the next bounds-change from triggering re-search
  useEffect(() => {
    if (suggestedBounds) {
      suppressBoundsSearch.current = true;
      // Auto-reset after animation completes (~2s)
      const timer = setTimeout(() => { suppressBoundsSearch.current = false; }, 2500);
      return () => clearTimeout(timer);
    }
  }, [suggestedBounds]);

  const handleBoundsChange = useCallback((bbox: [[number, number], [number, number]]) => {
    boundingBoxRef.current = bbox;
    setBoundingBox(bbox);
  }, []);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'nearby' | 'identify' | 'corridors' | 'sdm' | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    'feature:pathology': false,
    'feature:corridors': false,
    'feature:sdm': false,
    'feature:plantnet': false,
    'feature:nearby': false,
  });
  const [corridorResults, setCorridorResults] = useState<{ id: number; path: [number, number][]; resistance: number; lengthKm: number; viability?: any }[]>([]);
  const [coreAreaResults, setCoreAreaResults] = useState<{ id: number; lat: number; lng: number; occurrenceCount: number; protectedArea?: any }[]>([]);
  const [steppingStoneResults, setSteppingStoneResults] = useState<{ lat: number; lng: number; distanceToCorridorKm: number; withinRange: boolean }[]>([]);
  const [hideMarkers, setHideMarkers] = useState(false);
  const [flyToPoint, setFlyToPoint] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [highlightedPoint, setHighlightedPoint] = useState<{ lat: number; lng: number; label?: string; image?: string } | null>(null);
    useEffect(() => {
      async function loadFeatureFlags() {
        try {
          const response = await fetch('/api/feature-flags', { cache: 'no-store' });
          if (!response.ok) return;
          const data = await response.json() as { success?: boolean; flags?: Record<string, boolean> };
          if (data.success && data.flags) {
            setFeatureFlags((prev) => ({ ...prev, ...data.flags }));
          }
        } catch {
          // Keep defaults if settings are unavailable.
        }
      }

      loadFeatureFlags();
    }, []);

    useEffect(() => {
      if (activeSidebar === 'identify' && !featureFlags['feature:plantnet']) {
        setActiveSidebar(null);
      }
    }, [activeSidebar, featureFlags]);

  // Track clustering state before density was activated
  const clusteringBeforeDensityRef = useRef(false);

  useEffect(() => {
    if (activeSidebar === 'corridors') return;

    setCorridorResults([]);
    setCoreAreaResults([]);
    setSteppingStoneResults([]);
    setHideMarkers(false);
  }, [activeSidebar]);

  const handleTimeRangeChange = useCallback(
    (startYear: number, endYear: number) => {
      setFilters((prev) => ({
        ...prev,
        dateRange: { start: `${startYear}-01-01`, end: `${endYear}-12-31` },
      }));
    },
    [setFilters],
  );

  // Re-search when filters change (not on query typing — search is triggered by submit button)
  useEffect(() => {
    if (!searchQuery && !selectedExample) return;
    if (suppressBoundsSearch.current) return;
    const query = selectedExample || searchQuery;
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    const handler = setTimeout(() => {
      const bbox = boundingBoxRef.current;
      if (bbox) {
        searchWithFilters(query, mergedFilters, bbox);
      } else {
        searchWithFilters(query, mergedFilters);
      }
    }, 500);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedExample, searchWithFilters, hasImageOnly]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !searchWithFilters) return;
    setSelectedExample(null);
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    await searchWithFilters(searchQuery.trim(), mergedFilters, boundingBoxRef.current || undefined);
  };

  const handleResetMap = useCallback(() => {
    boundingBoxRef.current = null;
    setBoundingBox(null);
    setFlyToPoint({ lat: 25, lng: 0, zoom: 2 });

    const query = (selectedExample || searchQuery).trim();
    if (query) {
      const mergedFilters = { ...filters, hasImage: hasImageOnly };
      void searchWithFilters(query, mergedFilters);
    }
  }, [filters, hasImageOnly, searchQuery, searchWithFilters, selectedExample]);

  // Count occurrences visible in the current viewport
  const visibleCount = useMemo(() => {
    if (!boundingBox || occurrences.length === 0) return occurrences.length;
    const [[swLat, swLng], [neLat, neLng]] = boundingBox;
    return occurrences.filter((occ) => {
      const lat = occ.decimalLatitude;
      const lng = occ.decimalLongitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      const inLat = lat >= swLat && lat <= neLat;
      const inLng = swLng <= neLng ? (lng >= swLng && lng <= neLng) : (lng >= swLng || lng <= neLng);
      return inLat && inLng;
    }).length;
  }, [occurrences, boundingBox]);

  const handleDownloadCSV = () => {
    if (occurrences.length === 0) return;
    const headers = ['Species', 'Scientific Name', 'Latitude', 'Longitude', 'Date', 'Country', 'Recorded By'];
    const rows = occurrences.map((occ) => [
      occ.species || occ.scientificName || 'Unknown',
      occ.scientificName || '',
      occ.decimalLatitude?.toString() || '',
      occ.decimalLongitude?.toString() || '',
      occ.eventDate ? new Date(occ.eventDate).toISOString().split('T')[0] : '',
      occ.country || '',
      occ.recordedBy || '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `species-occurrences-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const panelBg = theme === 'light' ? 'bg-white/95' : 'bg-gray-900/95';
  const panelBorder = theme === 'light' ? 'border-gray-200' : 'border-gray-700';

  return (
    <div className="h-[calc(100vh-64px)] relative overflow-hidden">
      {/* ── MAP: always visible, fills viewport ── */}
      <div className="absolute inset-0">
        <InteractiveMap
          occurrences={hideMarkers ? [] : occurrences}
          dateRange={filters.dateRange}
          enableClustering={enableClustering}
          showHeatmap={showHeatmap}
          showAdvancedFilters={false}
          onShowAdvancedFilters={setShowAdvancedFilters}
          onEnableClusteringChange={setEnableClustering}
          onShowHeatmapChange={setShowHeatmap}
          filters={{ ...filters, hasImage: hasImageOnly }}
          setFilters={setFilters}
          theme={theme}
          showTemporalSlider={showTemporalSlider}
          onShowTemporalSliderChange={setShowTemporalSlider}
          onBoundsChange={handleBoundsChange}
          loading={loading}
          corridors={corridorResults}
          coreAreas={coreAreaResults}
          steppingStones={steppingStoneResults}
          suggestedBounds={suggestedBounds}
          flyToPoint={flyToPoint}
          highlightedPoint={highlightedPoint}
        />
      </div>

      {/* ── SEARCH BAR: overlaid top-left, Google Maps style ── */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
        <div className="w-[400px] max-w-[calc(100vw-2rem)] pointer-events-auto">
          <div className={`${panelBg} backdrop-blur-md rounded-xl shadow-lg border ${panelBorder} flex flex-col`} style={{ maxHeight: 'calc(100vh - 96px)' }}>
            {/* Search input */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 p-2 flex-shrink-0">
              <div className="flex-1 relative">
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                      theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'
                    }`}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search plants..."
                  className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-green-500 ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : searchQuery.trim().length >= 2
                      ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30'
                      : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <MagnifyingGlass size={18} weight={searchQuery.trim().length >= 2 ? 'bold' : 'regular'} />
              </button>
            </form>

            {/* Result & progress — fixed space, always visible */}
            <div className={`px-3 py-1.5 text-xs min-h-[24px] flex items-center justify-between flex-shrink-0 ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>
              <div className="flex-1 min-w-0">
                {/* Show progress steps during search */}
                {searchStep && searchStep.phase !== 'done' && searchStep.phase !== 'error' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={stopLoading}
                      className="relative inline-flex items-center justify-center w-4 h-4 flex-shrink-0"
                      title="Stop loading"
                    >
                      <span className="absolute inset-0 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      <span className="relative w-1.5 h-1.5 bg-green-600 rounded-sm" />
                    </button>
                    <span className="truncate">{searchStep.message}</span>
                  </div>
                ) : null}
                {/* Show resolved species name prominently */}
                {!loading && resolverInfo?.resolvedName ? (
                  <div className="flex items-center gap-1.5">
                    <span className="italic font-medium">{resolverInfo.strategyMessage || resolverInfo.displayName || resolverInfo.resolvedName}</span>
                    {resolverInfo.areaName && resolverInfo.areaScope && resolverInfo.areaScope !== 'unknown' && (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          resolverInfo.areaScope === 'subcountry'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                        title={resolverInfo.areaScope === 'subcountry' ? 'Using regional geometry filter' : 'Using country-level filter'}
                      >
                        {`Area: ${resolverInfo.areaName} (${resolverInfo.areaScope === 'subcountry' ? 'sub-country' : 'country'})`}
                      </span>
                    )}
                    {matchedSpecies && matchedSpecies.count > 0 ? (
                      <span className="opacity-70">
                        · {visibleCount} visible of {matchedSpecies.count.toLocaleString()} total
                      </span>
                    ) : matchedSpecies && matchedSpecies.count === 0 ? (
                      <span className="opacity-70 text-amber-600">
                        · Nessuna occorrenza in quest&apos;area
                      </span>
                    ) : null}
                    {canLoadMore && (
                      <button
                        onClick={loadMore}
                        className="inline-flex items-center justify-center w-4 h-4 ml-1 rounded-full bg-green-100 hover:bg-green-200 transition-colors flex-shrink-0"
                        title="Load more (next 300)"
                      >
                        <span className="w-0 h-0 border-l-[5px] border-l-green-600 border-y-[3px] border-y-transparent ml-0.5" />
                      </button>
                    )}
                  </div>
                ) : !loading && searchStep?.phase === 'done' && !matchedSpecies ? (
                  <span className="opacity-70">{searchStep.message}</span>
                ) : null}
              </div>
              {occurrences.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className={`p-1 rounded transition-colors flex-shrink-0 ml-2 ${
                    theme === 'light'
                      ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                      : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                  title="Export as CSV"
                >
                  <Download size={13} />
                </button>
              )}
            </div>

            {/* Controls row — single line: images, filters, clusters, density */}
            <div className={`border-t ${panelBorder} px-3 py-1.5 flex items-center gap-1 flex-shrink-0`}>
              <button
                onClick={handleResetMap}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  theme === 'light'
                    ? 'text-gray-500 hover:bg-gray-100'
                    : 'text-gray-400 hover:bg-gray-800'
                }`}
                title="Reset map viewport to world and remove local area constraint"
              >
                <MapPin size={11} />
                Reset map
              </button>
              <button
                onClick={() => setHasImageOnly(!hasImageOnly)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  hasImageOnly
                    ? theme === 'light'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-green-900/50 text-green-300'
                    : theme === 'light'
                      ? 'text-gray-500 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Images size={11} />
                Images
              </button>
              <button
                onClick={() => { setShowAdvancedFilters(!showAdvancedFilters); if (!showAdvancedFilters) setActiveSidebar(null); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  showAdvancedFilters
                    ? theme === 'light'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-blue-900/50 text-blue-300'
                    : theme === 'light'
                      ? 'text-gray-500 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Funnel size={11} />
                Filters
              </button>
              <button
                onClick={() => { if (!showHeatmap) setEnableClustering(!enableClustering); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  showHeatmap
                    ? 'text-gray-300 cursor-not-allowed'
                    : enableClustering
                      ? theme === 'light'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-purple-900/50 text-purple-300'
                      : theme === 'light'
                        ? 'text-gray-500 hover:bg-gray-100'
                        : 'text-gray-400 hover:bg-gray-800'
                }`}
                disabled={showHeatmap}
                title={showHeatmap ? 'Disabled while Density is active' : ''}
              >
                <CirclesFour size={11} />
                Clusters
              </button>
              <button
                onClick={() => {
                  if (!showHeatmap) {
                    clusteringBeforeDensityRef.current = enableClustering;
                    setEnableClustering(false);
                    setShowHeatmap(true);
                  } else {
                    setShowHeatmap(false);
                    setEnableClustering(clusteringBeforeDensityRef.current);
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  showHeatmap
                    ? theme === 'light'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-orange-900/50 text-orange-300'
                    : theme === 'light'
                      ? 'text-gray-500 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <ChartBar size={11} />
                Density
              </button>
            </div>

            {/* Density scale — inline, only when Density is active */}
            {showHeatmap && (
              <div className={`border-t ${panelBorder} px-3 py-1.5 flex items-center gap-1.5 text-[10px] flex-shrink-0`}>
                <span className="text-gray-500">Low</span>
                <span className="w-4 h-2 rounded-sm bg-blue-500 inline-block" />
                <span className="w-4 h-2 rounded-sm bg-green-500 inline-block" />
                <span className="w-4 h-2 rounded-sm bg-yellow-500 inline-block" />
                <span className="w-4 h-2 rounded-sm bg-orange-500 inline-block" />
                <span className="w-4 h-2 rounded-sm bg-pink-600 inline-block" />
                <span className="text-gray-500">High</span>
              </div>
            )}

            {/* Advanced Filters — inline, below controls */}
            {showAdvancedFilters && !activeSidebar && (
              <div className={`border-t ${panelBorder} px-3 py-2 max-h-[280px] overflow-y-auto flex-shrink-0`}>
                <AdvancedFilters
                  isOpen={true}
                  onClose={() => setShowAdvancedFilters(false)}
                  onFiltersChange={setFilters}
                  currentFilters={{ ...filters, hasImage: hasImageOnly }}
                  compact
                />
              </div>
            )}

            {/* Tools row — Nearby, Identify, Corridors, SDM, Time */}
            <div className={`border-t ${panelBorder} px-3 py-1.5 flex items-center gap-1 flex-shrink-0`}>
              {TOOLS.filter((tool) => featureFlags[tool.featureKey]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => { setActiveSidebar(activeSidebar === key ? null : key); setShowAdvancedFilters(false); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeSidebar === key
                      ? theme === 'light'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-green-900/50 text-green-300'
                      : theme === 'light'
                        ? 'text-gray-500 hover:bg-gray-100'
                        : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShowTemporalSlider(!showTemporalSlider)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  showTemporalSlider
                    ? theme === 'light'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-green-900/50 text-green-300'
                    : theme === 'light'
                      ? 'text-gray-500 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                <Clock size={11} />
                Time
              </button>
            </div>

            {/* Tool content — inline, scrollable */}
            {activeSidebar && (
              <div className={`border-t ${panelBorder} flex-1 overflow-y-auto min-h-0`}>
                <div className={`flex items-center justify-between px-3 py-2 flex-shrink-0`}>
                  <h3 className={`text-xs font-semibold ${textColors.primary}`}>
                    {activeSidebar === 'nearby' && 'Nearby Species'}
                    {activeSidebar === 'identify' && 'Identify Plant'}
                    {activeSidebar === 'corridors' && 'Ecological Corridors'}
                    {activeSidebar === 'sdm' && 'Species Distribution Model'}
                  </h3>
                  <div className="flex items-center gap-1">
                    {activeSidebar === 'corridors' && (
                      <button
                        onClick={() => setHideMarkers(!hideMarkers)}
                        className={`p-1 rounded transition-colors ${
                          hideMarkers
                            ? theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/50 text-purple-300'
                            : theme === 'light' ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-gray-800 text-gray-500'
                        }`}
                        title={hideMarkers ? 'Show markers' : 'Hide markers'}
                      >
                        <MapPin size={12} weight={hideMarkers ? 'fill' : 'regular'} />
                      </button>
                    )}
                    <button
                      onClick={() => setActiveSidebar(null)}
                      className={`p-1 rounded transition-colors ${
                        theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-800 text-gray-400'
                      }`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  {activeSidebar === 'nearby' && (
                    <NearbyPanel onSelectSpecies={(s) => {
                      setSelectedSpecies(s.scientificName);
                      setHighlightedPoint({ lat: s.lat, lng: s.lng, label: s.species, image: s.image });
                      setFlyToPoint(null);
                      setTimeout(() => setFlyToPoint({ lat: s.lat, lng: s.lng, zoom: 14 }), 0);
                    }} />
                  )}
                  {activeSidebar === 'identify' && (
                    <PlantIdentifier onIdentified={(result) => setSelectedSpecies(result.scientificName)} />
                  )}
                  {activeSidebar === 'corridors' && (
                    <CorridorPanel
                      occurrences={occurrences}
                      bounds={boundingBox ? {
                        south: boundingBox[0][0],
                        north: boundingBox[1][0],
                        west: boundingBox[0][1],
                        east: boundingBox[1][1],
                      } : null}
                      genus={resolverInfo?.resolvedName?.split(' ')[0]}
                      onAreaClick={(lat, lng) => {
                        setFlyToPoint(null);
                        setTimeout(() => setFlyToPoint({ lat, lng, zoom: 13 }), 0);
                      }}
                      onZoomToAll={() => {
                        if (boundingBox) {
                          setFlyToPoint(null);
                          const lat = (boundingBox[0][0] + boundingBox[1][0]) / 2;
                          const lng = (boundingBox[0][1] + boundingBox[1][1]) / 2;
                          setTimeout(() => setFlyToPoint({ lat, lng, zoom: 8 }), 0);
                        }
                      }}
                      onResults={(corridors, cores, stones) => {
                        setCorridorResults(corridors);
                        setCoreAreaResults(cores);
                        setSteppingStoneResults(stones || []);
                      }}
                    />
                  )}
                  {activeSidebar === 'sdm' && (
                    <SDMPanel
                      occurrences={occurrences}
                      speciesName={searchQuery || selectedExample || 'Unknown'}
                    />
                  )}
                  {selectedSpecies && (
                    <div className="mt-3">
                      <TechnicalSheetPanel scientificName={selectedSpecies} />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── TECHNICAL SHEET: right side panel when no tool is active ── */}
      {!activeSidebar && selectedSpecies && (
        <div className="absolute top-20 right-4 bottom-4 z-[1000] w-[360px] max-w-[calc(100vw-2rem)]">
          <div className={`h-full ${panelBg} backdrop-blur-md rounded-xl shadow-xl border ${panelBorder} flex flex-col overflow-hidden`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${panelBorder} flex-shrink-0`}>
              <h3 className={`text-sm font-semibold ${textColors.primary}`}>Species Info</h3>
              <button
                onClick={() => setSelectedSpecies(null)}
                className={`p-1 rounded-lg transition-colors ${
                  theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-800 text-gray-400'
                }`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <TechnicalSheetPanel scientificName={selectedSpecies} />
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPORAL SLIDER: bottom overlay ── */}
      {showTemporalSlider && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className={`${panelBg} backdrop-blur-md rounded-xl shadow-lg border ${panelBorder} p-3`}>
            <TemporalSlider occurrences={occurrences} onTimeRangeChange={handleTimeRangeChange} />
          </div>
        </div>
      )}

      {/* ── ERROR TOAST ── */}
      {error && (
        <div className="absolute bottom-4 right-4 z-[1100] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
          <strong className="font-bold">Error: </strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ToolsPage;
export const dynamic = 'force-dynamic';
