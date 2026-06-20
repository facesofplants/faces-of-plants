'use client';

import {
  Globe,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Info,
  Target,
  CheckCircle,
  Tree,
  Users,
  Leaf,
  Mountains,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import React, { useState, useEffect } from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../../context/ModeContext';
export default function BiodiversityPage() {
  const { mode, theme } = useMode();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recordActivity = (_event: string, _details?: Record<string, unknown>) => {};
  const textColors = getTextColors(theme);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const MODULE_ID = 'biodiversity';

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
      id: 'what-is-biodiversity',
      title: 'What is Biodiversity?',
      content: {
        overview:
          'Biodiversity refers to the variety of life on Earth at all levels - from genes within species to entire ecosystems. Plant biodiversity is the foundation of most terrestrial ecosystems and supports all life on Earth.',
        keyPoints: [
          'Biodiversity exists at three main levels: genetic, species, and ecosystem',
          'Plants form the foundation of most terrestrial food webs',
          'Higher biodiversity usually means more stable ecosystems',
          'Every species plays a unique role in its ecosystem',
          'Biodiversity provides ecosystem services essential for human survival',
        ],
        example: {
          title: 'The Three Levels of Plant Biodiversity',
          levels: [
            {
              name: 'Genetic Diversity',
              description: 'Variation within species',
              example:
                'Different varieties of tomatoes (cherry, beefsteak, heirloom) all belong to Solanum lycopersicum',
            },
            {
              name: 'Species Diversity',
              description: 'Number of different species',
              example: 'A forest might contain oak, maple, pine, fern, and moss species',
            },
            {
              name: 'Ecosystem Diversity',
              description: 'Variety of habitats and communities',
              example: 'Tropical rainforests, temperate grasslands, alpine meadows, wetlands',
            },
          ],
        },
      },
    },
    {
      id: 'ecosystem-roles',
      title: 'Plant Roles in Ecosystems',
      content: {
        overview:
          'Plants serve multiple critical functions in ecosystems, from primary production to habitat creation. Understanding these roles helps us appreciate why plant diversity matters for ecosystem health.',
        keyPoints: [
          'Primary producers convert sunlight into energy for food webs',
          'Habitat providers create homes for countless other species',
          'Soil builders and protectors prevent erosion',
          'Water cycle regulators control local climate',
          'Pollinators and seed dispersers depend on plant diversity',
        ],
        roles: [
          {
            title: 'Primary Producers',
            icon: '🌱',
            description:
              'Plants capture solar energy through photosynthesis, forming the base of food webs',
            examples: ['Trees in forests', 'Phytoplankton in oceans', 'Grasses in prairies'],
          },
          {
            title: 'Habitat Engineers',
            icon: '🏠',
            description: 'Plants create and modify habitats for other organisms',
            examples: [
              'Tree canopies providing bird nesting sites',
              'Root systems creating soil microhabitats',
              'Aquatic plants providing fish shelter',
            ],
          },
          {
            title: 'Ecosystem Regulators',
            icon: '⚖️',
            description: 'Plants help regulate water, nutrients, and climate',
            examples: [
              'Forest transpiration cooling air',
              'Root networks preventing erosion',
              'Wetland plants filtering water',
            ],
          },
        ],
      },
    },
    {
      id: 'threats-conservation',
      title: 'Threats and Conservation',
      content: {
        overview:
          'Plant biodiversity faces unprecedented threats from human activities, but conservation efforts are working to protect and restore plant communities worldwide.',
        threats: [
          {
            name: 'Habitat Loss',
            impact: 'Primary threat to plant diversity',
            examples: [
              'Deforestation for agriculture',
              'Urban development',
              'Infrastructure projects',
            ],
            solution: 'Protected areas and habitat corridors',
          },
          {
            name: 'Climate Change',
            impact: 'Shifting suitable habitat ranges',
            examples: [
              'Temperature increases',
              'Changing precipitation patterns',
              'Extreme weather events',
            ],
            solution: 'Assisted migration and climate refugia',
          },
          {
            name: 'Invasive Species',
            impact: 'Competition with native plants',
            examples: ['Non-native weeds', 'Escaped garden plants', 'Agricultural crops'],
            solution: 'Early detection and rapid response',
          },
          {
            name: 'Overexploitation',
            impact: 'Unsustainable harvesting',
            examples: ['Medicinal plants', 'Timber species', 'Ornamental plants'],
            solution: 'Sustainable use practices and cultivation',
          },
        ],
        conservation: {
          strategies: [
            'In-situ conservation (protecting natural habitats)',
            'Ex-situ conservation (seed banks, botanical gardens)',
            'Restoration of degraded ecosystems',
            'Community-based conservation programs',
            'International cooperation and legislation',
          ],
          success:
            "Over 15% of Earth's land surface is now protected, and seed banks preserve over 2.5 billion seeds worldwide!",
        },
      },
    },
    {
      id: 'endemic-species',
      title: 'Endemic Species and Hotspots',
      content: {
        overview:
          'Endemic species are found naturally in only one location. These unique plants are often the most vulnerable to extinction but also represent the most irreplaceable components of biodiversity.',
        keyPoints: [
          'Endemic species evolved in isolation and are found nowhere else',
          'Islands and isolated habitats often have high endemism',
          'Biodiversity hotspots contain exceptional concentrations of endemic species',
          'Endemic plants often have specialized ecological requirements',
          'Loss of endemic species represents irreversible biodiversity loss',
        ],
        hotspots: [
          {
            name: 'Madagascar and Indian Ocean Islands',
            plants: '12,000+ species, 83% endemic',
            threat: 'Only 10% of original vegetation remains',
            examples: ['Baobab trees', 'Pachypodium species', 'Orchids'],
          },
          {
            name: 'California Floristic Province',
            plants: '8,000+ species, 61% endemic',
            threat: 'Urban development and agriculture',
            examples: ['Giant sequoias', 'California poppies', 'Manzanitas'],
          },
          {
            name: 'Cape Floral Kingdom (South Africa)',
            plants: '9,000+ species, 69% endemic',
            threat: 'Smallest floral kingdom but richest in diversity',
            examples: ['Proteas', 'Restios', 'Ericas'],
          },
        ],
        why_matter: [
          'Unique evolutionary history and adaptations',
          'Potential sources of new medicines and materials',
          'Keystone species in their ecosystems',
          'Cultural and aesthetic value to local communities',
          'Indicators of ecosystem health and integrity',
        ],
      },
    },
    {
      id: 'citizen-science',
      title: 'How You Can Help',
      content: {
        overview:
          mode === 'citizen'
            ? 'As a citizen scientist, you can make meaningful contributions to biodiversity conservation and research. Every observation counts!'
            : 'Engaging the public in biodiversity research multiplies our capacity to monitor and protect plant diversity. Here are ways to involve citizen scientists.',
        opportunities: [
          {
            activity: 'iNaturalist Observations',
            description: 'Photograph and identify plants in your area',
            impact: 'Contributes to global biodiversity databases',
            difficulty: 'Easy - just use your phone!',
          },
          {
            activity: 'BioBlitz Participation',
            description: 'Join organized biodiversity surveys',
            impact: 'Rapid assessment of local plant communities',
            difficulty: 'Beginner-friendly with expert guidance',
          },
          {
            activity: 'Phenology Monitoring',
            description: 'Track seasonal changes in plants',
            impact: 'Climate change research data',
            difficulty: 'Moderate - requires regular observations',
          },
          {
            activity: 'Native Plant Gardening',
            description: 'Grow local native species at home',
            impact: 'Habitat creation and seed source',
            difficulty: 'Variable - start small!',
          },
          {
            activity: 'Invasive Species Reporting',
            description: 'Report non-native plants in natural areas',
            impact: 'Early detection for rapid response',
            difficulty: 'Easy - just report locations',
          },
        ],
        tips:
          mode === 'citizen'
            ? [
                'Start with plants in your own backyard or neighborhood',
                'Use apps like iNaturalist, PlantNet, or Seek for identification help',
                'Join local naturalist groups or botanical societies',
                'Participate in community science projects',
                'Learn about native plants in your region',
                'Consider volunteering at botanical gardens or nature centers',
              ]
            : [
                'Provide clear protocols and training materials',
                'Use technology to make participation easier',
                'Give regular feedback on data quality and impact',
                'Create opportunities for different skill levels',
                'Partner with local organizations and schools',
                'Recognize and celebrate volunteer contributions',
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Globe className={`w-16 h-16 ${accentColorClass} mr-4`} />
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Biodiversity Concepts</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-3xl mx-auto mb-8`}>
            Explore the richness and variety of plant life on Earth and discover why biodiversity
            matters for ecosystems and human well-being.
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
          <div className="flex items-center mb-6">
            <Target className={`w-8 h-8 ${accentColorClass} mr-4`} />
            <h2 className={`text-3xl font-bold ${textColors.primary}`}>
              {currentSectionData.title}
            </h2>
          </div>

          <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder} mb-6`}>
            <p className={`text-lg ${textColors.secondary} leading-relaxed`}>
              {currentSectionData.content.overview}
            </p>
          </div>

          {/* Section-specific content */}
          {currentSection === 0 && currentSectionData.content.keyPoints && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Info className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Concepts
                </h3>
                <div className="grid gap-3">
                  {currentSectionData.content.keyPoints.map((point, index) => (
                    <div
                      key={index}
                      className={`flex items-start ${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'} mt-2 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary}`}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {currentSectionData.content.example && (
                <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                  <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                    {currentSectionData.content.example.title}
                  </h4>
                  <div className="grid gap-4">
                    {currentSectionData.content.example.levels?.map((level, index) => (
                      <div
                        key={index}
                        className={`border-l-4 ${theme === 'light' ? 'border-green-400' : 'border-green-500'} pl-4`}
                      >
                        <h5 className={`font-semibold ${accentColorClass} mb-1`}>{level.name}</h5>
                        <p className={`text-sm ${textColors.secondary} mb-1`}>
                          {level.description}
                        </p>
                        <p className={`text-sm ${textColors.primary} italic`}>
                          Example: {level.example}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {currentSection === 1 && currentSectionData.content.roles && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Tree className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Ecosystem Roles
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.keyPoints?.map((point, index) => (
                    <div
                      key={index}
                      className={`flex items-start ${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'} mt-2 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary}`}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {currentSectionData.content.roles.map((role, index) => (
                  <div
                    key={index}
                    className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                  >
                    <div className="text-3xl mb-3">{role.icon}</div>
                    <h4 className={`text-lg font-semibold ${accentColorClass} mb-3`}>
                      {role.title}
                    </h4>
                    <p className={`text-sm ${textColors.secondary} mb-4`}>{role.description}</p>
                    <div className="space-y-1">
                      {role.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className={`text-xs ${textColors.primary} flex items-center`}
                        >
                          <Leaf className="w-3 h-3 mr-1" />
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {currentSection === 2 && currentSectionData.content.threats && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Info className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Major Threats to Plant Biodiversity
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.threats.map((threat, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold text-red-500`}>{threat.name}</h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-red-100 text-red-700' : 'bg-red-900/30 text-red-400'}`}
                        >
                          {threat.impact}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Examples:
                          </h5>
                          <ul className="space-y-1">
                            {threat.examples.map((example, idx) => (
                              <li
                                key={idx}
                                className={`text-sm ${textColors.secondary} flex items-center`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full bg-red-400 mr-2`} />
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Conservation Solution:
                          </h5>
                          <p
                            className={`text-sm ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}
                          >
                            {threat.solution}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {currentSectionData.content.conservation && (
                <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                  <h4
                    className={`text-lg font-semibold ${textColors.primary} mb-4 flex items-center`}
                  >
                    <CheckCircle
                      className={`w-5 h-5 ${theme === 'light' ? 'text-green-600' : 'text-green-400'} mr-2`}
                    />
                    Conservation Strategies
                  </h4>
                  <div className="grid gap-3 mb-4">
                    {currentSectionData.content.conservation.strategies.map((strategy, index) => (
                      <div key={index} className={`flex items-start`}>
                        <div
                          className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'} mt-2 mr-3 flex-shrink-0`}
                        />
                        <span className={`${textColors.secondary}`}>{strategy}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`p-4 rounded-lg ${theme === 'light' ? 'bg-green-50 border border-green-200' : 'bg-green-900/30 border border-green-700/30'}`}
                  >
                    <p
                      className={`text-sm ${theme === 'light' ? 'text-green-800' : 'text-green-300'} font-medium`}
                    >
                      🎉 Success Story: {currentSectionData.content.conservation.success}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {currentSection === 3 && currentSectionData.content.hotspots && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Mountains className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Concepts about Endemic Species
                </h3>
                <div className="grid gap-3">
                  {currentSectionData.content.keyPoints?.map((point, index) => (
                    <div
                      key={index}
                      className={`flex items-start ${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-green-500' : 'bg-green-400'} mt-2 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary}`}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className={`text-xl font-semibold ${textColors.primary} mb-4`}>
                  Biodiversity Hotspots
                </h3>
                <div className="grid gap-6">
                  {currentSectionData.content.hotspots.map((hotspot, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold ${accentColorClass}`}>
                          {hotspot.name}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/30 text-purple-400'}`}
                        >
                          Hotspot
                        </span>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Plant Diversity:
                          </h5>
                          <p
                            className={`text-sm ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}
                          >
                            {hotspot.plants}
                          </p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Conservation Status:
                          </h5>
                          <p className={`text-sm text-red-500`}>{hotspot.threat}</p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Notable Species:
                          </h5>
                          <div className="space-y-1">
                            {hotspot.examples.map((example, idx) => (
                              <p key={idx} className={`text-xs ${textColors.secondary}`}>
                                {example}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                  Why Endemic Species Matter
                </h4>
                <div className="grid gap-3">
                  {currentSectionData.content.why_matter?.map((reason, index) => (
                    <div key={index} className={`flex items-start`}>
                      <div
                        className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-purple-500' : 'bg-purple-400'} mt-2 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary}`}>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentSection === 4 && currentSectionData.content.opportunities && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Users className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  {mode === 'citizen' ? 'Ways You Can Contribute' : 'Citizen Science Opportunities'}
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.opportunities.map((opportunity, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold ${accentColorClass}`}>
                          {opportunity.activity}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            opportunity.difficulty.includes('Easy')
                              ? theme === 'light'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-green-900/30 text-green-400'
                              : opportunity.difficulty.includes('Moderate')
                                ? theme === 'light'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-yellow-900/30 text-yellow-400'
                                : theme === 'light'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {opportunity.difficulty.split(' - ')[0]}
                        </span>
                      </div>
                      <p className={`${textColors.secondary} mb-3`}>{opportunity.description}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Impact:
                          </h5>
                          <p
                            className={`text-sm ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}
                          >
                            {opportunity.impact}
                          </p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Getting Started:
                          </h5>
                          <p className={`text-sm ${textColors.secondary}`}>
                            {opportunity.difficulty}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {currentSectionData.content.tips && (
                <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                  <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                    {mode === 'citizen'
                      ? '💡 Tips for Getting Started'
                      : '📋 Best Practices for Engaging Citizens'}
                  </h4>
                  <div className="grid gap-3">
                    {currentSectionData.content.tips.map((tip, index) => (
                      <div key={index} className={`flex items-start`}>
                        <div
                          className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-blue-500' : 'bg-blue-400'} mt-2 mr-3 flex-shrink-0`}
                        />
                        <span className={`${textColors.secondary}`}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
      </section>
    </div>
  );
}
export const dynamic = 'force-dynamic';
