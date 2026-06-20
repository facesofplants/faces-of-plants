'use client';

import {
  Tree,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Info,
  Target,
  CheckCircle,
  Stack,
  Leaf,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import React, { useState, useEffect } from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../../context/ModeContext';
export default function TaxonomyPage() {
  const { mode, theme } = useMode();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recordActivity = (_event: string, _details?: Record<string, unknown>) => {};
  const textColors = getTextColors(theme);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const MODULE_ID = 'taxonomy';

  useEffect(() => {
    const fetchProgress = async () => {
      if (!session) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/education/progress');
        if (response.ok) {
          const progress = await response.json();
          if (progress[MODULE_ID]) {
            const completedIds = Object.keys(progress[MODULE_ID]);
            const completedIndexes = new Set<number>();
            completedIds.forEach((id) => {
              const index = sections.findIndex((s) => s.id === id);
              if (index !== -1) {
                completedIndexes.add(index);
              }
            });
            setCompletedSections(completedIndexes);
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [session]);

  useEffect(() => {
    // Mark the current section as complete as soon as it's viewed
    if (!isLoading) {
      markSectionComplete(currentSection);
    }
  }, [currentSection, isLoading, session]);

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

  const sections = [
    {
      id: 'introduction',
      title: 'What is Plant Taxonomy?',
      content: {
        overview:
          'Plant taxonomy is the science of classifying and naming plants. It helps scientists organize the incredible diversity of plant life on Earth into manageable categories.',
        keyPoints: [
          'Taxonomy creates order from chaos in the plant kingdom',
          'It helps us understand evolutionary relationships',
          'Makes communication between scientists worldwide possible',
          'Essential for conservation and research efforts',
        ],
        example: {
          title: 'Example: Why Names Matter',
          description:
            'A "rose" could refer to hundreds of different species. Scientific naming eliminates confusion.',
          comparison: {
            common: 'Wild Rose',
            scientific: 'Rosa canina',
            why: 'Rosa canina specifically refers to the Dog Rose, distinguishing it from Rosa damascena (Damask Rose) or Rosa gallica (French Rose)',
          },
        },
      },
    },
    {
      id: 'hierarchy',
      title: 'The Classification Hierarchy',
      content: {
        overview:
          'Plants are classified in a hierarchical system from broad categories to very specific ones. Think of it like organizing files on your computer - from main folders to subfolders to individual files.',
        hierarchy: [
          { level: 'Kingdom', description: 'Plantae (all plants)', example: 'Plantae' },
          {
            level: 'Division/Phylum',
            description: 'Major plant groups',
            example: 'Magnoliophyta (flowering plants)',
          },
          {
            level: 'Class',
            description: 'Broad plant categories',
            example: 'Magnoliopsida (dicots)',
          },
          { level: 'Order', description: 'Related plant families', example: 'Rosales' },
          {
            level: 'Family',
            description: 'Groups of similar genera',
            example: 'Rosaceae (Rose family)',
          },
          { level: 'Genus', description: 'Closely related species', example: 'Rosa' },
          { level: 'Species', description: 'Individual plant types', example: 'Rosa canina' },
        ],
        mnemonic:
          mode === 'citizen'
            ? 'Remember: "King Philip Came Over For Great Soup" - Kingdom, Phylum, Class, Order, Family, Genus, Species'
            : 'Taxonomic ranks follow a standardized hierarchy established by botanical nomenclature codes',
      },
    },
    {
      id: 'naming',
      title: 'Binomial Nomenclature',
      content: {
        overview:
          'Every plant species has a two-part scientific name, like a first and last name. This system was created by Carl Linnaeus in the 1750s and is used worldwide.',
        rules: [
          'First part: Genus name (always capitalized)',
          'Second part: Species epithet (always lowercase)',
          'Written in italics or underlined',
          'Based on Latin or Greek roots',
          'Same name used worldwide, regardless of language',
        ],
        examples: [
          {
            name: 'Quercus robur',
            common: 'English Oak',
            breakdown: 'Quercus = oak genus, robur = strong/robust',
          },
          {
            name: 'Helianthus annuus',
            common: 'Sunflower',
            breakdown: 'Helianthus = sun flower, annuus = annual',
          },
          {
            name: 'Solanum lycopersicum',
            common: 'Tomato',
            breakdown: 'Solanum = nightshade genus, lycopersicum = wolf peach',
          },
        ],
      },
    },
    {
      id: 'identification',
      title: 'Plant Identification Keys',
      content: {
        overview:
          'Scientists use identification keys to determine what species a plant belongs to. These are like "choose your own adventure" books for botanists!',
        types: [
          {
            type: 'Dichotomous Keys',
            description: 'Series of paired choices leading to identification',
            example: '1a. Leaves simple → go to 2\n1b. Leaves compound → go to 8',
          },
          {
            type: 'Multi-access Keys',
            description: 'Choose any combination of characteristics',
            example: 'Select: flower color, leaf shape, plant height, habitat',
          },
          {
            type: 'Digital Keys',
            description: 'Apps and websites with photos and descriptions',
            example: 'PlantNet, iNaturalist, Flora Incognita',
          },
        ],
        characteristics: [
          'Leaf shape and arrangement',
          'Flower structure and color',
          'Fruit and seed types',
          'Stem characteristics',
          'Plant size and growth habit',
          'Habitat preferences',
        ],
      },
    },
  ];

  const markSectionComplete = (sectionIndex: number) => {
    const sectionId = sections[sectionIndex]?.id;
    if (!sectionId || completedSections.has(sectionIndex)) {return;}

    setCompletedSections((prev) => new Set([...prev, sectionIndex]));
    if (session) {
      recordActivity('education_section_completed', { module: MODULE_ID, sectionId });
    }
  };

  const nextSection = () => {
    if (currentSection < sections.length - 1) {
      markSectionComplete(currentSection);
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const currentSectionData = sections[currentSection];

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/education"
            className={`inline-flex items-center ${accentColorClass} hover:underline mb-4`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Education Hub
          </Link>
          <div className="flex items-center justify-center mb-6">
            <Tree className={`w-12 h-12 ${accentColorClass} mr-4`} />
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Plant Taxonomy 101</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto`}>
            Learn how scientists classify and name plants, from the broadest categories down to
            individual species.
          </p>
        </div>

        {/* Progress Bar */}
        {isLoading ? (
          <div
            className={`${sectionBg} rounded-2xl p-6 border backdrop-blur-md mb-8 text-center ${textColors.primary}`}
          >
            Loading progress...
          </div>
        ) : (
          <div className={`${sectionBg} rounded-2xl p-6 border backdrop-blur-md mb-8`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${textColors.primary}`}>Learning Progress</h3>
              <span className={`text-sm ${textColors.secondary}`}>
                {completedSections.size +
                  (currentSection === sections.length - 1 && !completedSections.has(currentSection)
                    ? 1
                    : 0)}{' '}
                of {sections.length} completed
              </span>
            </div>
            <div className="flex space-x-2">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className={`flex-1 h-3 rounded-full transition-all duration-300 ${
                    completedSections.has(index) ||
                    (index === currentSection && currentSection === sections.length - 1)
                      ? theme === 'light'
                        ? 'bg-green-500'
                        : 'bg-green-400'
                      : index === currentSection
                        ? theme === 'light'
                          ? 'bg-blue-400'
                          : 'bg-blue-500'
                        : theme === 'light'
                          ? 'bg-gray-200'
                          : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Section Navigation */}
        <div className={`${sectionBg} rounded-2xl p-6 border backdrop-blur-md mb-8`}>
          <div className="flex flex-wrap gap-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setCurrentSection(index)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  index === currentSection
                    ? `${accentColorClass} ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/30'} border ${innerCardBorder}`
                    : `${textColors.secondary} hover:${textColors.primary} ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-gray-800'}`
                }`}
              >
                {completedSections.has(index) && <CheckCircle className="w-4 h-4 inline mr-1" />}
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className={`${sectionBg} rounded-2xl p-8 border backdrop-blur-md mb-8`}>
          <h2 className={`text-3xl font-bold ${textColors.primary} mb-6 flex items-center`}>
            <Target className={`w-8 h-8 ${accentColorClass} mr-3`} />
            {currentSectionData.title}
          </h2>

          <div className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder} mb-8`}>
            <div className="flex items-start">
              <Info className={`w-6 h-6 ${accentColorClass} mr-3 mt-1 flex-shrink-0`} />
              <p className={`text-lg ${textColors.primary} leading-relaxed`}>
                {currentSectionData.content.overview}
              </p>
            </div>
          </div>

          {/* Section-specific content */}
          {currentSection === 0 && currentSectionData.content.keyPoints && (
            <div className="space-y-6">
              <div>
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Target className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Points:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentSectionData.content.keyPoints.map((point, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}
                    >
                      <div className="flex items-start">
                        <div
                          className={`w-3 h-3 rounded-full ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'} mr-3 mt-2 flex-shrink-0`}
                        />
                        <span className={textColors.primary}>{point}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {currentSectionData.content.example && (
                <div
                  className={`${theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20'} rounded-lg p-6 border ${theme === 'light' ? 'border-blue-200' : 'border-blue-700/30'}`}
                >
                  <h4 className={`font-semibold ${textColors.primary} mb-3`}>
                    💡 {currentSectionData.content.example.title}
                  </h4>
                  <p className={`${textColors.secondary} mb-4`}>
                    {currentSectionData.content.example.description}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className={`font-semibold ${textColors.primary}`}>Common Name</div>
                      <div className={`text-lg ${accentColorClass}`}>
                        {currentSectionData.content.example.comparison.common}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`font-semibold ${textColors.primary}`}>Scientific Name</div>
                      <div className={`text-lg font-italic ${accentColorClass}`}>
                        {currentSectionData.content.example.comparison.scientific}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`font-semibold ${textColors.primary}`}>Why It Matters</div>
                      <div className={`text-sm ${textColors.secondary}`}>
                        {currentSectionData.content.example.comparison.why}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentSection === 1 && currentSectionData.content.hierarchy && (
            <div className="space-y-6">
              <div>
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Stack className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  The Hierarchy:
                </h3>
                <div className="space-y-3">
                  {currentSectionData.content.hierarchy.map((level, index) => (
                    <div
                      key={level.level}
                      className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder} flex items-center`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full ${theme === 'light' ? 'bg-gradient-to-br from-green-100 to-blue-100' : 'bg-gradient-to-br from-green-900/40 to-blue-900/40'} flex items-center justify-center text-lg font-bold ${textColors.primary} mr-4`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className={`font-semibold ${textColors.primary} text-lg`}>
                          {level.level}
                        </div>
                        <div className={`${textColors.secondary} text-sm`}>{level.description}</div>
                      </div>
                      <div className={`text-right font-mono ${accentColorClass}`}>
                        {level.example}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={`${theme === 'light' ? 'bg-yellow-50' : 'bg-yellow-900/20'} rounded-lg p-6 border ${theme === 'light' ? 'border-yellow-200' : 'border-yellow-700/30'}`}
              >
                <h4 className={`font-semibold ${textColors.primary} mb-3`}>🧠 Memory Helper:</h4>
                <p className={`${textColors.primary} text-lg font-medium`}>
                  {currentSectionData.content.mnemonic}
                </p>
              </div>
            </div>
          )}

          {currentSection === 2 &&
            currentSectionData.content.rules &&
            currentSectionData.content.examples && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-xl font-semibold ${textColors.primary} mb-4`}>
                    📝 Naming Rules:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentSectionData.content.rules.map((rule, index) => (
                      <div
                        key={index}
                        className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}
                      >
                        <div className="flex items-start">
                          <div
                            className={`w-6 h-6 rounded-full ${theme === 'light' ? 'bg-blue-500' : 'bg-blue-400'} text-white text-xs flex items-center justify-center mr-3 mt-1 flex-shrink-0 font-bold`}
                          >
                            {index + 1}
                          </div>
                          <span className={textColors.primary}>{rule}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3
                    className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                  >
                    <Leaf className={`w-5 h-5 ${accentColorClass} mr-2`} />
                    Examples:
                  </h3>
                  <div className="space-y-4">
                    {currentSectionData.content.examples.map((example, index) => (
                      <div
                        key={index}
                        className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                          <div>
                            <div
                              className={`text-2xl font-bold font-italic ${accentColorClass} mb-1`}
                            >
                              {example.name}
                            </div>
                            <div className={`text-lg ${textColors.primary}`}>{example.common}</div>
                          </div>
                          <div
                            className={`mt-2 md:mt-0 text-sm ${textColors.secondary} md:text-right`}
                          >
                            {example.breakdown}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          {currentSection === 3 &&
            currentSectionData.content.types &&
            currentSectionData.content.characteristics && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-xl font-semibold ${textColors.primary} mb-4`}>
                    🔑 Types of Identification Keys:
                  </h3>
                  <div className="space-y-4">
                    {currentSectionData.content.types.map((type, index) => (
                      <div
                        key={index}
                        className={`${innerCardBg} rounded-lg p-6 border ${innerCardBorder}`}
                      >
                        <h4 className={`font-semibold ${accentColorClass} text-lg mb-2`}>
                          {type.type}
                        </h4>
                        <p className={`${textColors.secondary} mb-3`}>{type.description}</p>
                        <div
                          className={`${theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} rounded p-3 font-mono text-sm ${textColors.primary}`}
                        >
                          {type.example}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3
                    className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                  >
                    <MagnifyingGlass className={`w-5 h-5 ${accentColorClass} mr-2`} />
                    Key Characteristics to Observe:
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {currentSectionData.content.characteristics.map((char, index) => (
                      <div
                        key={index}
                        className={`${innerCardBg} rounded-lg p-3 border ${innerCardBorder} text-center`}
                      >
                        <span className={`text-sm ${textColors.primary}`}>{char}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Link href="/education">
            <button
              className={`flex items-center px-6 py-3 rounded-lg ${innerCardBg} border ${innerCardBorder} ${textColors.secondary} hover:${textColors.primary} transition-colors duration-300`}
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Back to Education Hub
            </button>
          </Link>

          <div className="flex space-x-4">
            <button
              onClick={prevSection}
              disabled={currentSection === 0}
              className={`flex items-center px-6 py-3 rounded-lg transition-all duration-300 ${
                currentSection === 0
                  ? `${theme === 'light' ? 'bg-gray-100 text-gray-400' : 'bg-gray-800 text-gray-600'} cursor-not-allowed`
                  : `${innerCardBg} border ${innerCardBorder} ${textColors.secondary} hover:${textColors.primary}`
              }`}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous
            </button>

            <button
              onClick={nextSection}
              disabled={currentSection === sections.length - 1}
              className={`flex items-center px-6 py-3 rounded-lg transition-all duration-300 ${
                currentSection === sections.length - 1
                  ? `${theme === 'light' ? 'bg-gray-100 text-gray-400' : 'bg-gray-800 text-gray-600'} cursor-not-allowed`
                  : `${accentColorClass} ${theme === 'light' ? 'bg-gradient-to-r from-green-50 to-blue-50' : 'bg-gradient-to-r from-green-900/30 to-blue-900/30'} border ${innerCardBorder} hover:scale-105`
              }`}
            >
              Next
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>

        {/* Completion Message */}
        {currentSection === sections.length - 1 && (
          <div
            className={`mt-8 ${theme === 'light' ? 'bg-green-50' : 'bg-green-900/20'} rounded-lg p-6 border ${theme === 'light' ? 'border-green-200' : 'border-green-700/30'} text-center`}
          >
            <CheckCircle
              className={`w-12 h-12 ${theme === 'light' ? 'text-green-600' : 'text-green-400'} mx-auto mb-4`}
            />
            <h3 className={`text-xl font-bold ${textColors.primary} mb-2`}>🎉 Congratulations!</h3>
            <p className={`${textColors.secondary} mb-4`}>
              You&apos;ve completed the Plant Taxonomy 101 module. You now understand how plants are
              classified and named!
            </p>
            <Link
              href="/education"
              className={`inline-flex items-center px-6 py-3 rounded-lg font-medium ${theme === 'light' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-700 hover:bg-green-800'} text-white transition-all`}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Continue Learning
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
export const dynamic = 'force-dynamic';
