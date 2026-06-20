'use client';

import { Leaf, Microscope } from '@phosphor-icons/react';
import React from 'react';

import { useMode } from '../context/ModeContext';

interface ModeSelectorProps {
  variant?: 'default' | 'compact' | 'full';
  showLabels?: boolean;
}

export function ModeSelector({ variant = 'default', showLabels = true }: ModeSelectorProps) {
  const { mode, setMode, theme } = useMode();
  const isCitizen = mode === 'citizen';

  if (variant === 'full') {
    // Full version for profile page with descriptions
    return (
      <div className="space-y-4">
        <div
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            isCitizen
              ? theme === 'light'
                ? 'border-green-500 bg-green-50'
                : 'border-green-400 bg-green-900/20'
              : theme === 'light'
                ? 'border-gray-200 hover:border-green-300'
                : 'border-gray-600 hover:border-green-500'
          }`}
          onClick={() => setMode('citizen')}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-full ${
                isCitizen
                  ? 'bg-green-500 text-white'
                  : theme === 'light'
                    ? 'bg-gray-100 text-green-600'
                    : 'bg-gray-700 text-green-400'
              }`}
            >
              <Leaf size={20} />
            </div>
            <div className="flex-1">
              <h3
                className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}
              >
                Citizen Scientist
              </h3>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Simplified interface for nature enthusiasts and community science
              </p>
            </div>
            <div
              className={`w-4 h-4 rounded-full border-2 ${
                isCitizen
                  ? 'border-green-500 bg-green-500'
                  : theme === 'light'
                    ? 'border-gray-300'
                    : 'border-gray-600'
              }`}
            >
              {isCitizen && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
            </div>
          </div>
        </div>

        <div
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            !isCitizen
              ? theme === 'light'
                ? 'border-blue-500 bg-blue-50'
                : 'border-blue-400 bg-blue-900/20'
              : theme === 'light'
                ? 'border-gray-200 hover:border-blue-300'
                : 'border-gray-600 hover:border-blue-500'
          }`}
          onClick={() => setMode('researcher')}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-full ${
                !isCitizen
                  ? 'bg-blue-500 text-white'
                  : theme === 'light'
                    ? 'bg-gray-100 text-blue-600'
                    : 'bg-gray-700 text-blue-400'
              }`}
            >
              <Microscope size={20} />
            </div>
            <div className="flex-1">
              <h3
                className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-gray-100'}`}
              >
                Researcher
              </h3>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Advanced tools and detailed data access for scientific research
              </p>
            </div>
            <div
              className={`w-4 h-4 rounded-full border-2 ${
                !isCitizen
                  ? 'border-blue-500 bg-blue-500'
                  : theme === 'light'
                    ? 'border-gray-300'
                    : 'border-gray-600'
              }`}
            >
              {!isCitizen && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    // Compact version for mobile
    return (
      <div
        className={`flex items-center rounded-full p-1 border ${
          theme === 'light' ? 'bg-gray-100/60 border-gray-200' : 'bg-gray-800/60 border-white/10'
        }`}
      >
        <button
          onClick={() => setMode('citizen')}
          className={`p-2 rounded-full text-xs font-medium transition-all ${
            isCitizen
              ? 'bg-green-500/80 text-white shadow-md'
              : `${theme === 'light' ? 'text-gray-600 hover:text-green-600' : 'text-gray-300 hover:text-green-400'}`
          }`}
          title="Citizen Mode"
        >
          <Leaf size={16} />
        </button>
        <button
          onClick={() => setMode('researcher')}
          className={`p-2 rounded-full text-xs font-medium transition-all ${
            !isCitizen
              ? 'bg-blue-500/80 text-white shadow-md'
              : `${theme === 'light' ? 'text-gray-600 hover:text-blue-600' : 'text-gray-300 hover:text-blue-400'}`
          }`}
          title="Researcher Mode"
        >
          <Microscope size={16} />
        </button>
      </div>
    );
  }

  // Default version for desktop
  return (
    <div
      className={`flex items-center space-x-1 rounded-full p-1 border ${
        theme === 'light' ? 'bg-gray-100/60 border-gray-200' : 'bg-gray-800/60 border-white/10'
      }`}
    >
      <button
        onClick={() => setMode('citizen')}
        className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-1 ${
          isCitizen
            ? 'bg-green-500/80 text-white shadow-md'
            : `${theme === 'light' ? 'text-gray-600 hover:text-green-600' : 'text-gray-300 hover:text-green-400'}`
        }`}
      >
        <Leaf size={16} />
        {showLabels && <span>Citizen</span>}
      </button>
      <button
        onClick={() => setMode('researcher')}
        className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-1 ${
          !isCitizen
            ? 'bg-blue-500/80 text-white shadow-md'
            : `${theme === 'light' ? 'text-gray-600 hover:text-blue-600' : 'text-gray-300 hover:text-blue-400'}`
        }`}
      >
        <Microscope size={16} />
        {showLabels && <span>Researcher</span>}
      </button>
    </div>
  );
}

export default ModeSelector;
