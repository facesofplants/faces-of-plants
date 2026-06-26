'use client';

import { MapPin, Spinner, Warning, Crosshair, MagnifyingGlass, PencilSimple } from '@phosphor-icons/react';
import React, { useState, useCallback } from 'react';

import { useMode, getTextColors } from '../context/ModeContext';
import {
  getUserPosition,
  searchNearbySpecies,
  type NearbySpecies,
} from '../lib/geolocation';

interface NearbyPanelProps {
  onSelectSpecies?: (species: NearbySpecies) => void;
}

/** Reverse geocode lat/lng to a place name via Nominatim */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12&addressdetails=1`,
      { headers: { 'Accept-Language': 'it,en' } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data.address;
    if (!addr) return data.display_name || '';
    // Build a concise name: city/town/village, state/region
    const place = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const region = addr.state || '';
    return [place, region].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

/** Forward geocode a place name to lat/lng via Nominatim */
async function forwardGeocode(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'it,en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
  } catch {
    return null;
  }
}

export function NearbyPanel({ onSelectSpecies }: NearbyPanelProps) {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [species, setSpecies] = useState<NearbySpecies[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState<string>('');
  const [radius, setRadius] = useState(10);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const accentColor =
    theme === 'light'
      ? isCitizen ? 'text-green-600' : 'text-blue-600'
      : isCitizen ? 'text-green-500' : 'text-blue-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const inputBg = theme === 'light'
    ? 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
    : 'bg-gray-800 border-gray-700 text-white placeholder-gray-500';

  /** Locate via browser geolocation */
  const locateMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getUserPosition();
      setPosition(pos);
      const name = await reverseGeocode(pos.lat, pos.lng);
      setPlaceName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Resolve manual input (lat,lng OR place name) */
  const resolveManualInput = useCallback(async () => {
    if (!manualInput.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      // Try lat,lng format first
      const coordMatch = manualInput.match(/^\s*(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)\s*$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setPosition({ lat, lng });
          const name = await reverseGeocode(lat, lng);
          setPlaceName(name);
          setShowManualInput(false);
          setGeocoding(false);
          return;
        }
      }
      // Otherwise forward geocode
      const result = await forwardGeocode(manualInput.trim());
      if (result) {
        setPosition({ lat: result.lat, lng: result.lng });
        setPlaceName(result.displayName.split(',').slice(0, 2).join(','));
        setShowManualInput(false);
      } else {
        setError('Luogo non trovato. Prova con un nome diverso.');
      }
    } catch {
      setError('Errore nella ricerca del luogo');
    } finally {
      setGeocoding(false);
    }
  }, [manualInput]);

  /** Search species at current position */
  const searchSpecies = useCallback(async () => {
    if (!position) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchNearbySpecies(position, radius);
      setSpecies(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [position, radius]);

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

      {/* Position display */}
      {position && (
        <div className={`mb-3 p-2 rounded-lg text-xs space-y-0.5 ${
          theme === 'light' ? 'bg-green-50 border border-green-100' : 'bg-green-900/20 border border-green-800/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${theme === 'light' ? 'text-green-700' : 'text-green-300'}`}>
              {placeName || 'Posizione impostata'}
            </span>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-0.5 rounded transition-colors ${
                theme === 'light' ? 'hover:bg-green-100 text-green-600' : 'hover:bg-green-800/40 text-green-400'
              }`}
              title="Modifica posizione"
            >
              <PencilSimple size={11} />
            </button>
          </div>
          <div className={textColors.secondary}>
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </div>
        </div>
      )}

      {/* Location buttons (when no position yet) */}
      {!position && !loading && !showManualInput && (
        <div className="space-y-2 mb-3">
          <button
            onClick={locateMe}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <Crosshair size={14} />
            Usa la mia posizione
          </button>
          <button
            onClick={() => setShowManualInput(true)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <PencilSimple size={14} />
            Inserisci manualmente
          </button>
        </div>
      )}

      {/* Manual input field */}
      {showManualInput && (
        <div className="mb-3">
          <form onSubmit={(e) => { e.preventDefault(); resolveManualInput(); }} className="flex gap-1.5">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Roma, Italia oppure 41.89, 12.49"
              className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border ${inputBg}`}
              autoFocus
            />
            <button
              type="submit"
              disabled={geocoding || !manualInput.trim()}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                geocoding || !manualInput.trim()
                  ? 'text-gray-400 cursor-not-allowed'
                  : theme === 'light'
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-green-400 hover:bg-green-900/30'
              }`}
            >
              {geocoding ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} />}
            </button>
          </form>
          {!position && (
            <button
              onClick={() => { setShowManualInput(false); }}
              className={`mt-1.5 text-xs ${textColors.secondary} hover:underline`}
            >
              ← Usa geolocalizzazione
            </button>
          )}
        </div>
      )}

      {/* Search button (when position is set) */}
      {position && !loading && (
        <button
          onClick={searchSpecies}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-3 ${
            theme === 'light'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          <MagnifyingGlass size={14} />
          Cerca specie nel raggio di {radius} km
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
