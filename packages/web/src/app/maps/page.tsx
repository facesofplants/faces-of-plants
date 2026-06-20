'use client';

import { MagnifyingGlass, Faders, House, IdentificationCard, Warning, GitPullRequest, Brain } from '@phosphor-icons/react';
import dynamicImport from 'next/dynamic';
import React, { useState, useEffect, useCallback } from 'react';

import { type FilterState } from '../../components/AdvancedFilters';
import { FeatureGate } from '../../components/FeatureGate';
import { useMapSearch } from '../../components/hooks/useMapSearch';
import { CorridorPanel } from '../../components/CorridorPanel';
import { NearbyPanel } from '../../components/NearbyPanel';
import { PathologyPanel } from '../../components/PathologyPanel';
import { PlantIdentifier } from '../../components/PlantIdentifier';
import { SDMPanel } from '../../components/SDMPanel';
import { TechnicalSheetPanel } from '../../components/TechnicalSheetPanel';
import TemporalSlider from '../../components/TemporalSlider';
import { UsageLimiter } from '../../components/UsageLimiter';
import { useMode, getBackgroundGradient, getTextColors } from '../../context/ModeContext';
import { useAccessControl } from '../../hooks/useAccessControl';
// import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

// Dynamically import the map component to avoid SSR issues
const InteractiveMap = dynamicImport(() => import('../../components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
      <div className="text-gray-600">Loading map...</div>
    </div>
  ),
});

const MapsPage = () => {
  const { theme } = useMode();
  const { usageLimits, userType } = useAccessControl();
  const isCitizen = userType === 'citizen';
  const isResearcher = userType === 'researcher';
  const textColors = getTextColors(theme);
  const { occurrences, loading, error, searchWithFilters } = useMapSearch();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showTemporalSlider, setShowTemporalSlider] = useState(false);
  const [enableClustering, setEnableClustering] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [hasImageOnly, setHasImageOnly] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false); // New state for filter menu
  // setFilters wrapper che preserva sempre hasImageOnly
  const [filters, _setFilters] = useState<FilterState>({
    selectedHabitats: [],
    basisOfRecord: [],
    countries: [],
  });
  // Wrapper per preservare hasImageOnly
  const setFilters = (updater: FilterState | ((prev: FilterState) => FilterState)) => {
    _setFilters((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // hasImageOnly è gestito separatamente, ma lo reinseriamo sempre nei filtri
      return { ...next, hasImage: hasImageOnly };
    });
  };
  const [boundingBox, setBoundingBox] = useState<[[number, number], [number, number]] | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [activeSidebar, setActiveSidebar] = useState<'nearby' | 'identify' | 'pathology' | 'corridors' | 'sdm' | null>(null);

  // Handle temporal filtering
  const handleTimeRangeChange = useCallback(
    (startYear: number, endYear: number) => {
      setFilters((prev) => ({
        ...prev,
        dateRange: {
          start: `${startYear}-01-01`,
          end: `${endYear}-12-31`,
        },
      }));
    },
    [setFilters],
  );

  // Manual search state for bbox/filters
  // Debounced search for bbox/filters changes
  useEffect(() => {
    if (!(searchQuery || selectedExample) || !searchWithFilters) {return;}
    const query = selectedExample || searchQuery;
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    const handler = setTimeout(() => {
      if (boundingBox) {
        searchWithFilters(query, mergedFilters, boundingBox);
      } else {
        searchWithFilters(query, mergedFilters);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
  }, [filters, boundingBox, searchQuery, selectedExample, searchWithFilters, hasImageOnly]);

  // Mode-aware accent colors - using userType instead of mode
  const accentColorClass =
    theme === 'light'
      ? isCitizen
        ? 'text-green-600'
        : 'text-blue-600'
      : isCitizen
        ? 'text-green-500'
        : 'text-blue-500';

  // Card backgrounds for different themes
  const sectionBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  // Example searches by userType
  const examples = {
    citizen: ['Rose flowers', 'Oak trees', 'Sunflowers', 'Pine trees', 'Cherry blossoms'],
    researcher: [
      'Quercus robur',
      'Rosa canina',
      'Helianthus annuus',
      'Pinus sylvestris',
      'Betula pendula',
      'Acer pseudoplatanus',
    ],
    anonymous: ['Rose flowers', 'Oak trees', 'Sunflowers'],
    admin: [
      'Quercus robur',
      'Rosa canina',
      'Helianthus annuus',
      'Pinus sylvestris',
      'Betula pendula',
      'Acer pseudoplatanus',
      'Rare species monitoring',
    ],
  };

  // Load default data on mount
  useEffect(() => {
    const defaultQuery = isResearcher ? 'Quercus robur' : 'Oak trees';
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    console.log(
      '[MapsPage] Loading default data for userType:',
      userType,
      'query:',
      defaultQuery,
      'filters:',
      mergedFilters,
    );
    if (searchWithFilters) {
      searchWithFilters(defaultQuery, mergedFilters);
    }
  }, [userType, isResearcher, searchWithFilters, filters, hasImageOnly]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !searchWithFilters) {return;}
    setSelectedExample(null);
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    await searchWithFilters(searchQuery.trim(), mergedFilters);
  };

  const handleExampleClick = async (example: string) => {
    if (!searchWithFilters) {return;}
    setSearchQuery(example);
    setSelectedExample(example);
    const mergedFilters = { ...filters, hasImage: hasImageOnly };
    await searchWithFilters(example, mergedFilters);
  };

  return (
    <div
      className={`min-h-screen ${getBackgroundGradient(userType === 'researcher' ? 'researcher' : 'citizen', theme)}`}
    >
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center mb-12">
          <h1 className={`text-5xl font-bold ${textColors.primary} mb-6`}>
            Interactive Species Map
          </h1>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto mb-8`}>
            Explore biodiversity data with advanced filtering, clustering, and temporal analysis
          </p>
        </div>

        {/* Sidebar Actions */}
        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'nearby' ? null : 'nearby')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSidebar === 'nearby'
                ? theme === 'light'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-green-900/50 text-green-300 border border-green-700'
                : theme === 'light'
                  ? 'bg-white/70 text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <House size={16} />
            Nearby Species
          </button>
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'identify' ? null : 'identify')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSidebar === 'identify'
                ? theme === 'light'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-blue-900/50 text-blue-300 border border-blue-700'
                : theme === 'light'
                  ? 'bg-white/70 text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <IdentificationCard size={16} />
            Identify Plant
          </button>
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'pathology' ? null : 'pathology')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSidebar === 'pathology'
                ? theme === 'light'
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-orange-900/50 text-orange-300 border border-orange-700'
                : theme === 'light'
                  ? 'bg-white/70 text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <Warning size={16} />
            Detect Disease
          </button>
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'corridors' ? null : 'corridors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSidebar === 'corridors'
                ? theme === 'light'
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : 'bg-purple-900/50 text-purple-300 border border-purple-700'
                : theme === 'light'
                  ? 'bg-white/70 text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <GitPullRequest size={16} />
            Corridors
          </button>
          <button
            onClick={() => setActiveSidebar(activeSidebar === 'sdm' ? null : 'sdm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSidebar === 'sdm'
                ? theme === 'light'
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-indigo-900/50 text-indigo-300 border border-indigo-700'
                : theme === 'light'
                  ? 'bg-white/70 text-gray-700 border border-gray-200 hover:bg-gray-50'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-700 hover:bg-gray-800'
            }`}
          >
            <Brain size={16} />
            SDM
          </button>
        </div>

        <FeatureGate feature="map">
          <UsageLimiter
            action="map"
            current={usageLimits.map.current}
            limit={usageLimits.map.limit}
          />

          {/* Search Section — hidden when any sidebar panel is active */}
          {!activeSidebar && (
          <div className={`${sectionBg} rounded-2xl p-3 border backdrop-blur-md mb-8`}>
            {/* Example Searches */}
            <div className="mb-1.5 flex items-center gap-4 justify-between">
              <div className="flex items-center gap-4 flex-grow">
                {' '}
                {/* Added flex-grow here */}
                <h3
                  className={`text-xs font-medium ${textColors.secondary} flex-shrink-0 px-3 py-1`}
                >
                  Examples:{' '}
                </h3>
                <div className="overflow-x-auto flex-1">
                  {' '}
                  {/* This is the scrollable container for buttons */}
                  <div className="flex gap-2 pb-1 min-w-max">
                    {' '}
                    {/* This contains the example buttons */}
                    {examples[userType].map((example) => (
                      <button
                        key={example}
                        onClick={() => handleExampleClick(example)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap flex-shrink-0 ${
                          selectedExample === example
                            ? `${accentColorClass} border-current bg-current/10`
                            : `${textColors.secondary} border-gray-300 hover:border-gray-400`
                        }`}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-3 items-center relative">
                {' '}
                {/* Make this relative */}
                <div className="flex-1 relative">
                  <MagnifyingGlass
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isCitizen
                        ? 'Search for plants (e.g., oak tree, rose)'
                        : isResearcher
                          ? 'Search species (e.g., Quercus robur)'
                          : 'Search for plants'
                    }
                    className={`w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-900 text-white placeholder-white' : ''}`}
                  />
                  <button
                    type="button" // Changed to type="button" to prevent form submission
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-lg font-medium transition-colors ${
                      showFilterMenu
                        ? `${accentColorClass} border-current bg-current/10` // Active state styling
                        : `${textColors.secondary} hover:bg-gray-100` // Inactive state styling
                    }`}
                    aria-label="Toggle filters"
                  >
                    <Faders size={20} />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    loading || !searchQuery.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : `${theme === 'light' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`
                  }`}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                {showFilterMenu && (
                  <div
                    className={`absolute right-0 top-full mt-2 w-48 ${theme === 'light' ? 'bg-white' : 'bg-gray-900'} rounded-lg shadow-lg border ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'} z-50`}
                  >
                    <div className="py-1">
                      <label className="flex items-center px-4 py-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasImageOnly}
                          onChange={(e) => setHasImageOnly(e.target.checked)}
                          className="accent-purple-600 h-4 w-4 mr-2"
                        />
                        <span className={textColors.secondary}>With images</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Filter Controls - All moved to map */}
          </div>
          )}

          {!activeSidebar && (
            <InteractiveMap
              occurrences={occurrences}
              dateRange={filters.dateRange}
              enableClustering={enableClustering}
              showHeatmap={showHeatmap}
              showAdvancedFilters={showAdvancedFilters}
              onShowAdvancedFilters={setShowAdvancedFilters}
              onEnableClusteringChange={setEnableClustering}
              onShowHeatmapChange={setShowHeatmap}
              filters={{ ...filters, hasImage: hasImageOnly }}
              setFilters={setFilters}
              theme={theme}
              showTemporalSlider={showTemporalSlider}
              onShowTemporalSliderChange={setShowTemporalSlider}
              onBoundsChange={setBoundingBox}
              loading={loading}
            />
          )}

          {/* Temporal Slider */}
          {showTemporalSlider && (
            <div className="mt-6">
              <TemporalSlider occurrences={occurrences} onTimeRangeChange={handleTimeRangeChange} />
            </div>
          )}

          {/* Side Panels */}
          {activeSidebar && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSidebar === 'nearby' && (
                <div className="md:col-span-2 lg:col-span-2">
                  <NearbyPanel onSelectSpecies={(s) => setSelectedSpecies(s.scientificName)} />
                </div>
              )}
              {activeSidebar === 'identify' && (
                <div className="md:col-span-2 lg:col-span-2">
                  <PlantIdentifier onIdentified={(result) => setSelectedSpecies(result.scientificName)} />
                </div>
              )}
              {activeSidebar === 'pathology' && (
                <div className="md:col-span-2 lg:col-span-2">
                  <PathologyPanel />
                </div>
              )}
              {activeSidebar === 'corridors' && (
                <div className="md:col-span-2 lg:col-span-2">
                  <CorridorPanel occurrences={occurrences} bounds={boundingBox ? { south: boundingBox[0][0], north: boundingBox[1][0], west: boundingBox[0][1], east: boundingBox[1][1] } : null} />
                </div>
              )}
              {activeSidebar === 'sdm' && (
                <div className="md:col-span-2 lg:col-span-2">
                  <SDMPanel occurrences={occurrences} speciesName={searchQuery || selectedExample || 'Unknown'} />
                </div>
              )}
              {selectedSpecies && (
                <div className="lg:col-span-1">
                  <TechnicalSheetPanel scientificName={selectedSpecies} />
                </div>
              )}
            </div>
          )}

          {/* Technical Sheet for selected occurrence */}
          {!activeSidebar && selectedSpecies && (
            <div className="mt-6">
              <TechnicalSheetPanel scientificName={selectedSpecies} />
            </div>
          )}
        </FeatureGate>
      </section>

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
          <strong className="font-bold">Error: </strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default MapsPage;
export const dynamic = 'force-dynamic';
