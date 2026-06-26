'use client';

import { ArrowLeft, ArrowRight, Microscope } from '@phosphor-icons/react';
import Link from 'next/link';

import { getBackgroundGradient, getTextColors, useMode } from '../../../context/ModeContext';

const tools = [
  {
    title: 'Explore Map Search',
    description:
      'Search plant occurrences with natural language, then refine results by map viewport, filters, and density layers.',
    href: '/explore',
    cta: 'Open Explore',
  },
  {
    title: 'Taxonomy Learning Module',
    description:
      'Practice classification logic with guided sections on hierarchy, naming conventions, and identification keys.',
    href: '/education/taxonomy',
    cta: 'Open Taxonomy 101',
  },
  {
    title: 'GBIF Data Module',
    description:
      'Understand how biodiversity records are structured and how to interpret quality, provenance, and metadata.',
    href: '/education/gbif-data',
    cta: 'Open GBIF Module',
  },
];

export default function InteractiveToolsPage() {
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

  const innerCardBg =
    theme === 'light' ? 'bg-gray-50/80 border-gray-200/40' : 'bg-gray-900/70 border-gray-700/30';

  const innerCardBorder =
    theme === 'light'
      ? mode === 'citizen'
        ? 'border-green-200/60'
        : 'border-blue-200/60'
      : mode === 'citizen'
        ? 'border-green-700/30'
        : 'border-blue-700/30';

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
            <Microscope className={`w-12 h-12 ${accentColorClass} mr-4`} />
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Interactive Tools</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto`}>
            Practical resources to learn by doing. Use these tools to move from concepts to real
            exploration workflows.
          </p>
        </div>

        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <Link href={tool.href} key={tool.title}>
                <div
                  className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder} h-full hover:scale-[1.02] transition-all duration-300 group cursor-pointer`}
                >
                  <h2 className={`text-xl font-semibold ${textColors.primary} mb-3`}>{tool.title}</h2>
                  <p className={`${textColors.secondary} mb-4`}>{tool.description}</p>
                  <div
                    className={`inline-flex items-center text-sm font-medium ${accentColorClass} group-hover:translate-x-1 transition-transform duration-300`}
                  >
                    {tool.cta}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
