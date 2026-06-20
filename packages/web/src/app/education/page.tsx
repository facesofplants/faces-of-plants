'use client';

import {
  BookOpen,
  Microscope,
  Tree,
  Globe,
  Database,
  Users,
  ArrowRight,
  Leaf,
  Target,
  Books,
} from '@phosphor-icons/react';
import Link from 'next/link';
import React from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../context/ModeContext';

export default function EducationPage() {
  const { mode, theme } = useMode();
  const isCitizen = mode === 'citizen';
  const textColors = getTextColors(theme);

  // Mode-aware accent colors
  const accentColorClass =
    theme === 'light'
      ? isCitizen
        ? 'text-green-600'
        : 'text-blue-600'
      : isCitizen
        ? 'text-green-500'
        : 'text-blue-500';

  // Card backgrounds for different themes
  const sectionBg =
    theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';

  const innerCardBg =
    theme === 'light' ? 'bg-gray-50/80 border-gray-200/40' : 'bg-gray-900/70 border-gray-700/30';

  const innerCardBorder =
    theme === 'light'
      ? isCitizen
        ? 'border-green-200/60'
        : 'border-blue-200/60'
      : isCitizen
        ? 'border-green-700/30'
        : 'border-blue-700/30';

  const listTextColor = theme === 'light' ? 'text-gray-700' : 'text-gray-300';

  const educationalModules = [
    {
      id: 'taxonomy',
      title: 'Plant Taxonomy 101',
      icon: <Tree className="w-8 h-8" />,
      description: 'Learn how scientists classify plants from kingdoms to species',
      duration: '15 min read',
      level: 'Beginner',
      topics: [
        'Classification hierarchy',
        'Binomial nomenclature',
        'Plant families',
        'Identification keys',
      ],
      gradient:
        theme === 'light' ? 'from-green-100 to-emerald-200' : 'from-green-900/40 to-emerald-900/40',
    },
    {
      id: 'gbif-data',
      title: 'Understanding GBIF Data',
      icon: <Database className="w-8 h-8" />,
      description: 'Discover how global biodiversity data is collected and organized',
      duration: '12 min read',
      level: 'Intermediate',
      topics: ['Occurrence records', 'Data quality', 'Collection methods', 'Citizen science'],
      gradient: theme === 'light' ? 'from-blue-100 to-cyan-200' : 'from-blue-900/40 to-cyan-900/40',
    },
    {
      id: 'biodiversity',
      title: 'Biodiversity Concepts',
      icon: <Globe className="w-8 h-8" />,
      description: 'Explore the richness and variety of plant life on Earth',
      duration: '18 min read',
      level: 'Intermediate',
      topics: ['Species diversity', 'Ecosystem roles', 'Conservation', 'Endemic species'],
      gradient:
        theme === 'light' ? 'from-purple-100 to-pink-200' : 'from-purple-900/40 to-pink-900/40',
    },
    {
      id: 'research-methods',
      title: 'Plant Research Methods',
      icon: <Microscope className="w-8 h-8" />,
      description: 'Modern techniques for studying and documenting plant species',
      duration: '20 min read',
      level: 'Advanced',
      topics: ['Field collection', 'Digital herbaria', 'DNA barcoding', 'Ecological surveys'],
      gradient:
        theme === 'light' ? 'from-orange-100 to-red-200' : 'from-orange-900/40 to-red-900/40',
    },
  ];

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <BookOpen className={`w-16 h-16 ${accentColorClass} mr-4`} />
            <h1 className={`text-6xl font-bold ${textColors.primary}`}>Educational Hub</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-4xl mx-auto mb-8`}>
            Discover the fascinating world of plant taxonomy, biodiversity data, and scientific
            research. Learn at your own pace with interactive content designed for{' '}
            {mode === 'citizen' ? 'curious nature enthusiasts' : 'researchers and scientists'}.
          </p>
          <div
            className={`inline-flex items-center px-6 py-3 rounded-full ${theme === 'light' ? 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-200' : 'bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700/30'} backdrop-blur-sm`}
          >
            <Leaf className={`w-5 h-5 ${accentColorClass} mr-2`} />
            <span className={`text-sm font-medium ${textColors.primary}`}>
              {educationalModules.length} Learning Modules Available
            </span>
          </div>
        </div>

        {/* Learning Path Overview */}
        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md mb-16`}>
          <h2 className={`text-3xl font-bold ${textColors.primary} mb-6 text-center`}>
            <Target className={`w-6 h-6 ${accentColorClass} mr-3`} />
            Your Learning Journey
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0 md:space-x-8">
            {educationalModules.map((module, index) => (
              <div key={module.id} className="flex items-center">
                <div className={`flex flex-col items-center text-center max-w-xs`}>
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-3 border-2 ${innerCardBorder}`}
                  >
                    <span className={`text-2xl font-bold ${textColors.primary}`}>{index + 1}</span>
                  </div>
                  <h3 className={`font-semibold ${textColors.primary} mb-1`}>{module.title}</h3>
                  <span
                    className={`text-xs ${textColors.secondary} px-2 py-1 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'}`}
                  >
                    {module.level}
                  </span>
                </div>
                {index < educationalModules.length - 1 && (
                  <ArrowRight className={`w-6 h-6 ${textColors.secondary} mx-4 hidden md:block`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Educational Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {educationalModules.map((module) => (
            <Link href={`/education/${module.id}`} key={module.id}>
              <div
                className={`${innerCardBg} rounded-2xl p-8 border ${innerCardBorder} hover:scale-105 transition-all duration-300 cursor-pointer group`}
              >
                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  {module.icon}
                </div>

                <h3 className={`text-2xl font-bold ${textColors.primary} mb-3`}>{module.title}</h3>

                <p className={`${textColors.secondary} mb-4 text-lg`}>{module.description}</p>

                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm ${textColors.secondary} flex items-center`}>
                    <Books className="w-4 h-4 mr-1" /> {module.duration}
                  </span>
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${theme === 'light' ? 'bg-gradient-to-r from-gray-100 to-gray-200' : 'bg-gradient-to-r from-gray-700 to-gray-800'} ${textColors.primary} font-medium`}
                  >
                    {module.level}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className={`text-sm font-semibold ${textColors.primary} mb-2`}>
                    What you&apos;ll learn:
                  </h4>
                  <div className="grid grid-cols-1 gap-1">
                    {module.topics.map((topic, index) => (
                      <div key={index} className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-green-400' : 'bg-green-500'} mr-3`}
                        />
                        <span className={`text-sm ${listTextColor}`}>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`mt-6 flex items-center justify-between text-sm ${accentColorClass} font-medium group-hover:translate-x-2 transition-transform duration-300`}
                >
                  <span>Start Learning</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Access Section */}
        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md`}>
          <h2 className={`text-2xl font-bold ${textColors.primary} mb-6 flex items-center`}>
            <Users className={`w-6 h-6 ${accentColorClass} mr-3`} />
            Quick Access Resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder}`}>
              <h4 className={`font-semibold ${accentColorClass} mb-2 flex items-center`}>
                <Microscope className="w-4 h-4 mr-2" /> Interactive Tools
              </h4>
              <p className={`text-sm ${listTextColor}`}>
                Hands-on tools to explore plant classification and data visualization
              </p>
            </div>
            <div className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder}`}>
              <h4 className={`font-semibold ${accentColorClass} mb-2`}>📖 Glossary</h4>
              <p className={`text-sm ${listTextColor}`}>
                Comprehensive definitions of botanical and data science terms
              </p>
            </div>
            <div className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder}`}>
              <h4 className={`font-semibold ${accentColorClass} mb-2`}>🎥 Video Tutorials</h4>
              <p className={`text-sm ${listTextColor}`}>
                Step-by-step video guides for using research tools and understanding concepts
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
export const dynamic = 'force-dynamic';
