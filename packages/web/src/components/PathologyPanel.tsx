'use client';

import { Warning, Spinner, CheckCircle, XCircle } from '@phosphor-icons/react';
import React, { useRef } from 'react';

import { usePathology } from '../hooks/usePathology';
import { useMode, getTextColors } from '../context/ModeContext';
import type { PathologyResult } from '../lib/pathology-detector';

const severityColors: Record<string, { bg: string; text: string; label: string }> = {
  healthy: { bg: 'bg-green-100', text: 'text-green-700', label: 'Healthy' },
  low: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Low Risk' },
  medium: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Medium' },
  high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High Risk' },
  critical: { bg: 'bg-red-200', text: 'text-red-800', label: 'Critical' },
};

const severityColorsDark: Record<string, { bg: string; text: string; label: string }> = {
  healthy: { bg: 'bg-green-900/50', text: 'text-green-300', label: 'Healthy' },
  low: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', label: 'Low Risk' },
  medium: { bg: 'bg-orange-900/50', text: 'text-orange-300', label: 'Medium' },
  high: { bg: 'bg-red-900/50', text: 'text-red-300', label: 'High Risk' },
  critical: { bg: 'bg-red-900/70', text: 'text-red-200', label: 'Critical' },
};

function formatClassName(className: string): string {
  const parts = className.split('___');
  const crop = (parts[0] || '').replace(/_/g, ' ');
  const condition = (parts[1] || '').replace(/_/g, ' ');
  return `${crop} — ${condition}`;
}

function ResultCard({ result, theme }: { result: PathologyResult; theme: string }) {
  const colors = theme === 'light' ? severityColors : severityColorsDark;
  const sev = colors[result.severity] || colors.low;

  return (
    <div className={`p-3 rounded-lg border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'} truncate`}>
            {result.crop}
          </p>
          <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
            {result.commonName}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.bg} ${sev.text}`}>
          {sev.label}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'}`}>
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              result.confidence >= 0.7
                ? 'bg-red-500'
                : result.confidence >= 0.4
                  ? 'bg-orange-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${result.confidence * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
          {(result.confidence * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function PathologyPanel() {
  const { theme } = useMode();
  const textColors = getTextColors(theme);
  const { results, loading, error, modelReady, detect, reset } = usePathology();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accentColor =
    theme === 'light' ? 'text-green-600' : 'text-green-500';

  const cardBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await detect(file);
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`${cardBg} rounded-xl p-4 border backdrop-blur-md`}>
      <h3 className={`text-sm font-semibold ${accentColor} flex items-center gap-2 mb-3`}>
        <Warning size={16} />
        Plant Disease Detection
      </h3>

      {/* Model status */}
      {!modelReady && !loading && (
        <div className={`text-xs p-2 rounded-lg mb-3 ${
          theme === 'light' ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-900/30 text-yellow-300'
        }`}>
          ONNX model not found. Run <code className="font-mono">python scripts/convert-to-onnx.py</code> to generate it.
        </div>
      )}

      {/* Upload area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          theme === 'light'
            ? 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            : 'border-gray-600 hover:border-green-500 hover:bg-green-900/20'
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size={24} className={`${accentColor} animate-spin`} />
            <p className={`text-sm ${textColors.secondary}`}>Analyzing leaf image...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Warning size={24} className={textColors.secondary} />
            <p className={`text-sm ${textColors.secondary}`}>
              Upload a leaf photo to detect diseases
            </p>
            <p className={`text-xs ${textColors.secondary}`}>
              JPEG or PNG, max 10MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 ${
          theme === 'light' ? 'bg-red-50 text-red-700' : 'bg-red-900/30 text-red-300'
        }`}>
          <XCircle size={16} />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className={`text-xs font-medium ${textColors.secondary}`}>Results</h4>
            <button
              onClick={reset}
              className={`text-xs ${accentColor} hover:underline`}
            >
              Clear
            </button>
          </div>
          {results.map((r) => (
            <ResultCard key={r.className} result={r} theme={theme} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className={`text-xs mt-3 ${textColors.secondary}`}>
        For reference only. Consult an expert for definitive diagnosis.
      </p>
    </div>
  );
}
