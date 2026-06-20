'use client';

import React from 'react';

interface BackgroundMapProps {
  className?: string;
}

// Sample data points for the background map
const sampleDataPoints = [
  { id: 1, lat: 25, lng: 20, species: 'Quercus robur', color: 'bg-green-500' },
  { id: 2, lat: 35, lng: 35, species: 'Rosa canina', color: 'bg-red-500' },
  { id: 3, lat: 65, lng: 50, species: 'Betula pendula', color: 'bg-yellow-500' },
  { id: 4, lat: 45, lng: 75, species: 'Acer pseudoplatanus', color: 'bg-orange-500' },
  { id: 5, lat: 30, lng: 85, species: 'Helianthus annuus', color: 'bg-blue-500' },
  { id: 6, lat: 60, lng: 25, species: 'Pinus sylvestris', color: 'bg-purple-500' },
  { id: 7, lat: 40, lng: 60, species: 'Fagus sylvatica', color: 'bg-pink-500' },
  { id: 8, lat: 15, lng: 40, species: 'Juniperus communis', color: 'bg-teal-500' },
];

export default function BackgroundMap({ className = '' }: BackgroundMapProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* World Map Background - More detailed SVG representation */}
      <svg
        viewBox="0 0 100 60"
        className="w-full h-full opacity-60 dark:opacity-40"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines for geographic reference */}
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.2"
              opacity="0.3"
            />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect
          width="100"
          height="60"
          fill="url(#grid)"
          className="text-gray-300 dark:text-gray-700"
        />

        {/* Continent shapes - more detailed and recognizable */}
        {/* North America */}
        <path
          d="M 8 18 Q 12 14 18 16 Q 22 12 28 18 L 32 25 Q 28 28 24 26 L 20 30 Q 16 28 14 25 L 10 28 Q 6 24 8 18 Z"
          fill="currentColor"
          className="text-emerald-200 dark:text-emerald-800"
          opacity="0.7"
        />

        {/* South America */}
        <path
          d="M 22 32 Q 26 30 28 35 L 30 45 Q 28 50 24 48 L 22 52 Q 18 50 20 45 L 18 40 Q 20 35 22 32 Z"
          fill="currentColor"
          className="text-green-200 dark:text-green-800"
          opacity="0.7"
        />

        {/* Europe */}
        <path
          d="M 42 15 Q 48 12 52 16 L 56 20 Q 54 24 50 22 L 46 25 Q 42 22 42 15 Z"
          fill="currentColor"
          className="text-blue-200 dark:text-blue-800"
          opacity="0.7"
        />

        {/* Africa */}
        <path
          d="M 44 25 Q 48 23 52 27 L 54 35 Q 56 42 52 45 L 48 48 Q 44 45 46 40 L 44 35 Q 42 30 44 25 Z"
          fill="currentColor"
          className="text-yellow-200 dark:text-yellow-800"
          opacity="0.7"
        />

        {/* Asia */}
        <path
          d="M 58 12 Q 68 10 78 16 L 85 20 Q 88 25 82 28 L 78 32 Q 72 30 68 25 L 62 22 Q 58 18 58 12 Z"
          fill="currentColor"
          className="text-purple-200 dark:text-purple-800"
          opacity="0.7"
        />

        {/* Australia */}
        <path
          d="M 72 42 Q 78 40 84 44 L 88 48 Q 84 52 78 50 L 72 48 Q 70 45 72 42 Z"
          fill="currentColor"
          className="text-orange-200 dark:text-orange-800"
          opacity="0.7"
        />

        {/* Latitude lines */}
        <line
          x1="0"
          y1="15"
          x2="100"
          y2="15"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />
        <line
          x1="0"
          y1="30"
          x2="100"
          y2="30"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />
        <line
          x1="0"
          y1="45"
          x2="100"
          y2="45"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />

        {/* Longitude lines */}
        <line
          x1="25"
          y1="0"
          x2="25"
          y2="60"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="60"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />
        <line
          x1="75"
          y1="0"
          x2="75"
          y2="60"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.4"
          className="text-gray-400 dark:text-gray-600"
        />
      </svg>

      {/* Data Points */}
      <div className="absolute inset-0">
        {sampleDataPoints.map((point, index) => (
          <div
            key={point.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
            style={{
              left: `${point.lng}%`,
              top: `${point.lat}%`,
              animationDelay: `${index * 0.4}s`,
              animationDuration: '3s',
            }}
          >
            <div className={`w-4 h-4 ${point.color} rounded-full shadow-lg opacity-90`}>
              <div
                className={`w-4 h-4 ${point.color} rounded-full animate-ping absolute opacity-75`}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 dark:to-white/5 pointer-events-none"></div>
    </div>
  );
}
