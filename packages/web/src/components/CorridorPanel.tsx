'use client';

import { GitPullRequest, Spinner, MapPin, TreeStructure, Warning, ShieldCheck, Path, ArrowsOutCardinal } from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';

import { useCorridors } from '../hooks/useCorridors';
import { useMode, getTextColors } from '../context/ModeContext';
import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';
import type { SteppingStone, ConnectivityAssessment } from '../lib/corridor-analysis';

interface CorridorPanelProps {
  occurrences: GBIFOccurrence[];
  bounds: { south: number; north: number; west: number; east: number } | null;
  genus?: string;
  onAreaClick?: (lat: number, lng: number) => void;
  onZoomToAll?: () => void;
  onResults?: (
    corridors: { id: number; path: [number, number][]; resistance: number; lengthKm: number; viability?: any }[],
    coreAreas: { id: number; lat: number; lng: number; occurrenceCount: number; protectedArea?: any }[],
    steppingStones?: SteppingStone[],
    connectivity?: ConnectivityAssessment | null,
  ) => void;
}

export function CorridorPanel({ occurrences, bounds, genus: propGenus, onAreaClick, onZoomToAll, onResults }: CorridorPanelProps) {
  const { theme } = useMode();
  const textColors = getTextColors(theme);
  const {
    corridors,
    coreAreas,
    steppingStones,
    connectivity,
    loading,
    progress,
    error,
    analyze,
    reset,
  } = useCorridors();

  const [coreRadiusKm, setCoreRadiusKm] = useState(10);
  const [genus, setGenus] = useState(propGenus || '');

  // Update genus from prop
  useEffect(() => {
    if (propGenus) setGenus(propGenus);
  }, [propGenus]);

  // Propagate results to parent for map visualization
  useEffect(() => {
    if (onResults) {
      onResults(corridors, coreAreas, steppingStones, connectivity);
    }
  }, [corridors, coreAreas, steppingStones, connectivity, onResults]);

  const accentColor =
    theme === 'light' ? 'text-blue-600' : 'text-blue-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const handleAnalyze = () => {
    if (!bounds) return;
    analyze(occurrences, bounds, coreRadiusKm, genus || undefined);
  };

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-3`}>
        <GitPullRequest size={16} />
        Ecological Corridors
      </h3>

      {/* Controls */}
      <div className="space-y-3 mb-4">
        <div>
          <label className={`text-xs font-medium ${textColors.secondary} block mb-1`}>
            Core Area Radius: {coreRadiusKm} km
          </label>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={coreRadiusKm}
            onChange={(e) => setCoreRadiusKm(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className={`text-xs font-medium ${textColors.secondary} block mb-1`}>
            Genus (for dispersal assessment)
          </label>
          <input
            type="text"
            placeholder="e.g. Quercus, Pinus..."
            value={genus}
            onChange={(e) => setGenus(e.target.value)}
            className={`w-full px-2 py-1.5 text-xs rounded-lg border ${
              theme === 'light' ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-800 text-white'
            }`}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || !bounds}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading || !bounds
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : theme === 'light'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size={14} className="animate-spin" />
                Analyzing...
              </span>
            ) : (
              'Find Corridors'
            )}
          </button>

          {corridors.length > 0 && (
            <button
              onClick={reset}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                theme === 'light'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {loading && progress && (
        <div className={`text-xs p-2 rounded-lg mb-3 ${
          theme === 'light' ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/30 text-blue-300'
        }`}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`text-xs p-2 rounded-lg mb-3 ${
          theme === 'light' ? 'bg-red-50 text-red-700' : 'bg-red-900/30 text-red-300'
        }`}>
          {error}
        </div>
      )}

      {/* Results */}
      {corridors.length > 0 && (
        <div className="space-y-3">
          {/* Connectivity Assessment */}
          {connectivity && (
            <div className={`p-3 rounded-lg ${
              connectivity.rating === 'well-connected' ? (theme === 'light' ? 'bg-green-50' : 'bg-green-900/30') :
              connectivity.rating === 'partially-connected' ? (theme === 'light' ? 'bg-yellow-50' : 'bg-yellow-900/30') :
              connectivity.rating === 'fragmented' ? (theme === 'light' ? 'bg-orange-50' : 'bg-orange-900/30') :
              (theme === 'light' ? 'bg-red-50' : 'bg-red-900/30')
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <TreeStructure size={14} className={
                  connectivity.rating === 'well-connected' ? 'text-green-600' :
                  connectivity.rating === 'partially-connected' ? 'text-yellow-600' :
                  connectivity.rating === 'fragmented' ? 'text-orange-600' :
                  'text-red-600'
                } />
                <span className={`text-xs font-semibold ${
                  connectivity.rating === 'well-connected' ? 'text-green-700' :
                  connectivity.rating === 'partially-connected' ? 'text-yellow-700' :
                  connectivity.rating === 'fragmented' ? 'text-orange-700' :
                  'text-red-700'
                }`}>
                  Connectivity: {connectivity.score}% — {connectivity.rating.replace('-', ' ')}
                </span>
              </div>
              <p className={`text-xs ${textColors.secondary}`}>{connectivity.summary}</p>
              {connectivity.dispersalProfile.genus !== 'default' && (
                <p className={`text-xs mt-1 ${textColors.secondary}`}>
                  Dispersal: {connectivity.dispersalProfile.mechanism} — max {connectivity.dispersalProfile.maxDistanceKm} km
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          <div className={`p-3 rounded-lg flex items-center justify-between ${theme === 'light' ? 'bg-green-50' : 'bg-green-900/30'}`}>
            <div>
              <p className={`text-sm font-medium ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>
                Found {corridors.length} corridor{corridors.length !== 1 ? 's' : ''}
              </p>
              <p className={`text-xs ${textColors.secondary}`}>
                {coreAreas.length} core areas · {steppingStones.filter(s => s.withinRange).length} stepping stones
              </p>
            </div>
            {onZoomToAll && (
              <button
                onClick={onZoomToAll}
                className={`p-1.5 rounded-lg transition-colors ${
                  theme === 'light' ? 'hover:bg-green-100 text-green-600' : 'hover:bg-green-800/40 text-green-400'
                }`}
                title="Zoom to all areas"
              >
                <ArrowsOutCardinal size={16} />
              </button>
            )}
          </div>

          {/* Isolated Populations Warning */}
          {connectivity && connectivity.isolatedPopulations.length > 0 && (
            <div className={`p-2 rounded-lg flex items-start gap-2 ${
              theme === 'light' ? 'bg-red-50' : 'bg-red-900/20'
            }`}>
              <Warning size={14} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-600">
                  {connectivity.isolatedPopulations.length} isolated population{connectivity.isolatedPopulations.length !== 1 ? 's' : ''}
                </p>
                <p className={`text-xs ${textColors.secondary}`}>
                  At risk of genetic degradation. Habitat restoration needed.
                </p>
              </div>
            </div>
          )}

          {/* Core Areas */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Core Habitat Areas
            </h4>
            <div className="space-y-1">
              {coreAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => onAreaClick?.(area.lat, area.lng)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs w-full text-left transition-colors ${
                    theme === 'light' ? 'bg-gray-50 hover:bg-green-50' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {area.protectedArea ? (
                    <ShieldCheck size={12} className="text-emerald-500" />
                  ) : (
                    <MapPin size={12} className="text-green-500" />
                  )}
                  <span className={textColors.primary}>
                    {area.protectedArea ? area.protectedArea.name : `Area ${area.id + 1}`}
                  </span>
                  <span className={`ml-auto ${textColors.secondary}`}>
                    {area.occurrenceCount > 0 ? `${area.occurrenceCount} obs` : 'Protected'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Corridors */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Corridor Paths
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {corridors.filter(c => !c.viability || c.viability.rating !== 'unlikely').map((c) => {
                // path is [lng, lat] pairs — swap for onAreaClick(lat, lng)
                const midIdx = Math.floor(c.path.length / 2);
                const midPoint = c.path[midIdx];
                return (
                <button
                  key={c.id}
                  onClick={() => midPoint && onAreaClick?.(midPoint[1], midPoint[0])}
                  className={`p-2 rounded-lg text-xs w-full text-left transition-colors ${
                    theme === 'light' ? 'bg-gray-50 hover:bg-blue-50' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={textColors.primary}>
                      Corridor {c.id}
                    </span>
                    <span className={textColors.secondary}>
                      {c.lengthKm.toFixed(1)} km
                    </span>
                  </div>
                  {c.viability && (
                    <div className="flex items-center justify-between mt-1">
                      <span className={`font-medium text-xs ${
                        c.viability.rating === 'optimal' ? 'text-green-600' :
                        c.viability.rating === 'feasible' ? 'text-blue-600' :
                        c.viability.rating === 'marginal' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {c.viability.rating}
                      </span>
                      <span className={textColors.secondary}>
                        R: {c.resistance.toFixed(0)}
                      </span>
                    </div>
                  )}
                </button>
                );
              })}
            </div>
          </div>

          {/* Stepping Stones */}
          {steppingStones.length > 0 && (
            <div>
              <h4 className={`text-xs font-medium ${textColors.secondary} mb-2 flex items-center gap-1`}>
                <Path size={12} />
                Stepping Stones ({steppingStones.filter(s => s.withinRange).length} active)
              </h4>
              <p className={`text-xs ${textColors.secondary}`}>
                {steppingStones.filter(s => s.withinRange).length} isolated occurrences serve as intermediate habitat patches along corridors.
                {steppingStones.filter(s => !s.withinRange).length > 0 && (
                  <> {steppingStones.filter(s => !s.withinRange).length} are beyond stepping range.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* No results yet */}
      {!loading && corridors.length === 0 && !error && (
        <p className={`text-xs ${textColors.secondary} text-center py-4`}>
          Click "Find Corridors" to analyze habitat connectivity between species clusters.
        </p>
      )}
    </div>
  );
}
