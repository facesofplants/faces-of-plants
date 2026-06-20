'use client';

import { Play, Pause, SkipBack, SkipForward } from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import { useMode, getTextColors } from '../context/ModeContext';


interface TemporalSliderProps {
  occurrences: GBIFOccurrence[];
  onTimeRangeChange: (startYear: number, endYear: number) => void;
  autoPlay?: boolean;
}

export const TemporalSlider: React.FC<TemporalSliderProps> = ({
  occurrences,
  onTimeRangeChange,
  autoPlay = false,
}) => {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';

  // Get year range from occurrences
  const yearData = occurrences
    .filter((occ) => occ.eventDate)
    .map((occ) => new Date(occ.eventDate!).getFullYear())
    .filter((year) => !isNaN(year))
    .sort((a, b) => a - b);

  const minYear = yearData.length > 0 ? Math.min(...yearData) : 1900;
  const maxYear = yearData.length > 0 ? Math.max(...yearData) : new Date().getFullYear();

  const [currentStartYear, setCurrentStartYear] = useState(minYear);
  const [currentEndYear, setCurrentEndYear] = useState(maxYear);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per year
  // Manual search trigger state
  const [lastSearchedRange, setLastSearchedRange] = useState<{ start: number; end: number }>({
    start: minYear,
    end: maxYear,
  });

  // Calculate occurrences per year for visualization
  const occurrencesByYear = React.useMemo(() => {
    const yearCounts: Record<number, number> = {};
    for (let year = minYear; year <= maxYear; year++) {
      yearCounts[year] = 0;
    }

    yearData.forEach((year) => {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    return yearCounts;
  }, [yearData, minYear, maxYear]);

  const maxCount = Math.max(...Object.values(occurrencesByYear));

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) {return;}

    const interval = setInterval(() => {
      setCurrentEndYear((prev) => {
        if (prev >= maxYear) {
          setCurrentStartYear(minYear);
          return minYear + 5; // 5-year window
        }
        setCurrentStartYear((prev) => prev + 1);
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, maxYear, minYear, playbackSpeed]);

  // Manual search handler
  const handleManualSearch = () => {
    setLastSearchedRange({ start: currentStartYear, end: currentEndYear });
    onTimeRangeChange(currentStartYear, currentEndYear);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStartYear(minYear);
    setCurrentEndYear(maxYear);
  };

  const handleSkipToEnd = () => {
    setIsPlaying(false);
    setCurrentStartYear(maxYear - 5);
    setCurrentEndYear(maxYear);
  };

  if (yearData.length === 0) {
    return (
      <div
        className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'}`}
      >
        <p className={`text-sm ${textColors.secondary} text-center`}>
          No temporal data available for current results
        </p>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold ${textColors.primary}`}>Temporal Exploration</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-gray-800'} transition-colors`}
            title="Reset to full range"
          >
            <SkipBack className={`w-4 h-4 ${textColors.primary}`} />
          </button>
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded-lg ${
              theme === 'light'
                ? isCitizen
                  ? 'bg-green-100 hover:bg-green-200'
                  : 'bg-blue-100 hover:bg-blue-200'
                : isCitizen
                  ? 'bg-green-900/50 hover:bg-green-900/70'
                  : 'bg-blue-900/50 hover:bg-blue-900/70'
            } transition-colors`}
            title={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? (
              <Pause className={`w-4 h-4 ${isCitizen ? 'text-green-600' : 'text-blue-600'}`} />
            ) : (
              <Play className={`w-4 h-4 ${isCitizen ? 'text-green-600' : 'text-blue-600'}`} />
            )}
          </button>
          <button
            onClick={handleSkipToEnd}
            className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-gray-800'} transition-colors`}
            title="Skip to recent years"
          >
            <SkipForward className={`w-4 h-4 ${textColors.primary}`} />
          </button>
        </div>
      </div>

      {/* Manual search trigger */}
      <div className="flex justify-end mb-2">
        <button
          onClick={handleManualSearch}
          disabled={
            lastSearchedRange.start === currentStartYear && lastSearchedRange.end === currentEndYear
          }
          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm
            ${
              lastSearchedRange.start === currentStartYear &&
              lastSearchedRange.end === currentEndYear
                ? theme === 'light'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : isCitizen
                  ? theme === 'light'
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-green-700 text-white hover:bg-green-800'
                  : theme === 'light'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-blue-700 text-white hover:bg-blue-800'
            }
          `}
        >
          Search this time range
        </button>
      </div>

      {/* Timeline visualization */}
      <div className="mb-4">
        <div className="flex items-end justify-between h-16 mb-2">
          {Object.entries(occurrencesByYear)
            .filter(
              ([year]) => parseInt(year) % Math.max(1, Math.floor((maxYear - minYear) / 20)) === 0,
            )
            .map(([year, count]) => {
              const yearNum = parseInt(year);
              const isInRange = yearNum >= currentStartYear && yearNum <= currentEndYear;
              const height = maxCount > 0 ? (count / maxCount) * 60 : 0;

              return (
                <div
                  key={year}
                  className="flex flex-col items-center"
                  style={{ width: `${100 / Math.min(20, maxYear - minYear + 1)}%` }}
                >
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isInRange
                        ? isCitizen
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                        : theme === 'light'
                          ? 'bg-gray-300'
                          : 'bg-gray-600'
                    }`}
                    style={{ height: `${height}px` }}
                    title={`${year}: ${count} occurrences`}
                  />
                  <span
                    className={`text-xs mt-1 ${isInRange ? textColors.primary : textColors.secondary}`}
                  >
                    {year}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Range controls */}
      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium ${textColors.secondary} mb-2`}>
            Start Year: {currentStartYear}
          </label>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={currentStartYear}
            onChange={(e) => setCurrentStartYear(parseInt(e.target.value))}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
            } ${isCitizen ? 'slider-green' : 'slider-blue'}`}
            disabled={isPlaying}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium ${textColors.secondary} mb-2`}>
            End Year: {currentEndYear}
          </label>
          <input
            type="range"
            min={currentStartYear}
            max={maxYear}
            value={currentEndYear}
            onChange={(e) => setCurrentEndYear(parseInt(e.target.value))}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
            } ${isCitizen ? 'slider-green' : 'slider-blue'}`}
            disabled={isPlaying}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium ${textColors.secondary} mb-2`}>
            Animation Speed: {playbackSpeed}ms per year
          </label>
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
            } ${isCitizen ? 'slider-green' : 'slider-blue'}`}
          />
        </div>
      </div>

      {/* Current range info */}
      <div className={`mt-4 p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'}`}>
        <div className="text-sm">
          <span className={`font-medium ${textColors.primary}`}>
            Current Range: {currentStartYear} - {currentEndYear}
          </span>
          <br />
          <span className={textColors.secondary}>
            Showing{' '}
            {
              occurrences.filter((occ) => {
                if (!occ.eventDate) {return false;}
                const year = new Date(occ.eventDate).getFullYear();
                return year >= currentStartYear && year <= currentEndYear;
              }).length
            }{' '}
            of {occurrences.length} occurrences
          </span>
        </div>
      </div>

      <style jsx>{`
        .slider-green::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
        }
        .slider-blue::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        .slider-green::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
          border: none;
        }
        .slider-blue::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default TemporalSlider;
