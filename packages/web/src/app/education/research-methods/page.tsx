'use client';

import {
  Microscope,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Info,
  Target,
  CheckCircle,
  Camera,
  MapPin,
  Dna,
  FileText,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import React, { useState, useEffect } from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../../context/ModeContext';
export default function ResearchMethodsPage() {
  const { mode, theme } = useMode();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recordActivity = (_event: string, _details?: Record<string, unknown>) => {};
  const textColors = getTextColors(theme);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const MODULE_ID = 'research-methods';

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
      id: 'field-collection',
      title: 'Field Collection Methods',
      content: {
        overview:
          'Field collection is the foundation of plant research, involving systematic methods to document, collect, and preserve plant specimens from their natural habitats.',
        keyPoints: [
          'Proper documentation is essential for scientific value',
          'GPS coordinates and habitat data provide crucial context',
          'Ethical collection practices protect wild populations',
          'Different collection methods suit different research goals',
          'Permits and permissions are often required',
        ],
        methods: [
          {
            name: 'Voucher Specimens',
            purpose: 'Physical evidence for research studies',
            process: 'Collect representative samples with flowers/fruits when possible',
            equipment: ['Plant press', 'Collection bags', 'Field notebook', 'GPS device'],
            considerations: "Take only what's needed; avoid rare species",
          },
          {
            name: 'Photographic Documentation',
            purpose: 'Non-destructive species recording',
            process: 'Capture whole plant, leaves, flowers, fruits, and habitat',
            equipment: ['Camera with macro lens', 'Scale objects', 'Color cards'],
            considerations: 'Multiple angles; document diagnostic features',
          },
          {
            name: 'Tissue Sampling',
            purpose: 'Genetic analysis and DNA studies',
            process: 'Collect fresh, young leaf material in preservation medium',
            equipment: ['Silica gel packets', 'Collection tubes', 'Forceps'],
            considerations: 'Keep samples dry and labeled; process quickly',
          },
          {
            name: 'Ecological Surveys',
            purpose: 'Population and community studies',
            process: 'Systematic sampling using plots or transects',
            equipment: ['Measuring tapes', 'Quadrats', 'Data sheets', 'Calipers'],
            considerations: 'Standardized methods; repeated measurements',
          },
        ],
        best_practices: [
          'Always record precise location data (GPS coordinates)',
          'Document habitat conditions, associated species, and abundance',
          'Use proper pressing techniques to preserve specimens',
          'Photograph specimens before and after collection',
          'Maintain detailed field notes with collection numbers',
          'Respect private property and protected areas',
          'Follow local regulations and obtain necessary permits',
        ],
      },
    },
    {
      id: 'digital-herbaria',
      title: 'Digital Herbaria & Databases',
      content: {
        overview:
          'Digital herbaria are transforming how plant specimens are stored, accessed, and studied. These online collections make millions of specimens available to researchers worldwide.',
        keyPoints: [
          'Digital access to specimens eliminates geographic barriers',
          'High-resolution imaging preserves specimen details',
          'Standardized data formats enable large-scale studies',
          'Machine learning can assist with identification',
          'Virtual collections reduce handling of fragile specimens',
        ],
        major_platforms: [
          {
            name: 'GBIF (Global Biodiversity Information Facility)',
            description: "World's largest network of biodiversity data",
            specimens: '1.5+ billion occurrence records',
            features: [
              'Free access',
              'API for data retrieval',
              'Quality filters',
              'Download citations',
            ],
            use_cases: [
              'Species distribution mapping',
              'Occurrence data analysis',
              'Biodiversity assessments',
            ],
          },
          {
            name: 'iDigBio (Integrated Digitized Biocollections)',
            description: 'US national resource for digitized specimen data',
            specimens: '140+ million specimen records',
            features: [
              'Advanced search',
              'Media galleries',
              'Data quality tools',
              'Research portals',
            ],
            use_cases: ['Taxonomic research', 'Educational resources', 'Collection management'],
          },
          {
            name: 'Consortium of European Taxonomic Facilities (CETAF)',
            description: 'European network of natural history collections',
            specimens: '1.5+ billion specimens represented',
            features: ['Distributed search', 'Standards development', 'Training resources'],
            use_cases: [
              'European biodiversity studies',
              'Taxonomic expertise',
              'Collection strategies',
            ],
          },
        ],
        digitization_process: [
          {
            step: 'Specimen Preparation',
            description: 'Clean and arrange specimens for imaging',
            considerations: 'Handle fragile specimens carefully; use appropriate supports',
          },
          {
            step: 'High-Resolution Imaging',
            description: 'Capture detailed photographs with consistent lighting',
            considerations: 'Use color standards; document both sides if needed',
          },
          {
            step: 'Data Transcription',
            description: 'Extract label information into digital databases',
            considerations: 'Accurate transcription; standardized formats; quality control',
          },
          {
            step: 'Quality Control',
            description: 'Verify image quality and data accuracy',
            considerations: 'Check for completeness; validate coordinates; flag issues',
          },
          {
            step: 'Database Integration',
            description: 'Upload to institutional and global databases',
            considerations: 'Standard formats; metadata requirements; attribution',
          },
        ],
      },
    },
    {
      id: 'dna-barcoding',
      title: 'DNA Barcoding & Molecular Methods',
      content: {
        overview:
          'DNA barcoding uses short DNA sequences to identify species, similar to how product barcodes identify items in stores. This powerful tool is revolutionizing plant taxonomy and identification.',
        keyPoints: [
          'DNA barcodes provide objective species identification',
          'Useful when morphological features are unclear',
          'Enables identification of incomplete specimens',
          'Reveals cryptic species and evolutionary relationships',
          'Supports conservation and monitoring efforts',
        ],
        plant_barcodes: [
          {
            gene: 'rbcL',
            region: 'Chloroplast coding region',
            characteristics: 'Highly conserved, easy to amplify',
            resolution: 'Good for higher taxonomic levels',
            applications: ['Family and genus identification', 'Phylogenetic studies'],
          },
          {
            gene: 'matK',
            region: 'Chloroplast coding region',
            characteristics: 'More variable than rbcL',
            resolution: 'Better species discrimination',
            applications: ['Species identification', 'Population studies'],
          },
          {
            gene: 'ITS',
            region: 'Nuclear ribosomal DNA',
            characteristics: 'Highly variable, good resolution',
            resolution: 'Excellent for closely related species',
            applications: ['Species delimitation', 'Hybrid detection'],
          },
          {
            gene: 'trnH-psbA',
            region: 'Chloroplast intergenic spacer',
            characteristics: 'Variable length, good discrimination',
            resolution: 'Good for species and populations',
            applications: ['Medicinal plant authentication', 'Food verification'],
          },
        ],
        workflow: [
          {
            phase: 'Sample Collection',
            description: 'Collect fresh tissue and preserve properly',
            details: ['Young leaves preferred', 'Silica gel drying', 'Freeze storage options'],
            time: '1 day',
          },
          {
            phase: 'DNA Extraction',
            description: 'Extract high-quality genomic DNA',
            details: ['Cell lysis', 'Protein removal', 'DNA purification'],
            time: '2-4 hours',
          },
          {
            phase: 'PCR Amplification',
            description: 'Amplify target gene regions',
            details: ['Primer selection', 'Thermal cycling', 'Product verification'],
            time: '3-4 hours',
          },
          {
            phase: 'DNA Sequencing',
            description: 'Generate DNA sequence data',
            details: ['Sanger sequencing', 'Quality assessment', 'Sequence editing'],
            time: '1-2 days',
          },
          {
            phase: 'Sequence Analysis',
            description: 'Compare sequences to reference databases',
            details: ['BLAST searches', 'Phylogenetic analysis', 'Species identification'],
            time: '1-2 hours',
          },
        ],
        applications: [
          {
            category: 'Species Identification',
            examples: ['Unknown specimens', 'Fragmentary material', 'Sterile plants'],
            benefits: 'Objective, reproducible results',
          },
          {
            category: 'Taxonomic Research',
            examples: [
              'Cryptic species discovery',
              'Phylogenetic reconstruction',
              'Evolutionary studies',
            ],
            benefits: 'Reveals hidden diversity',
          },
          {
            category: 'Conservation',
            examples: ['Population genetics', 'Invasive species detection', 'Trade monitoring'],
            benefits: 'Supports evidence-based decisions',
          },
          {
            category: 'Applied Research',
            examples: [
              'Food authentication',
              'Medicinal plant verification',
              'Environmental monitoring',
            ],
            benefits: 'Practical problem-solving',
          },
        ],
      },
    },
    {
      id: 'ecological-surveys',
      title: 'Ecological Survey Techniques',
      content: {
        overview:
          'Ecological surveys quantify plant communities and their relationships with environmental factors. These standardized methods enable comparison across studies and long-term monitoring.',
        keyPoints: [
          'Standardized methods ensure reproducible results',
          'Different techniques suit different research questions',
          'Plot-based sampling provides quantitative data',
          'Environmental measurements add crucial context',
          'Long-term studies reveal ecological changes',
        ],
        survey_methods: [
          {
            method: 'Quadrat Sampling',
            description: 'Fixed-area plots for detailed vegetation analysis',
            plot_size: '1m² to 100m² depending on vegetation type',
            measurements: ['Species composition', 'Percent cover', 'Individual counts'],
            best_for: 'Herbaceous vegetation, detailed community analysis',
            advantages: ['Precise area measurement', 'Standardized data collection'],
            limitations: ['Time-intensive', 'May miss rare species'],
          },
          {
            method: 'Point-Intercept',
            description: 'Systematic points along transects',
            plot_size: 'Points every 0.5-2m along transects',
            measurements: ['Species presence at points', 'Vegetation height', 'Ground cover'],
            best_for: 'Large areas, grasslands, rapid assessment',
            advantages: ['Efficient', 'Objective measurements'],
            limitations: ['May underestimate rare species', 'Less detailed'],
          },
          {
            method: 'Belt Transects',
            description: 'Continuous strips for gradient studies',
            plot_size: '1-10m wide × variable length',
            measurements: ['Species composition along gradients', 'Environmental changes'],
            best_for: 'Environmental gradients, edge effects',
            advantages: ['Shows spatial patterns', 'Good for gradients'],
            limitations: ['Subjective plot boundaries', 'Edge effects'],
          },
          {
            method: 'Point-Quarter Method',
            description: 'Tree sampling using nearest individual technique',
            plot_size: 'Sample points with distance measurements',
            measurements: [
              'Tree density',
              'DBH (diameter at breast height)',
              'Species composition',
            ],
            best_for: 'Forest vegetation, tree communities',
            advantages: ['No plot establishment needed', 'Efficient for trees'],
            limitations: ['Limited to woody vegetation', 'Assumes random distribution'],
          },
        ],
        environmental_data: [
          {
            category: 'Physical Environment',
            measurements: [
              'Soil temperature',
              'Soil moisture',
              'pH',
              'Light levels',
              'Slope and aspect',
            ],
            equipment: [
              'Thermometers',
              'Moisture meters',
              'pH meters',
              'Light meters',
              'Clinometers',
            ],
            importance: 'Explains species distribution patterns',
          },
          {
            category: 'Disturbance History',
            measurements: [
              'Fire history',
              'Grazing intensity',
              'Human impacts',
              'Natural disturbances',
            ],
            equipment: ['Interviews', 'Historical records', 'Visual assessment', 'Core samples'],
            importance: 'Context for current vegetation state',
          },
          {
            category: 'Spatial Context',
            measurements: ['GPS coordinates', 'Elevation', 'Distance to water', 'Connectivity'],
            equipment: ['GPS units', 'Altimeters', 'GIS software', 'Maps'],
            importance: 'Enables landscape-scale analysis',
          },
        ],
        data_analysis: [
          'Descriptive statistics (mean, standard deviation)',
          'Diversity indices (Shannon, Simpson)',
          'Ordination analysis (PCA, NMDS)',
          'Classification techniques (cluster analysis)',
          'Species-environment relationships (CCA, regression)',
          'Temporal trend analysis (repeated measures)',
          'Spatial analysis (spatial autocorrelation)',
        ],
      },
    },
    {
      id: 'modern-tools',
      title: 'Modern Research Tools & Technology',
      content: {
        overview:
          'Cutting-edge technologies are revolutionizing plant research, from remote sensing to artificial intelligence. These tools enable studies at unprecedented scales and resolutions.',
        keyPoints: [
          'Remote sensing monitors vegetation from space',
          'AI assists with species identification and data analysis',
          'Portable DNA sequencers enable field genomics',
          'Apps democratize data collection and identification',
          'Big data approaches reveal global patterns',
        ],
        technologies: [
          {
            category: 'Remote Sensing',
            tools: [
              {
                name: 'Satellite Imagery',
                description: 'Monitor vegetation changes over large areas',
                applications: ['Deforestation tracking', 'Phenology studies', 'Habitat mapping'],
                examples: ['Landsat', 'Sentinel', 'MODIS'],
                resolution: '10m to 1km spatial resolution',
              },
              {
                name: 'Drone/UAV Surveys',
                description: 'High-resolution aerial data collection',
                applications: ['Forest inventory', 'Species mapping', 'Health assessment'],
                examples: ['Multispectral cameras', 'LiDAR sensors', 'Thermal imaging'],
                resolution: 'Centimeter-level detail',
              },
              {
                name: 'Hyperspectral Imaging',
                description: 'Detailed spectral signatures of vegetation',
                applications: [
                  'Species identification',
                  'Stress detection',
                  'Chemical composition',
                ],
                examples: ['AVIRIS', 'EnMAP', 'HyspIRI'],
                resolution: 'Hundreds of spectral bands',
              },
            ],
          },
          {
            category: 'Artificial Intelligence',
            tools: [
              {
                name: 'Computer Vision',
                description: 'Automated image analysis and pattern recognition',
                applications: [
                  'Species identification',
                  'Morphometric analysis',
                  'Damage assessment',
                ],
                examples: ['PlantNet', 'iNaturalist AI', 'Pl@ntUse'],
                resolution: 'Species-level identification',
              },
              {
                name: 'Machine Learning',
                description: 'Pattern discovery in large datasets',
                applications: ['Predictive modeling', 'Classification', 'Anomaly detection'],
                examples: ['Random Forest', 'Neural Networks', 'Support Vector Machines'],
                resolution: 'Complex pattern recognition',
              },
              {
                name: 'Natural Language Processing',
                description: 'Extract information from scientific literature',
                applications: ['Literature mining', 'Trait extraction', 'Knowledge graphs'],
                examples: ['BioBERT', 'SciBERT', 'Named Entity Recognition'],
                resolution: 'Semantic understanding',
              },
            ],
          },
          {
            category: 'Portable Genomics',
            tools: [
              {
                name: 'MinION Sequencer',
                description: 'Portable, real-time DNA sequencing',
                applications: ['Field genomics', 'Species identification', 'Microbiome studies'],
                examples: ['Oxford Nanopore', 'Real-time analysis', 'Long reads'],
                resolution: 'Single-molecule sequencing',
              },
              {
                name: 'Portable PCR',
                description: 'Field-deployable genetic analysis',
                applications: ['Pathogen detection', 'GMO screening', 'Genetic diversity'],
                examples: ['miniPCR', 'BioRad T100', 'Smart cyclers'],
                resolution: 'Gene-level detection',
              },
            ],
          },
          {
            category: 'Mobile Applications',
            tools: [
              {
                name: 'Identification Apps',
                description: 'AI-powered plant identification',
                applications: ['Citizen science', 'Education', 'Rapid surveys'],
                examples: ['PlantNet', 'iNaturalist', 'PlantIn', 'PictureThis'],
                resolution: 'Species-level ID with photos',
              },
              {
                name: 'Data Collection Apps',
                description: 'Standardized field data recording',
                applications: ['Survey data', 'Monitoring', 'Collaborative research'],
                examples: ['KoBoToolbox', 'ODK Collect', 'Survey123'],
                resolution: 'Structured data collection',
              },
              {
                name: 'Phenology Apps',
                description: 'Track seasonal changes in plants',
                applications: ['Climate research', 'Ecological monitoring', 'Timing studies'],
                examples: ['eBird', "Nature's Notebook", 'Project BudBurst'],
                resolution: 'Temporal life cycle events',
              },
            ],
          },
        ],
        integration_benefits: [
          'Multi-scale analysis from molecules to ecosystems',
          'Real-time data collection and analysis',
          'Reduced costs and increased accessibility',
          'Enhanced collaboration and data sharing',
          'Improved accuracy and reproducibility',
          'Faster discovery and hypothesis testing',
        ],
        future_directions: [
          'Integration of multiple data types (genomics + remote sensing)',
          'Real-time environmental monitoring networks',
          'AI-driven hypothesis generation',
          'Automated field robotics',
          'Blockchain for data integrity',
          'Virtual and augmented reality for training',
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
          <div className="flex items-center justify-center mb-6">
            <Microscope className={`w-16 h-16 ${accentColorClass} mr-4`} />
            <h1 className={`text-5xl font-bold ${textColors.primary}`}>Plant Research Methods</h1>
          </div>
          <p className={`text-lg ${textColors.secondary} max-w-4xl mx-auto mb-8`}>
            Discover modern techniques for studying and documenting plant species, from traditional
            field methods to cutting-edge genomic and remote sensing technologies.
          </p>
        </div>

        {/* Progress Bar */}
        <div className={`${sectionBg} rounded-2xl p-6 border backdrop-blur-md mb-8`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${textColors.primary}`}>Learning Progress</h3>
            <span className={`text-sm ${textColors.secondary}`}>
              {completedSections.size + (currentSection === sections.length - 1 ? 1 : 0)} of{' '}
              {sections.length} completed
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
          {currentSection === 0 && currentSectionData.content.methods && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Info className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Concepts
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
                  Collection Methods
                </h3>
                <div className="grid gap-6">
                  {currentSectionData.content.methods.map((method, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <h4 className={`text-lg font-semibold ${accentColorClass} mb-3`}>
                        {method.name}
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Purpose:
                          </h5>
                          <p className={`text-sm ${textColors.secondary} mb-3`}>{method.purpose}</p>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Process:
                          </h5>
                          <p className={`text-sm ${textColors.secondary}`}>{method.process}</p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Equipment:
                          </h5>
                          <div className="space-y-1 mb-3">
                            {method.equipment.map((item, idx) => (
                              <div
                                key={idx}
                                className={`text-sm ${textColors.secondary} flex items-center`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}
                                />
                                {item}
                              </div>
                            ))}
                          </div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Considerations:
                          </h5>
                          <p
                            className={`text-sm ${theme === 'light' ? 'text-orange-700' : 'text-orange-400'}`}
                          >
                            {method.considerations}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                  🌟 Best Practices
                </h4>
                <div className="grid gap-3">
                  {currentSectionData.content.best_practices?.map((practice, index) => (
                    <div key={index} className={`flex items-start`}>
                      <CheckCircle
                        className={`w-4 h-4 ${theme === 'light' ? 'text-green-600' : 'text-green-400'} mt-1 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary}`}>{practice}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentSection === 1 && currentSectionData.content.major_platforms && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Info className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Benefits
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
                  Major Platforms
                </h3>
                <div className="grid gap-6">
                  {currentSectionData.content.major_platforms.map((platform, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold ${accentColorClass}`}>
                          {platform.name}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/30 text-purple-400'}`}
                        >
                          {platform.specimens}
                        </span>
                      </div>
                      <p className={`${textColors.secondary} mb-4`}>{platform.description}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Key Features:
                          </h5>
                          <div className="space-y-1">
                            {platform.features.map((feature, idx) => (
                              <div
                                key={idx}
                                className={`text-sm ${textColors.secondary} flex items-center`}
                              >
                                <CheckCircle className="w-3 h-3 mr-2" />
                                {feature}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Common Use Cases:
                          </h5>
                          <div className="space-y-1">
                            {platform.use_cases.map((useCase, idx) => (
                              <div
                                key={idx}
                                className={`text-sm ${textColors.secondary} flex items-center`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}
                                />
                                {useCase}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                <h4
                  className={`text-lg font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <FileText className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Digitization Process
                </h4>
                <div className="grid gap-4">
                  {currentSectionData.content.digitization_process?.map((step, index) => (
                    <div
                      key={index}
                      className={`border-l-4 ${theme === 'light' ? 'border-blue-400' : 'border-blue-500'} pl-4`}
                    >
                      <h5 className={`font-semibold ${accentColorClass} mb-1`}>
                        {index + 1}. {step.step}
                      </h5>
                      <p className={`text-sm ${textColors.secondary} mb-2`}>{step.description}</p>
                      <p className={`text-xs ${textColors.primary} italic`}>
                        💡 {step.considerations}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentSection === 2 && currentSectionData.content.plant_barcodes && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Dna className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Key Concepts
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
                  Plant DNA Barcodes
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.plant_barcodes.map((barcode, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold ${accentColorClass}`}>
                          {barcode.gene}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-400'}`}
                        >
                          {barcode.region}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Characteristics:
                          </h5>
                          <p className={`text-sm ${textColors.secondary}`}>
                            {barcode.characteristics}
                          </p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Resolution:
                          </h5>
                          <p className={`text-sm ${textColors.secondary}`}>{barcode.resolution}</p>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                            Applications:
                          </h5>
                          <div className="space-y-1">
                            {barcode.applications.map((app, idx) => (
                              <p key={idx} className={`text-xs ${textColors.secondary}`}>
                                {app}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className={`text-xl font-semibold ${textColors.primary} mb-4`}>
                  DNA Barcoding Workflow
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.workflow?.map((phase, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className={`text-lg font-semibold ${accentColorClass}`}>
                          {phase.phase}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/30 text-blue-400'}`}
                        >
                          {phase.time}
                        </span>
                      </div>
                      <p className={`${textColors.secondary} mb-3`}>{phase.description}</p>
                      <div className="grid md:grid-cols-3 gap-2">
                        {phase.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className={`text-sm ${textColors.primary} flex items-center`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}
                            />
                            {detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                  Research Applications
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {currentSectionData.content.applications?.map((app, index) => (
                    <div key={index} className={`border ${innerCardBorder} rounded-lg p-4`}>
                      <h5 className={`font-semibold ${accentColorClass} mb-2`}>{app.category}</h5>
                      <div className="space-y-1 mb-2">
                        {app.examples.map((example, idx) => (
                          <div
                            key={idx}
                            className={`text-sm ${textColors.secondary} flex items-center`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-green-400' : 'bg-green-500'} mr-2`}
                            />
                            {example}
                          </div>
                        ))}
                      </div>
                      <p
                        className={`text-xs ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'} italic`}
                      >
                        Benefits: {app.benefits}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentSection === 3 && currentSectionData.content.survey_methods && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <MapPin className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Core Principles
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
                  Survey Methods
                </h3>
                <div className="grid gap-6">
                  {currentSectionData.content.survey_methods.map((method, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <h4 className={`text-lg font-semibold ${accentColorClass} mb-3`}>
                        {method.method}
                      </h4>
                      <p className={`${textColors.secondary} mb-4`}>{method.description}</p>
                      <div className="grid lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                              Plot Size:
                            </h5>
                            <p className={`text-sm ${textColors.secondary}`}>{method.plot_size}</p>
                          </div>
                          <div>
                            <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                              Measurements:
                            </h5>
                            <div className="space-y-1">
                              {method.measurements.map((measurement, idx) => (
                                <div
                                  key={idx}
                                  className={`text-sm ${textColors.secondary} flex items-center`}
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}
                                  />
                                  {measurement}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                              Best For:
                            </h5>
                            <p
                              className={`text-sm ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}
                            >
                              {method.best_for}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                              Advantages:
                            </h5>
                            <div className="space-y-1">
                              {method.advantages.map((advantage, idx) => (
                                <div
                                  key={idx}
                                  className={`text-sm ${textColors.secondary} flex items-center`}
                                >
                                  <CheckCircle className="w-3 h-3 mr-2 text-green-500" />
                                  {advantage}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h5 className={`text-sm font-medium ${textColors.primary} mb-1`}>
                              Limitations:
                            </h5>
                            <div className="space-y-1">
                              {method.limitations.map((limitation, idx) => (
                                <div
                                  key={idx}
                                  className={`text-sm ${textColors.secondary} flex items-center`}
                                >
                                  <div
                                    className={`w-3 h-3 rounded-full border-2 border-orange-400 mr-2 flex-shrink-0`}
                                  />
                                  {limitation}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className={`text-xl font-semibold ${textColors.primary} mb-4`}>
                  Environmental Data Collection
                </h3>
                <div className="grid gap-4">
                  {currentSectionData.content.environmental_data?.map((category, index) => (
                    <div
                      key={index}
                      className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                    >
                      <h4 className={`text-lg font-semibold ${accentColorClass} mb-3`}>
                        {category.category}
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Measurements:
                          </h5>
                          <div className="space-y-1">
                            {category.measurements.map((measurement, idx) => (
                              <p key={idx} className={`text-sm ${textColors.secondary}`}>
                                {measurement}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Equipment:
                          </h5>
                          <div className="space-y-1">
                            {category.equipment.map((equipment, idx) => (
                              <p key={idx} className={`text-sm ${textColors.secondary}`}>
                                {equipment}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                            Importance:
                          </h5>
                          <p
                            className={`text-sm ${theme === 'light' ? 'text-blue-700' : 'text-blue-400'}`}
                          >
                            {category.importance}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                  Common Data Analysis Approaches
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {currentSectionData.content.data_analysis?.map((analysis, index) => (
                    <div key={index} className={`flex items-start`}>
                      <div
                        className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-purple-500' : 'bg-purple-400'} mt-2 mr-3 flex-shrink-0`}
                      />
                      <span className={`${textColors.secondary} text-sm`}>{analysis}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentSection === 4 && currentSectionData.content.technologies && (
            <>
              <div className="mb-6">
                <h3
                  className={`text-xl font-semibold ${textColors.primary} mb-4 flex items-center`}
                >
                  <Camera className={`w-5 h-5 ${accentColorClass} mr-2`} />
                  Technology Revolution
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

              <div className="space-y-8">
                {currentSectionData.content.technologies.map((techCategory, categoryIndex) => (
                  <div
                    key={categoryIndex}
                    className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}
                  >
                    <h3 className={`text-xl font-semibold ${accentColorClass} mb-4`}>
                      {techCategory.category}
                    </h3>
                    <div className="grid gap-6">
                      {techCategory.tools.map((tool, toolIndex) => (
                        <div key={toolIndex} className={`border ${innerCardBorder} rounded-lg p-4`}>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className={`text-lg font-semibold ${textColors.primary}`}>
                              {tool.name}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-gray-100 text-gray-700' : 'bg-gray-800 text-gray-300'}`}
                            >
                              {tool.resolution}
                            </span>
                          </div>
                          <p className={`${textColors.secondary} mb-3`}>{tool.description}</p>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                                Applications:
                              </h5>
                              <div className="space-y-1">
                                {tool.applications.map((app, appIndex) => (
                                  <div
                                    key={appIndex}
                                    className={`text-sm ${textColors.secondary} flex items-center`}
                                  >
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-blue-400' : 'bg-blue-500'} mr-2`}
                                    />
                                    {app}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h5 className={`text-sm font-medium ${textColors.primary} mb-2`}>
                                Examples/Tools:
                              </h5>
                              <div className="space-y-1">
                                {tool.examples.map((example, exampleIndex) => (
                                  <div
                                    key={exampleIndex}
                                    className={`text-sm ${theme === 'light' ? 'text-green-700' : 'text-green-400'} flex items-center`}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-2" />
                                    {example}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                  <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                    🚀 Integration Benefits
                  </h4>
                  <div className="space-y-2">
                    {currentSectionData.content.integration_benefits?.map((benefit, index) => (
                      <div key={index} className={`flex items-start`}>
                        <CheckCircle
                          className={`w-4 h-4 ${theme === 'light' ? 'text-green-600' : 'text-green-400'} mt-1 mr-3 flex-shrink-0`}
                        />
                        <span className={`${textColors.secondary} text-sm`}>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${innerCardBg} rounded-xl p-6 border ${innerCardBorder}`}>
                  <h4 className={`text-lg font-semibold ${textColors.primary} mb-4`}>
                    🔮 Future Directions
                  </h4>
                  <div className="space-y-2">
                    {currentSectionData.content.future_directions?.map((direction, index) => (
                      <div key={index} className={`flex items-start`}>
                        <div
                          className={`w-2 h-2 rounded-full ${theme === 'light' ? 'bg-purple-500' : 'bg-purple-400'} mt-2 mr-3 flex-shrink-0`}
                        />
                        <span className={`${textColors.secondary} text-sm`}>{direction}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
