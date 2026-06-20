'use client';

import { Leaf, Globe, Microscope, Database, GithubLogo } from '@phosphor-icons/react';
import Link from 'next/link';
import React from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../context/ModeContext';

export default function AboutPage() {
  const { mode, theme } = useMode();
  const isCitizen = mode === 'citizen';
  const textColors = getTextColors(theme);

  const accentColorClass =
    theme === 'light'
      ? isCitizen ? 'text-green-600' : 'text-blue-600'
      : isCitizen ? 'text-green-500' : 'text-blue-500';

  const sectionBg = theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';
  const innerCardBg = theme === 'light' ? 'bg-gray-50/80 border-gray-200/40' : 'bg-gray-900/70 border-gray-700/30';
  const innerCardBorder =
    theme === 'light'
      ? isCitizen ? 'border-green-200/60' : 'border-blue-200/60'
      : isCitizen ? 'border-green-700/30' : 'border-blue-700/30';

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${textColors.primary} mb-2 flex items-center justify-center gap-3`}>
            <Leaf size={32} className={accentColorClass} />
            About Faces of Plants
          </h1>
          <p className={`text-sm ${textColors.secondary}`}>
            An open-source platform for biodiversity exploration powered by GBIF.
          </p>
        </div>

        <div className="space-y-6">
          {/* Mission */}
          <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
            <h2 className={`text-lg font-semibold ${accentColorClass} mb-3 flex items-center gap-2`}>
              <Globe size={20} /> Mission
            </h2>
            <p className={`text-sm ${textColors.secondary} leading-relaxed`}>
              Faces of Plants makes global biodiversity data accessible to everyone through
              AI-powered natural language search and interactive mapping. Our goal is to bridge
              the gap between scientific databases and the public, enabling citizen scientists,
              educators, and researchers to explore plant distribution data intuitively.
            </p>
          </div>

          {/* GBIF Integration */}
          <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
            <h2 className={`text-lg font-semibold ${accentColorClass} mb-3 flex items-center gap-2`}>
              <Database size={20} /> GBIF Data Integration
            </h2>
            <div className={`text-sm ${textColors.secondary} leading-relaxed space-y-3`}>
              <p>
                Faces of Plants is powered by{' '}
                <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className={`${accentColorClass} underline`}>
                  GBIF — the Global Biodiversity Information Facility
                </a>.
                All occurrence data displayed on our maps and search results comes directly from
                GBIF&apos;s public API (<code className={`${innerCardBg} px-1.5 py-0.5 rounded text-xs`}>api.gbif.org/v1</code>).
              </p>
              <p>
                We query GBIF&apos;s occurrence search endpoint to retrieve georeferenced plant
                observations from thousands of participating institutions worldwide. This data
                powers our interactive atlas, species distribution maps, and temporal analysis tools.
              </p>
              <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
                <h4 className={`font-medium ${textColors.primary} mb-2`}>How we use GBIF data:</h4>
                <ul className={`space-y-1.5 ${textColors.secondary}`}>
                  <li>• <strong>Interactive Map:</strong> Real-time occurrence search with clustering, heatmap, and temporal filtering</li>
                  <li>• <strong>Natural Language Query:</strong> AI converts plain-language questions into structured GBIF API calls</li>
                  <li>• <strong>Species Lookup:</strong> Direct species information from GBIF&apos;s species API</li>
                  <li>• <strong>Multi-source Enrichment:</strong> GBIF data combined with iNaturalist and EOL for richer context</li>
                  <li>• <strong>Caching:</strong> DynamoDB-backed cache to reduce API load and improve response times</li>
                </ul>
              </div>
              <p>
                All occurrence data is attributed to its original sources as required by GBIF&apos;s
                data usage policy. Each data point retains references to the contributing institution
                and the underlying dataset.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
            <h2 className={`text-lg font-semibold ${accentColorClass} mb-3 flex items-center gap-2`}>
              <Microscope size={20} /> Features
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
                <h4 className={`text-sm font-medium ${textColors.primary} mb-1`}>Global Botanical Atlas</h4>
                <p className={`text-xs ${textColors.secondary}`}>
                  Explore plant distribution worldwide with interactive maps powered by GBIF occurrence data.
                </p>
              </div>
              <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
                <h4 className={`text-sm font-medium ${textColors.primary} mb-1`}>Natural Language Search</h4>
                <p className={`text-xs ${textColors.secondary}`}>
                  Ask questions in plain language — our AI converts them to structured database queries.
                </p>
              </div>
              <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
                <h4 className={`text-sm font-medium ${textColors.primary} mb-1`}>Temporal Analysis</h4>
                <p className={`text-xs ${textColors.secondary}`}>
                  Analyze how species distributions change over time with date-range filtering.
                </p>
              </div>
              <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
                <h4 className={`text-sm font-medium ${textColors.primary} mb-1`}>Multi-source Enrichment</h4>
                <p className={`text-xs ${textColors.secondary}`}>
                  Data enriched from GBIF, iNaturalist, and Encyclopedia of Life.
                </p>
              </div>
            </div>
          </div>

          {/* Open Source */}
          <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
            <h2 className={`text-lg font-semibold ${accentColorClass} mb-3 flex items-center gap-2`}>
              <GithubLogo size={20} /> Open Source
            </h2>
            <p className={`text-sm ${textColors.secondary} leading-relaxed mb-3`}>
              Faces of Plants is open-source software released under the MIT License.
              We believe open science requires open tools. The full source code is available
              on GitHub.
            </p>
            <a
              href="https://github.com/giuseppeserrecchia/faces-of-plants-1"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-white text-gray-900 hover:bg-gray-200'
              }`}
            >
              <GithubLogo size={16} />
              View on GitHub
            </a>
          </div>

          {/* GBIF Citation */}
          <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
            <h2 className={`text-lg font-semibold ${accentColorClass} mb-3`}>Data Citation</h2>
            <p className={`text-sm ${textColors.secondary} leading-relaxed mb-3`}>
              When using data from Faces of Plants in publications, please cite the original
              GBIF datasets. Data accessed through this platform is subject to the
              {' '}<a href="https://www.gbif.org/terms" target="_blank" rel="noopener noreferrer" className={`${accentColorClass} underline`}>GBIF data usage policy</a>.
            </p>
            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder} text-xs ${textColors.secondary}`}>
              <p>GBIF.org (2026) GBIF Occurrence Download. Available at: https://www.gbif.org</p>
            </div>
          </div>

          {/* Credits */}
          <div className={`text-center py-4`}>
            <p className={`text-xs ${textColors.secondary}`}>
              Built with ❤️ for biodiversity research and education.
            </p>
            <p className={`text-xs ${textColors.secondary} mt-1`}>
              Data provided by{' '}
              <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className={`${accentColorClass} underline`}>GBIF.org</a>
              {' '}under a{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className={`${accentColorClass} underline`}>CC BY 4.0</a> license.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
