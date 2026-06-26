'use client';

import { Camera, Spinner, Warning, CheckCircle } from '@phosphor-icons/react';
import Image from 'next/image';
import React, { useRef, useState } from 'react';

import { useMode, getTextColors } from '../context/ModeContext';
import {
  identifyPlant,
  validateImageFile,
  fileToDataURL,
  type PlantIdentification,
} from '../lib/plantnet';

interface PlantIdentifierProps {
  onIdentified?: (identification: PlantIdentification) => void;
}

export function PlantIdentifier({ onIdentified }: PlantIdentifierProps) {
  const { theme } = useMode();
  const textColors = getTextColors(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlantIdentification[]>([]);

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const accentColor =
    theme === 'light' ? 'text-green-600' : 'text-green-500';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setError(null);
    setResults([]);

    const dataUrl = await fileToDataURL(file);
    setPreview(dataUrl);

    setLoading(true);
    try {
      const identifications = await identifyPlant(file);
      setResults(identifications);
      if (identifications.length > 0) {
        onIdentified?.(identifications[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-3`}>
        <Camera size={16} />
        Identify Plant
      </h3>

      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className={`w-full px-4 py-3 rounded-lg text-sm font-medium border-2 border-dashed transition-colors ${
          theme === 'light'
            ? 'border-gray-300 hover:border-green-400 text-gray-600 hover:text-green-600'
            : 'border-gray-600 hover:border-green-500 text-gray-400 hover:text-green-400'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size={16} className="animate-spin" />
            Analyzing...
          </span>
        ) : (
          'Click to upload a plant photo'
        )}
      </button>

      {/* Preview */}
      {preview && (
        <div className="mt-3 relative">
          <Image
            src={preview}
            alt="Preview"
            width={200}
            height={200}
            className="rounded-lg mx-auto object-cover"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <Warning size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className={`text-xs ${textColors.secondary}`}>
            {results.length} possible matches:
          </p>
          {results.slice(0, 5).map((r, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg border ${
                i === 0
                  ? theme === 'light'
                    ? 'border-green-300 bg-green-50'
                    : 'border-green-600 bg-green-900/20'
                  : theme === 'light'
                    ? 'border-gray-200'
                    : 'border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${textColors.primary}`}>
                    {r.commonName}
                  </p>
                  <p className={`text-xs italic ${textColors.secondary}`}>
                    {r.scientificName}
                  </p>
                  <p className={`text-xs ${textColors.secondary}`}>
                    {r.family}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {i === 0 && <CheckCircle size={14} className="text-green-500" />}
                  <span
                    className={`text-xs font-medium ${
                      r.confidence > 0.7
                        ? 'text-green-600'
                        : r.confidence > 0.4
                          ? 'text-yellow-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
