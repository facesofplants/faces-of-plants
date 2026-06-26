'use client';

import {
  MagnifyingGlass,
  Leaf,
  Users,
  Database,
  Globe,
  BookOpen,
  Lightning,
  MapPin,
  ArrowRight,
} from '@phosphor-icons/react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useMode, getBackgroundGradient, getTextColors } from '../context/ModeContext';

const DEFAULT_EXAMPLES = [
  'Quercus in Tuscany',
  'Cherry blossoms in Japan',
  'Orchids in Colombia',
  'Betula pendula',
];

const features = [
  {
    icon: <MagnifyingGlass className="w-6 h-6" />,
    title: 'Natural Language Search',
    description: 'Ask in natural language (including multilingual phrases) and get structured biodiversity results.',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Global Coverage',
    description: 'Access millions of plant observations from around the world through GBIF.',
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    title: 'Interactive Map',
    description: 'Visualize species distribution, nearby plants, and ecological corridors.',
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Educational Content',
    description: 'Learn about biodiversity with context-rich explanations and visualizations.',
  },
  {
    icon: <Database className="w-6 h-6" />,
    title: 'Research Tools',
    description: 'Advanced filtering, disease detection, and species distribution modeling.',
  },
  {
    icon: <Lightning className="w-6 h-6" />,
    title: 'AI-Powered',
    description: 'Smart query interpretation and personalized recommendations.',
  },
];

const FacesOfPlantsLanding = () => {
  const { theme } = useMode();
  const router = useRouter();
  const textColors = getTextColors(theme);

  const accentColorClass = theme === 'light' ? 'text-green-600' : 'text-green-500';
  const searchCardBg = theme === 'light' ? 'bg-white/80' : 'bg-gray-900/80';
  const exampleQueryBg =
    theme === 'light'
      ? 'bg-white/60 border-white/30 hover:bg-white/80'
      : 'bg-gray-800/60 border-gray-700/30 hover:bg-gray-800/80';

  const [query, setQuery] = useState('');
  const [exampleQueries, setExampleQueries] = useState<string[]>(DEFAULT_EXAMPLES);

  useEffect(() => {
    fetch('/api/homepage-examples')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.examples) && data.examples.length > 0) {
          setExampleQueries(data.examples);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className={`min-h-screen ${getBackgroundGradient('citizen', theme)}`}>
      {/* Hero Section — Title + Search only */}
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
            Unlock the secrets of biodiversity with AI-powered search.
          </p>
        </div>

        {/* Search Interface */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="mb-6">
            <div className="mb-3 w-full flex justify-center">
              <div className="flex items-center gap-4 w-full max-w-2xl">
                <span className={`flex items-center text-sm font-medium whitespace-nowrap ${textColors.secondary}`} style={{ minWidth: 120 }}>
                  <Leaf className="w-4 h-4 mr-1" />
                  Try asking:
                </span>
                <div className="relative flex-1" style={{ minWidth: 0 }}>
                  <div
                    className="flex gap-2 overflow-x-auto no-scrollbar pr-8 w-full"
                    style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch', minHeight: 40 }}
                    id="example-queries-scroll"
                  >
                    {exampleQueries.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(example)}
                        className={`text-sm ${exampleQueryBg} backdrop-blur-sm border rounded-full px-4 py-2 ${textColors.primary} transition-all duration-200 whitespace-nowrap`}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white/80 dark:from-gray-900/80 to-transparent" />
                  <button
                    type="button"
                    aria-label="Scroll right"
                    className="absolute top-1/2 right-0 -translate-y-1/2 z-10 bg-white dark:bg-gray-900 rounded-full shadow border border-gray-300 dark:border-gray-700 p-1 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    style={{ width: 32, height: 32 }}
                    onClick={() => {
                      const el = document.getElementById('example-queries-scroll');
                      if (el) el.scrollBy({ left: 120, behavior: 'smooth' });
                    }}
                  >
                    <ArrowRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <div className={`backdrop-blur-sm ${searchCardBg} rounded-2xl border ${theme === 'light' ? 'border-white/30' : 'border-gray-700/30'} shadow-xl p-6`}>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask about plants... e.g., 'Pollinator-friendly flowers near me in spring'"
                    className={`w-full bg-transparent border-none outline-none text-lg ${theme === 'light' ? 'placeholder-gray-500 text-black' : 'placeholder-gray-400 text-white'}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    query.trim()
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`backdrop-blur-sm ${searchCardBg} rounded-xl border ${theme === 'light' ? 'border-white/30' : 'border-gray-700/30'} p-6 hover:shadow-lg transition-shadow`}
            >
              <div className={`${accentColorClass} mb-3`}>{feature.icon}</div>
              <h3 className={`text-lg font-semibold ${textColors.primary} mb-2`}>{feature.title}</h3>
              <p className={`text-sm ${textColors.secondary}`}>{feature.description}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/explore"
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-200`}
          >
            <MapPin size={20} />
            Explore the Map
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default FacesOfPlantsLanding;
