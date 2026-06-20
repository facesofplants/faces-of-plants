'use client';

import { MapPin, Spinner, Warning } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';

import { useMode, getTextColors } from '../context/ModeContext';
import {
  getUserPosition,
  searchNearbySpecies,
  type NearbySpecies,
} from '../lib/geolocation';

interface NearbyPanelProps {
  onSelectSpecies?: (species: NearbySpecies) => void;
}

export function NearbyPanel({ onSelectSpecies }: NearbyPanelProps) {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [species, setSpecies] = useState<NearbySpecies[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(10);

  const accentColor =
    theme === 'light'
      ? isCitizen ? 'text-green-600' : 'text-blue-600'
      : isCitizen ? 'text-green-500' : 'text-blue-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const search = async () => {
    setLoading(true);
    setError(null);

    try {
      const pos = await getUserPosition();
      setPosition(pos);

      const results = await searchNearbySpecies(pos, radius);
      setSpecies(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2`}>
          <MapPin size={16} />
          Nearby Species
        </h3>
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className={`text-xs px-2 py-1 rounded border ${
            theme === 'light'
              ? 'bg-white border-gray-200 text-gray-700'
              : 'bg-gray-800 border-gray-600 text-gray-300'
          }`}
        >
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={25}>25 km</option>
          <option value={50}>50 km</option>
        </select>
      </div>

      {!position && !loading && (
        <button
          onClick={search}
          className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            theme === 'light'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          Find Plants Near Me
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} className={`${accentColor} animate-spin`} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <Warning size={16} />
          {error}
        </div>
      )}

      {species.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className={`text-xs ${textColors.secondary}`}>
            {species.length} species found within {radius} km
          </p>
          {species.map((s) => (
            <button
              key={s.species}
              onClick={() => onSelectSpecies?.(s)}
              className={`w-full text-left p-2 rounded-lg border transition-colors ${
                theme === 'light'
                  ? 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  : 'border-gray-700 hover:border-green-600 hover:bg-green-900/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {s.image && (
                  <img
                    src={s.image}
                    alt={s.species}
                    width={48}
                    height={48}
                    className="rounded object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${textColors.primary} truncate`}>
                    {s.species}
                  </p>
                  <p className={`text-xs ${textColors.secondary} italic truncate`}>
                    {s.scientificName}
                  </p>
                </div>
                <span className={`text-xs ${textColors.secondary} ml-auto whitespace-nowrap`}>
                  {s.distance.toFixed(1)} km
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {position && species.length === 0 && !loading && (
        <p className={`text-xs ${textColors.secondary} text-center py-4`}>
          No species found nearby. Try increasing the radius.
        </p>
      )}
    </div>
  );
}
