'use client';

import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';

import { getBackgroundGradient, getTextColors, useMode } from '../../../context/ModeContext';

const tutorialTracks = [
  {
    title: 'How to Run a Geographic Plant Search',
    summary: 'Build queries, apply viewport filters, and interpret map-level results.',
    href: '/explore',
  },
  {
    title: 'How to Read Taxonomy Results',
    summary: 'Understand accepted names, rank hierarchy, and species matching behavior.',
    href: '/education/taxonomy',
  },
  {
    title: 'How to Validate Biodiversity Data Quality',
    summary: 'Identify quality flags, coordinate anomalies, and source-level limitations.',
    href: '/education/gbif-data',
  },
];

export default function VideoTutorialPage() {
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
            <span className="text-5xl mr-4">🎥</span>
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Video Tutorial</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto`}>
            Guided learning tracks for practical workflows. Start from any topic and move step by
            step into hands-on exploration.
          </p>
        </div>

        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md`}>
          <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder} mb-8`}>
            <h2 className={`text-2xl font-semibold ${textColors.primary} mb-4`}>Featured Demo Video</h2>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-300/40 bg-black">
              <video
                className="w-full h-full"
                controls
                preload="metadata"
                src="/videofacesofplants.mp4"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <p className={`text-sm ${textColors.secondary} mt-3`}>
              This video is loaded from <code>/public/videofacesofplants.mp4</code>.
            </p>
          </div>

          <div className="space-y-5 mb-8">
            {tutorialTracks.map((track) => (
              <Link href={track.href} key={track.title}>
                <div
                  className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder} hover:scale-[1.01] transition-all duration-300 group cursor-pointer`}
                >
                  <h2 className={`text-xl font-semibold ${textColors.primary} mb-2`}>{track.title}</h2>
                  <p className={`${textColors.secondary} mb-3`}>{track.summary}</p>
                  <div
                    className={`inline-flex items-center text-sm font-medium ${accentColorClass} group-hover:translate-x-1 transition-transform duration-300`}
                  >
                    Open related learning module
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className={`text-sm ${textColors.secondary}`}>
            New embedded video lessons will be published progressively. This page already provides a
            structured path to the related educational material.
          </p>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
