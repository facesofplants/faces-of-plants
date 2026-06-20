'use client';

import {
  MagnifyingGlass,
  Leaf,
  Users,
  Database,
  Globe,
  BookOpen,
  Lightning,
  Microscope,
  MapPin,
  Calendar,
  ArrowRight,
} from '@phosphor-icons/react';
import Link from 'next/link';
import React, { useState } from 'react';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';

import { useMode, getBackgroundGradient, getTextColors } from '../context/ModeContext';


import BackgroundMap from './BackgroundMap';

const FacesOfPlantsLanding = () => {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);

  // Mode-aware accent colors
  const accentColorClass =
    theme === 'light'
      ? mode === 'citizen'
        ? 'text-green-600'
        : 'text-blue-600'
      : mode === 'citizen'
        ? 'text-green-500'
        : 'text-blue-500';

  // Card backgrounds for different themes
  const searchCardBg = theme === 'light' ? 'bg-white/80' : 'bg-gray-900/80';

  const resultCardBg =
    theme === 'light' ? 'bg-white/80 border-white/40' : 'bg-gray-900/80 border-gray-700/40';

  const exampleQueryBg =
    theme === 'light'
      ? 'bg-white/60 border-white/30 hover:bg-white/80'
      : 'bg-gray-800/60 border-gray-700/30 hover:bg-gray-800/80';

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GBIFOccurrence[]>([]);

  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {return;}

    setIsLoading(true);
    setResults([]);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          userType: mode,
          filters: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const gbifData = data?.result?.data;

      if (gbifData && Array.isArray(gbifData.results)) {
        setResults(gbifData.results.slice(0, 5));
      } else {
        throw new Error("Invalid data structure from API: Expected 'results' array.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = {
    citizen: [
      'Show me colorful flowers in my area',
      'What plants bloom in spring?',
      'Trees with red leaves in autumn',
      'Medicinal plants in rainforests',
    ],
    researcher: [
      'Quercus species distribution in North America 2020-2024',
      'Endemic flora of Madagascar with coordinates',
      'Climate change impact on alpine vegetation',
      'Invasive species spread patterns Europe',
    ],
  };

  const features = [
    {
      icon: <MagnifyingGlass className="w-6 h-6" />,
      title: 'Natural Language Search',
      description: 'Ask questions about plants in plain English and get precise scientific data.',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Global Coverage',
      description: 'Access millions of plant observations from around the world through GBIF.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Dual Interface',
      description: 'Tailored experiences for both curious citizens and professional researchers.',
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: 'Educational Content',
      description: 'Learn about biodiversity with context-rich explanations and visualizations.',
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: 'Research Tools',
      description: 'Advanced filtering, data export, and analysis tools for scientific research.',
    },
    {
      icon: <Lightning className="w-6 h-6" />,
      title: 'AI-Powered',
      description: 'Smart query interpretation and personalized recommendations.',
    },
  ];

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      {/* Header */}
      {/*
      <header className="backdrop-blur-sm bg-white/80 border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Leaf className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Faces of Plants
                </h1>
                <p className="text-sm text-gray-600">Powered by GBIF</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-full p-1 border border-white/30">
              <button
                onClick={() => setSearchState(prev => ({ ...prev, userType: 'citizen' }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  searchState.userType === 'citizen'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                <Leaf className="w-4 h-4 mr-1" /> Citizen
              </button>
              <button
                onClick={() => setSearchState(prev => ({ ...prev, userType: 'researcher' }))}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  searchState.userType === 'researcher'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Microscope className="w-4 h-4 mr-1" /> Researcher
              </button>
            </div>
          </div>
        </div>
      </header>
      */}

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className={`text-5xl font-bold ${textColors.primary} mb-6`}>
            Discover the World&apos;s
            <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              {' '}
              Plant Diversity
            </span>
          </h2>
          <p className={`text-xl ${textColors.secondary} max-w-3xl mx-auto mb-8`}>
            Explore millions of plant observations from around the globe using natural language.
            Whether you&apos;re a curious citizen or a professional researcher, unlock the secrets
            of biodiversity with AI-powered search.
          </p>
        </div>

        {/* Search Interface */}
        <div className="max-w-4xl mx-auto mb-16">
          {/* Example Queries - Moved above search field */}
          <div className="mb-6">
            <div className="mb-3 w-full flex justify-center">
              <div className="flex items-center gap-4 w-full max-w-2xl" style={{ width: '100%' }}>
                <span
                  className="flex items-center text-sm font-medium whitespace-nowrap"
                  style={{ minWidth: 120 }}
                >
                  {mode === 'citizen' ? (
                    <>
                      <Leaf className="w-4 h-4 mr-1" />
                      Try asking:
                    </>
                  ) : (
                    <>
                      <Microscope className="w-4 h-4 mr-1" />
                      Example queries:
                    </>
                  )}
                </span>
                <div className="relative flex-1" style={{ minWidth: 0 }}>
                  <div
                    className="flex gap-2 overflow-x-auto no-scrollbar pr-8 w-full"
                    style={{
                      scrollBehavior: 'smooth',
                      WebkitOverflowScrolling: 'touch',
                      minHeight: 40,
                    }}
                    id="example-queries-scroll"
                  >
                    {exampleQueries[mode].map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(example)}
                        className={`text-sm ${exampleQueryBg} backdrop-blur-sm border rounded-full px-4 py-2 ${textColors.primary} transition-all duration-200 whitespace-nowrap`}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                  {/* Fade effect right */}
                  <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white/80 dark:from-gray-900/80 to-transparent" />
                  {/* Scroll right arrow */}
                  <button
                    type="button"
                    aria-label="Scroll right"
                    className="absolute top-1/2 right-0 -translate-y-1/2 z-10 bg-white dark:bg-gray-900 rounded-full shadow border border-gray-300 dark:border-gray-700 p-1 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    style={{ width: 32, height: 32 }}
                    onClick={() => {
                      const el = document.getElementById('example-queries-scroll');
                      if (el) {el.scrollBy({ left: 120, behavior: 'smooth' });}
                    }}
                  >
                    <ArrowRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => handleSearch(e)} className="relative">
            <div
              className={`backdrop-blur-sm ${searchCardBg} rounded-2xl border ${theme === 'light' ? 'border-white/30' : 'border-gray-700/30'} shadow-xl p-6`}
            >
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      mode === 'citizen'
                        ? "Ask about plants... e.g., 'Show me colorful flowers in my area'"
                        : "Research query... e.g., 'Endemic flora of Madagascar with coordinates'"
                    }
                    className={`w-full bg-transparent border-none outline-none text-lg ${theme === 'light' ? 'placeholder-gray-500 text-black' : 'placeholder-gray-400 text-white'}`}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className={`${theme === 'light' ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600' : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700'} text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <MagnifyingGlass className="w-4 h-4" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div
              className={`mt-4 ${theme === 'light' ? 'text-red-600 bg-red-100' : 'text-red-400 bg-red-900/30'} p-4 rounded-lg`}
            >
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Results Display */}
          {results.length > 0 && (
            <div className="mt-8">
              <h4 className={`text-lg font-semibold mb-4 ${textColors.primary}`}>Top Results</h4>
              <div className="space-y-4">
                {results.map((item, idx) => (
                  <div
                    key={item.key || idx}
                    className={`${resultCardBg} rounded-xl p-6 border shadow-lg hover:shadow-xl transition-all duration-200`}
                  >
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Left side - Main info */}
                      <div className="flex-1">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-3 mb-3">
                          <div className="flex-1">
                            <h5 className={`font-bold ${accentColorClass} text-lg mb-1`}>
                              {item.scientificName || 'Unknown species'}
                            </h5>
                            {item.vernacularName && (
                              <p className={`${textColors.primary} font-medium mb-1`}>
                                Common name: {item.vernacularName}
                              </p>
                            )}
                            <div className={`text-sm ${textColors.secondary} mb-2`}>
                              <span className="font-medium">Taxonomy:</span>{' '}
                              {[item.family, item.genus].filter(Boolean).join(' → ')}
                            </div>
                          </div>

                          {/* GBIF key and links */}
                          <div className="flex flex-col lg:items-end gap-2">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`https://www.gbif.org/occurrence/${item.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${theme === 'light' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'} px-3 py-1 rounded-full text-xs font-medium transition-colors`}
                              >
                                GBIF Record
                              </a>
                              {item.taxonKey && (
                                <a
                                  href={`https://www.gbif.org/species/${item.taxonKey}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${theme === 'light' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'} px-3 py-1 rounded-full text-xs font-medium transition-colors`}
                                >
                                  Species Info
                                </a>
                              )}
                              {item.scientificName && (
                                <a
                                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(`${item.scientificName.split(' ')[0]  } ${  item.scientificName.split(' ')[1] || ''}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${theme === 'light' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'} px-3 py-1 rounded-full text-xs font-medium transition-colors`}
                                >
                                  Wikipedia
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Location and date info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div
                              className={`font-medium ${textColors.primary} mb-1 flex items-center`}
                            >
                              <MapPin className="w-4 h-4 mr-1" /> Location
                            </div>
                            <div className={textColors.secondary}>
                              <div>{item.country || 'Unknown country'}</div>
                              {item.stateProvince && <div>{item.stateProvince}</div>}
                              {item.locality && <div className="text-xs">{item.locality}</div>}
                              {item.decimalLatitude && item.decimalLongitude && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.decimalLatitude},${item.decimalLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${theme === 'light' ? 'text-blue-600' : 'text-blue-400'} underline text-xs mt-1 inline-block`}
                                >
                                  View on map ({item.decimalLatitude.toFixed(4)},{' '}
                                  {item.decimalLongitude.toFixed(4)})
                                </a>
                              )}
                            </div>
                          </div>

                          <div>
                            <div
                              className={`font-medium ${textColors.primary} mb-1 flex items-center`}
                            >
                              <Calendar className="w-4 h-4 mr-1" /> Collection Info
                            </div>
                            <div className={textColors.secondary}>
                              {item.eventDate && <div>Date: {item.eventDate}</div>}
                              {item.recordedBy && <div>Recorded by: {item.recordedBy}</div>}
                              {item.basisOfRecord && (
                                <div>Type: {item.basisOfRecord.replace(/_/g, ' ')}</div>
                              )}
                              {item.institutionCode && (
                                <div className="text-xs">Institution: {item.institutionCode}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Additional metadata for researchers */}
                        {mode === 'researcher' && (
                          <div
                            className={`mt-4 pt-3 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-600'}`}
                          >
                            <div
                              className={`grid grid-cols-1 md:grid-cols-3 gap-4 text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}
                            >
                              {item.catalogNumber && (
                                <div>
                                  <span className="font-medium">Catalog:</span> {item.catalogNumber}
                                </div>
                              )}
                              {item.datasetName && (
                                <div>
                                  <span className="font-medium">Dataset:</span> {item.datasetName}
                                </div>
                              )}
                              {item.license && (
                                <div>
                                  <span className="font-medium">License:</span> {item.license}
                                </div>
                              )}
                              {item.coordinateUncertaintyInMeters && (
                                <div>
                                  <span className="font-medium">Coord. uncertainty:</span>{' '}
                                  {item.coordinateUncertaintyInMeters}m
                                </div>
                              )}
                              {item.elevation && (
                                <div>
                                  <span className="font-medium">Elevation:</span> {item.elevation}m
                                </div>
                              )}
                              {item.individualCount && (
                                <div>
                                  <span className="font-medium">Count:</span> {item.individualCount}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Map Preview */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h3 className={`text-3xl font-bold ${textColors.primary} mb-4`}>
              Explore with Our Interactive Map
            </h3>
            <p className={`text-lg ${textColors.secondary} max-w-2xl mx-auto`}>
              Visualize biodiversity data with advanced clustering, heatmaps, and temporal
              filtering. See where species occur around the world and discover patterns in
              real-time.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div
              className={`relative bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700`}
            >
              {/* Interactive Map Preview with Background */}
              <div className="relative h-64 bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 rounded-lg mb-6 overflow-hidden">
                {/* Background Map */}
                <BackgroundMap className="absolute inset-0 w-full h-full" />

                {/* Overlay Content */}
                <div className="absolute inset-0 bg-black/5 dark:bg-black/10 flex items-center justify-center">
                  <div className="text-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-lg p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
                    <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <h4 className={`text-lg font-bold ${textColors.primary} mb-2`}>
                      Interactive Species Map
                    </h4>
                    <p className={`${textColors.secondary} text-sm mb-4`}>
                      Real-time visualization of global plant occurrences
                    </p>
                    <Link
                      href="/maps"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      <Globe className="w-4 h-4" />
                      Launch Interactive Map
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <h5 className={`font-semibold ${textColors.primary} mb-1`}>Clustering</h5>
                  <p className={`text-sm ${textColors.secondary}`}>
                    Smart grouping of nearby occurrences
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Lightning className="w-6 h-6 text-orange-600" />
                  </div>
                  <h5 className={`font-semibold ${textColors.primary} mb-1`}>Heatmaps</h5>
                  <p className={`text-sm ${textColors.secondary}`}>
                    Density visualization for patterns
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                  <h5 className={`font-semibold ${textColors.primary} mb-1`}>Temporal</h5>
                  <p className={`text-sm ${textColors.secondary}`}>
                    Time-based filtering and analysis
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => {
            const isEducational = feature.title === 'Educational Content';

            if (isEducational) {
              return (
                <Link key={index} href="/education">
                  <div
                    className={`backdrop-blur-sm ${theme === 'light' ? 'bg-white/60 border-white/30 hover:bg-white/80' : 'bg-gray-900/60 border-gray-700/30 hover:bg-gray-900/80'} rounded-xl border p-6 transition-all duration-200 cursor-pointer hover:scale-105`}
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <div
                        className={`p-2 ${theme === 'light' ? 'bg-gradient-to-br from-green-100 to-blue-100' : 'bg-gradient-to-br from-green-100 to-blue-100'} rounded-lg`}
                      >
                        {feature.icon}
                      </div>
                      <h3 className={`font-semibold ${textColors.primary}`}>{feature.title}</h3>
                    </div>
                    <p className={`${textColors.secondary} text-sm`}>{feature.description}</p>
                    <div
                      className={`mt-4 text-sm ${accentColorClass} font-medium flex items-center`}
                    >
                      Start Learning →
                    </div>
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={index}
                className={`backdrop-blur-sm ${theme === 'light' ? 'bg-white/60 border-white/30 hover:bg-white/80' : 'bg-gray-900/60 border-gray-700/30 hover:bg-gray-900/80'} rounded-xl border p-6 transition-all duration-200`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div
                    className={`p-2 ${theme === 'light' ? 'bg-gradient-to-br from-green-100 to-blue-100' : 'bg-gradient-to-br from-green-100 to-blue-100'} rounded-lg`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className={`font-semibold ${textColors.primary}`}>{feature.title}</h3>
                </div>
                <p className={`${textColors.secondary} text-sm`}>{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-16">
          <h3 className={`text-2xl font-bold ${textColors.primary} mb-8 text-center`}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link
              href="/maps"
              className={`group ${theme === 'light' ? 'bg-white/70 hover:bg-white/90 border-white/40' : 'bg-gray-900/70 hover:bg-gray-900/90 border-gray-700/40'} rounded-xl p-6 border backdrop-blur-sm transition-all duration-200 hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <MapPin className="w-8 h-8 text-blue-600" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h4 className={`font-bold ${textColors.primary} mb-2`}>Explore Interactive Map</h4>
              <p className={`text-sm ${textColors.secondary}`}>
                Visualize species occurrences with clustering, heatmaps, and temporal filters
              </p>
            </Link>

            <Link
              href="/maps"
              className={`group ${theme === 'light' ? 'bg-white/70 hover:bg-white/90 border-white/40' : 'bg-gray-900/70 hover:bg-gray-900/90 border-gray-700/40'} rounded-xl p-6 border backdrop-blur-sm transition-all duration-200 hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <MagnifyingGlass className="w-8 h-8 text-green-600" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
              <h4 className={`font-bold ${textColors.primary} mb-2`}>Explore Maps</h4>
              <p className={`text-sm ${textColors.secondary}`}>
                Explore species occurrences on the interactive map
              </p>
            </Link>

            <Link
              href="/education"
              className={`group ${theme === 'light' ? 'bg-white/70 hover:bg-white/90 border-white/40' : 'bg-gray-900/70 hover:bg-gray-900/90 border-gray-700/40'} rounded-xl p-6 border backdrop-blur-sm transition-all duration-200 hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <BookOpen className="w-8 h-8 text-purple-600" />
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <h4 className={`font-bold ${textColors.primary} mb-2`}>Learn & Discover</h4>
              <p className={`text-sm ${textColors.secondary}`}>
                Educational resources about biodiversity and plant taxonomy
              </p>
            </Link>
          </div>
        </div>

        {/* CTA Section */}
        <div
          className={`text-center backdrop-blur-sm ${theme === 'light' ? 'bg-white/60 border-white/30' : 'bg-gray-900/60 border-gray-700/30'} rounded-2xl border p-12`}
        >
          <h3 className={`text-3xl font-bold ${textColors.primary} mb-4`}>
            Start Exploring Biodiversity
          </h3>
          <p className={`text-lg ${textColors.secondary} mb-8 max-w-2xl mx-auto`}>
            Join thousands of researchers and nature enthusiasts discovering the incredible
            diversity of plant life on Earth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/maps"
              className={`${theme === 'light' ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'} text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 inline-flex items-center justify-center gap-2`}
            >
              <Leaf className="w-5 h-5" />
              Explore Maps
            </Link>
            <Link
              href="/maps"
              className={`${theme === 'light' ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'} text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 inline-flex items-center justify-center gap-2`}
            >
              <Microscope className="w-5 h-5" />
              Access Research Tools
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FacesOfPlantsLanding;
