'use client';

import { MapPin, Eye, TrendUp } from '@phosphor-icons/react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

// Mock data for the demo
const mockOccurrences = [
  {
    id: 1,
    species: 'Rosa canina',
    lat: 51.5074,
    lng: -0.1278,
    country: 'United Kingdom',
    count: 45,
  },
  { id: 2, species: 'Quercus robur', lat: 48.8566, lng: 2.3522, country: 'France', count: 78 },
  {
    id: 3,
    species: 'Helianthus annuus',
    lat: 40.7128,
    lng: -74.006,
    country: 'United States',
    count: 32,
  },
  { id: 4, species: 'Betula pendula', lat: 59.9139, lng: 10.7522, country: 'Norway', count: 23 },
  {
    id: 5,
    species: 'Acer pseudoplatanus',
    lat: 46.2044,
    lng: 6.1432,
    country: 'Switzerland',
    count: 56,
  },
];

interface InteractiveMapDemoProps {
  className?: string;
}

export default function InteractiveMapDemo({ className = '' }: InteractiveMapDemoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-rotate through locations
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % mockOccurrences.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentOccurrence = mockOccurrences[currentIndex];
  const totalOccurrences = mockOccurrences.reduce((sum, occ) => sum + occ.count, 0);

  return (
    <div
      className={`relative bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Live Map Preview
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Interactive species occurrence visualization
          </p>
        </div>
        <Link
          href="/maps"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Eye className="w-4 h-4" />
          View Full Map
        </Link>
      </div>

      {/* Mock Map Visualization */}
      <div className="relative h-48 bg-blue-100 dark:bg-gray-800 rounded-lg mb-4 overflow-hidden">
        {/* World Map Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg viewBox="0 0 400 200" className="w-full h-full">
            <path
              d="M50,50 Q100,30 150,50 T250,50 T350,50"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-blue-600"
            />
            <path
              d="M30,80 Q80,60 130,80 T230,80 T330,80"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-green-600"
            />
            <path
              d="M70,120 Q120,100 170,120 T270,120 T370,120"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-blue-600"
            />
          </svg>
        </div>

        {/* Animated Location Markers */}
        {mockOccurrences.map((occurrence, index) => {
          const isActive = index === currentIndex;
          const x = 50 + index * 60 + index * 10;
          const y = 60 + (index % 2) * 40;

          return (
            <div
              key={occurrence.id}
              className={`absolute transition-all duration-500 ${
                isActive ? 'scale-125 z-10' : 'scale-100 z-0'
              }`}
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-300 ${
                  isActive ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              />
              {isActive && (
                <div className="absolute -top-8 -left-8 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-lg text-xs font-medium whitespace-nowrap border">
                  {occurrence.species}
                </div>
              )}
            </div>
          );
        })}

        {/* Heatmap Effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-16 h-16 rounded-full transition-all duration-1000 ${
                isAnimating ? 'opacity-0' : 'opacity-30'
              }`}
              style={{
                left: `${20 + i * 40}px`,
                top: `${30 + (i % 3) * 30}px`,
                background: `radial-gradient(circle, ${
                  i % 2 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'
                } 0%, transparent 70%)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Current Location Info */}
      <div className={`transition-all duration-300 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {currentOccurrence.species}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              📍 {currentOccurrence.country}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <TrendUp className="w-4 h-4" />
              <span className="font-semibold">{currentOccurrence.count}</span>
            </div>
            <p className="text-xs text-gray-500">occurrences</p>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span>🌍 {mockOccurrences.length} locations</span>
          <span>📊 {totalOccurrences} total occurrences</span>
        </div>
        <div className="flex gap-1">
          {mockOccurrences.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Pulsing indicator */}
      <div className="absolute top-2 right-2">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
