'use client';

import { Brain, TrendUp, MapPin, Thermometer, CloudRain, Mountains, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import React, { useState } from 'react';

import { useSDM } from '../hooks/useSDM';
import { useMode, getTextColors } from '../context/ModeContext';
import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

interface SDMPanelProps {
  occurrences: GBIFOccurrence[];
  speciesName: string;
}

export function SDMPanel({ occurrences, speciesName }: SDMPanelProps) {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';
  const { result, loading, progress, error, analyze, reset } = useSDM();

  const [threshold, setThreshold] = useState(40);
  const [showFuture, setShowFuture] = useState(false);

  const accentColor =
    theme === 'light' ? 'text-blue-600' : 'text-blue-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const handleAnalyze = () => {
    analyze(occurrences, threshold);
  };

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-3`}>
        <Brain size={16} />
        Species Distribution Model
      </h3>

      {/* Controls */}
      <div className="space-y-3 mb-4">
        <div>
          <label className={`text-xs font-medium ${textColors.secondary} block mb-1`}>
            Presence Threshold: {threshold}%
          </label>
          <input
            type="range"
            min="20"
            max="80"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || occurrences.length === 0}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading || occurrences.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : theme === 'light'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Brain size={14} className="animate-pulse" />
                Analyzing...
              </span>
            ) : (
              'Run SDM'
            )}
          </button>

          {result && (
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
      {result && (
        <div className="space-y-4">
          {/* Toggle Current/Future */}
          <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => setShowFuture(false)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !showFuture
                  ? theme === 'light'
                    ? 'bg-white text-gray-900 shadow'
                    : 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Current
            </button>
            <button
              onClick={() => setShowFuture(true)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showFuture
                  ? theme === 'light'
                    ? 'bg-white text-gray-900 shadow'
                    : 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Future (2050)
            </button>
          </div>

          {/* Range Shift Summary */}
          <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={`text-xs ${textColors.secondary}`}>
                  {showFuture ? 'Future' : 'Current'} Range
                </p>
                <p className={`text-lg font-bold ${textColors.primary}`}>
                  {showFuture
                    ? result.rangeShift.suitableAreaFuture.toFixed(0)
                    : result.rangeShift.suitableAreaCurrent.toFixed(0)}
                  <span className="text-xs font-normal ml-1">km²</span>
                </p>
              </div>
              <div>
                <p className={`text-xs ${textColors.secondary}`}>Range Shift</p>
                <div className="flex items-center gap-1">
                  {result.rangeShift.northwardShiftKm > 0 ? (
                    <ArrowUp size={14} className="text-red-500" />
                  ) : (
                    <ArrowDown size={14} className="text-blue-500" />
                  )}
                  <p className={`text-lg font-bold ${
                    result.rangeShift.northwardShiftKm > 0 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {Math.abs(result.rangeShift.northwardShiftKm).toFixed(0)}
                    <span className="text-xs font-normal ml-1">km N</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Area change */}
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className={`text-xs ${textColors.secondary}`}>
                Area change:{' '}
                <span className={`font-medium ${
                  result.rangeShift.areaChange > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {result.rangeShift.areaChange > 0 ? '+' : ''}
                  {result.rangeShift.areaChange.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>

          {/* Suitability Distribution */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Suitability Distribution
            </h4>
            <div className="grid grid-cols-5 gap-1">
              {[0, 1, 2, 3, 4].map((bucket) => {
                const cells = showFuture ? result.future : result.current;
                const low = bucket * 20;
                const high = (bucket + 1) * 20;
                const count = cells.filter(
                  (c) => c.suitability >= low && c.suitability < high,
                ).length;
                const maxCount = Math.max(
                  ...[0, 1, 2, 3, 4].map((b) =>
                    cells.filter(
                      (c) => c.suitability >= b * 20 && c.suitability < (b + 1) * 20,
                    ).length,
                  ),
                  1,
                );

                return (
                  <div key={bucket} className="text-center">
                    <div
                      className={`mx-auto w-full rounded-t ${
                        theme === 'light' ? 'bg-blue-200' : 'bg-blue-800'
                      }`}
                      style={{ height: `${(count / maxCount) * 40}px` }}
                    />
                    <p className={`text-xs mt-1 ${textColors.secondary}`}>
                      {low}-{high}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Environmental Preferences */}
          <div>
            <h4 className={`text-xs font-medium ${textColors.secondary} mb-2`}>
              Environmental Preferences
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <Thermometer size={12} className="text-red-500" />
                  <span className={`text-xs ${textColors.secondary}`}>Temperature</span>
                </div>
                <p className={`text-xs font-medium ${textColors.primary}`}>
                  {(result.stats.mean[0] / 10).toFixed(1)}°C ± {(result.stats.std[0] / 10).toFixed(1)}°C
                </p>
              </div>
              <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <CloudRain size={12} className="text-blue-500" />
                  <span className={`text-xs ${textColors.secondary}`}>Precipitation</span>
                </div>
                <p className={`text-xs font-medium ${textColors.primary}`}>
                  {result.stats.mean[11].toFixed(0)} mm/yr ± {result.stats.std[11].toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Confidence note */}
          <div className={`p-2 rounded-lg ${
            theme === 'light' ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-900/30 border-yellow-700'
          } border`}>
            <p className={`text-xs ${textColors.secondary}`}>
              <strong>Note:</strong> Simplified SDM based on bioclimatic envelope.
              {isCitizen
                ? ' For accurate predictions, consult with local botanical experts.'
                : ' Consider complementing with MaxEnt or ensemble models for publication.'}
            </p>
          </div>
        </div>
      )}

      {/* No results yet */}
      {!loading && !result && !error && (
        <p className={`text-xs ${textColors.secondary} text-center py-4`}>
          Click "Run SDM" to predict current and future habitat suitability for <em>{speciesName}</em>.
        </p>
      )}
    </div>
  );
}
