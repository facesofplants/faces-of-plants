'use client';

import { BookOpen, Leaf } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';

import { useMode, getTextColors } from '../context/ModeContext';
import {
  initTechnicalSheets,
  getTechnicalSheetByName,
  type TechnicalSheet,
} from '../lib/technical-sheet';

interface TechnicalSheetPanelProps {
  scientificName: string | null;
}

export function TechnicalSheetPanel({ scientificName }: TechnicalSheetPanelProps) {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);
  const isCitizen = mode === 'citizen';

  const [sheet, setSheet] = useState<TechnicalSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'domestic' | 'lab'>('domestic');

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const accentColor =
    theme === 'light'
      ? isCitizen ? 'text-green-600' : 'text-blue-600'
      : isCitizen ? 'text-green-500' : 'text-blue-500';

  useEffect(() => {
    if (!scientificName) {
      setSheet(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // Timeout after 3 seconds to prevent infinite loading
        const result = await Promise.race([
          (async () => {
            await initTechnicalSheets();
            return await getTechnicalSheetByName(scientificName);
          })(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (!cancelled) {
          setSheet(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSheet(null);
          setLoading(false);
        }
      }
    };

    load();

    return () => { cancelled = true; };
  }, [scientificName]);

  if (!scientificName) return null;

  if (loading) {
    return (
      <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
        <p className={`text-sm ${textColors.secondary} text-center py-4`}>
          Loading technical sheet...
        </p>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
        <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-2`}>
          <BookOpen size={16} />
          Technical Sheet
        </h3>
        <p className={`text-xs ${textColors.secondary}`}>
          No technical data available for <em>{scientificName}</em>.
        </p>
      </div>
    );
  }

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-2`}>
        <BookOpen size={16} />
        Technical Sheet
      </h3>

      {/* Header */}
      <div className="mb-3">
        <p className={`text-base font-medium ${textColors.primary}`}>
          {sheet.commonName}
        </p>
        <p className={`text-xs italic ${textColors.secondary}`}>
          {sheet.scientificName} — {sheet.family}
        </p>
        <p className={`text-xs ${textColors.secondary} mt-1`}>
          {sheet.description}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab('domestic')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'domestic'
              ? theme === 'light'
                ? 'bg-green-100 text-green-700'
                : 'bg-green-900/50 text-green-300'
              : theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          <Leaf size={14} />
          Home / Garden
        </button>
        <button
          onClick={() => setActiveTab('lab')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'lab'
              ? theme === 'light'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-blue-900/50 text-blue-300'
              : theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          <Leaf size={14} />
          Laboratory
        </button>
      </div>

      {/* Content */}
      {activeTab === 'domestic' ? (
        <div className={`text-xs ${textColors.secondary} space-y-2`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-medium text-gray-500">Light</p>
              <p>{sheet.domestic.light}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Water</p>
              <p>{sheet.domestic.water}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Soil</p>
              <p>{sheet.domestic.soil}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Temperature</p>
              <p>{sheet.domestic.temperature}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Difficulty</p>
              <p className="capitalize">{sheet.domestic.difficulty}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Season</p>
              <p>{sheet.domestic.season}</p>
            </div>
          </div>

          {sheet.domestic.tips.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">Tips</p>
              <ul className="list-disc list-inside space-y-0.5">
                {sheet.domestic.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {sheet.domestic.commonPests.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">Common Pests</p>
              <p>{sheet.domestic.commonPests.join(', ')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`text-xs ${textColors.secondary} space-y-2`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-medium text-gray-500">Growth Medium</p>
              <p>{sheet.lab.growthMedium}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Temperature</p>
              <p>{sheet.lab.temperature}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Photoperiod</p>
              <p>{sheet.lab.photoperiod}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Subculturing</p>
              <p>{sheet.lab.subculturing}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Sterile</p>
              <p>{sheet.lab.sterileConditions ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Contamination Risk</p>
              <p className="capitalize">{sheet.lab.contaminationRisk}</p>
            </div>
          </div>

          {sheet.lab.protocols.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">Protocols</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {sheet.lab.protocols.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}

          {sheet.lab.equipment.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">Equipment</p>
              <p>{sheet.lab.equipment.join(', ')}</p>
            </div>
          )}

          {sheet.lab.references.length > 0 && (
            <div>
              <p className="font-medium text-gray-500 mb-1">References</p>
              <ul className="list-disc list-inside space-y-0.5">
                {sheet.lab.references.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
