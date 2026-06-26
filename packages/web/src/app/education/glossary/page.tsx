'use client';

import { ArrowLeft, BookOpen } from '@phosphor-icons/react';
import Link from 'next/link';

import { getBackgroundGradient, getTextColors, useMode } from '../../../context/ModeContext';

const glossaryTerms = [
  {
    term: 'Taxon',
    definition: 'Any named unit in biological classification, such as family, genus, or species.',
  },
  {
    term: 'Binomial Nomenclature',
    definition: 'The two-part scientific naming system for species: Genus + species epithet.',
  },
  {
    term: 'Occurrence Record',
    definition:
      'A documented observation or specimen of an organism at a specific place and time.',
  },
  {
    term: 'Endemic Species',
    definition: 'A species that is native to and restricted to a specific geographic area.',
  },
  {
    term: 'Sampling Bias',
    definition:
      'A distortion in data caused by uneven collection effort across locations, seasons, or taxa.',
  },
  {
    term: 'Georeferencing',
    definition:
      'The process of assigning geographic coordinates to biological observations or specimen records.',
  },
];

export default function GlossaryPage() {
  const { mode, theme } = useMode();
  const textColors = getTextColors(theme);

  const accentColorClass =
    theme === 'light'
      ? mode === 'citizen'
        ? 'text-green-600'
        : 'text-blue-600'
      : mode === 'citizen'
        ? 'text-green-500'
        : 'text-blue-500';

  const sectionBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const rowBorder = theme === 'light' ? 'border-gray-200/60' : 'border-gray-700/50';

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center mb-12">
          <Link
            href="/education"
            className={`inline-flex items-center ${accentColorClass} hover:underline mb-4`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Education Hub
          </Link>
          <div className="flex items-center justify-center mb-6">
            <BookOpen className={`w-12 h-12 ${accentColorClass} mr-4`} />
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Glossary</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto`}>
            Core terms used across taxonomy, biodiversity informatics, and plant occurrence analysis.
          </p>
        </div>

        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md`}>
          <div className="space-y-6">
            {glossaryTerms.map((item) => (
              <div key={item.term} className={`pb-5 border-b last:border-b-0 ${rowBorder}`}>
                <h2 className={`text-xl font-semibold ${accentColorClass} mb-2`}>{item.term}</h2>
                <p className={`${textColors.secondary}`}>{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
