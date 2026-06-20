'use client';

import { GitPullRequest, Spinner, MapPin } from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';

import { useCorridors } from '../hooks/useCorridors';
import { useMode, getTextColors } from '../context/ModeContext';
import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

interface CorridorPanelProps {
  occurrences: GBIFOccurrence[];
  bounds: { south: number; north: number; west: number; east: number } | null;
}

export function CorridorPanel({ occurrences, bounds }: CorridorPanelProps) {
  const { theme } = useMode();
  const textColors = getTextColors(theme);
  const {
    corridors,
    coreAreas,
    loading,
    progress,
    error,
    analyze,
    reset,
  } = useCorridors();

  const [coreRadiusKm, setCoreRadiusKm] = useState(10);

  const accentColor =
    theme === 'light' ? 'text-blue-600' : 'text-blue-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const handleAnalyze = () => {
    if (!bounds) return;
    analyze(occurrences, bounds, coreRadiusKm);
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
          {/* Summary */}
          <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-green-50' : 'bg-green-900/30'}`}>
            <p className={`text-sm font-medium ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>
              Found {corridors.length} corridor{corridors.length !== 1 ? 's' : ''}
            </p>
            <p className={`text-xs ${textColors.secondary}`}>
              {coreAreas.length} core habitat areas identified
            </p>
          </div>

          {/* Core Areas */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Core Habitat Areas
            </h4>
            <div className="space-y-1">
              {coreAreas.map((area) => (
                <div
                  key={area.id}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                    theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
                  }`}
                >
                  <MapPin size={12} className="text-green-500" />
                  <span className={textColors.primary}>
                    Area {area.id + 1}
                  </span>
                  <span className={textColors.secondary}>
                    ({area.lat.toFixed(2)}, {area.lng.toFixed(2)})
                  </span>
                  <span className={`ml-auto ${textColors.secondary}`}>
                    {area.occurrenceCount} obs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Corridors */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Corridor Paths
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {corridors.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded-lg text-xs ${
                    theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
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
                  <div className="flex items-center justify-between mt-1">
                    <span className={textColors.secondary}>
                      {c.path.length} waypoints
                    </span>
                    <span className={`font-medium ${
                      c.resistance < 50
                        ? 'text-green-600'
                        : c.resistance < 200
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}>
                      Resistance: {c.resistance.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
