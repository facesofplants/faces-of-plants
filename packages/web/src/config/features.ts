import { type UserType } from '../types/auth';

export interface FeatureConfig {
  name: string;
  description: string;
  anonymousAccess: boolean;
  citizenAccess: boolean;
  researcherAccess: boolean;
  adminAccess: boolean;
  usageLimits?: {
    anonymous?: number;
    citizen?: number;
    researcher?: number;
    admin?: number;
  };
  upgradeMessage: {
    anonymous: string;
    citizen: string;
    researcher?: string;
  };
}

export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  search: {
    name: 'Search',
    description: 'Natural language search for plant species',
    anonymousAccess: true,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    usageLimits: {
      anonymous: 10,
      citizen: undefined, // unlimited
      researcher: undefined, // unlimited
      admin: undefined, // unlimited
    },
    upgradeMessage: {
      anonymous: 'Sign up for free to get unlimited searches and save your discoveries!',
      citizen: 'Upgrade to Researcher for advanced search capabilities and API access.',
    },
  },

  map: {
    name: 'Interactive Map',
    description: 'Visualize species occurrences on an interactive map',
    anonymousAccess: true,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    usageLimits: {
      anonymous: 50,
      citizen: undefined,
      researcher: undefined,
      admin: undefined,
    },
    upgradeMessage: {
      anonymous:
        'Create a free account to unlock all map features and save your favorite locations!',
      citizen: 'Upgrade to Researcher for advanced map analytics and data export tools.',
    },
  },

  export: {
    name: 'Data Export',
    description: 'Export species data in various formats',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    usageLimits: {
      anonymous: 0,
      citizen: 100, // per month
      researcher: 1000, // per month
      admin: undefined, // unlimited
    },
    upgradeMessage: {
      anonymous: 'Sign up for free to export your data and create collections!',
      citizen: 'Upgrade to Researcher for higher export limits and API access.',
    },
  },

  collections: {
    name: 'Collections',
    description: 'Create and manage personal species collections',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Create a free account to save your favorite species and build collections!',
      citizen: 'Your collections are ready to use! Start organizing your discoveries.',
    },
  },

  analytics: {
    name: 'Analytics',
    description: 'View detailed analytics and insights',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Create a free account to access personal analytics and insights!',
      citizen: 'Upgrade to Researcher for advanced analytics and research tools.',
    },
  },

  api: {
    name: 'API Access',
    description: 'Programmatic access to biodiversity data',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for a Researcher account to access our powerful API!',
      citizen: 'Upgrade to Researcher to unlock API access and advanced features.',
    },
  },

  advanced: {
    name: 'Advanced Features',
    description: 'Research-grade tools and advanced functionality',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for a Researcher account to access advanced features!',
      citizen: 'Upgrade to Researcher to unlock advanced research tools and capabilities.',
    },
  },

  heatmaps: {
    name: 'Heatmap Visualization',
    description: 'Density visualization for species distribution patterns',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for free to unlock heatmap visualizations!',
      citizen: 'Upgrade to Researcher for advanced heatmap analytics.',
    },
  },

  temporal: {
    name: 'Temporal Analysis',
    description: 'Time-based filtering and trend analysis',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Create a free account to access temporal analysis tools!',
      citizen: 'Upgrade to Researcher for advanced temporal analytics.',
    },
  },

  filters: {
    name: 'Advanced Filters',
    description: 'Complex filtering and search criteria',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for free to access advanced filtering options!',
      citizen: 'Upgrade to Researcher for the most advanced filtering capabilities.',
    },
  },

  pathology: {
    name: 'Plant Disease Detection',
    description: 'Detect plant diseases from leaf photos using AI',
    anonymousAccess: true,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    usageLimits: {
      anonymous: 5,
      citizen: 20,
      researcher: undefined,
      admin: undefined,
    },
    upgradeMessage: {
      anonymous: 'Sign up for free to get more disease detections!',
      citizen: 'Upgrade to Researcher for unlimited detections.',
    },
  },

  corridors: {
    name: 'Ecological Corridors',
    description: 'Find wildlife corridors between habitat areas',
    anonymousAccess: false,
    citizenAccess: true,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for free to access corridor analysis!',
      citizen: 'Upgrade to Researcher for advanced corridor analytics.',
    },
  },

  sdm: {
    name: 'Species Distribution Modeling',
    description: 'Predict species habitat suitability under climate change',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: true,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'Sign up for a Researcher account to access SDM tools.',
      citizen: 'Upgrade to Researcher to unlock distribution modeling.',
    },
  },

  // Admin-only features
  admin_dashboard: {
    name: 'Admin Dashboard',
    description: 'System administration and monitoring dashboard',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: false,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'This feature is restricted to administrators.',
      citizen: 'This feature is restricted to administrators.',
      researcher: 'This feature is restricted to administrators.',
    },
  },

  system_monitoring: {
    name: 'System Monitoring',
    description: 'Real-time system performance and health monitoring',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: false,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'This feature is restricted to administrators.',
      citizen: 'This feature is restricted to administrators.',
      researcher: 'This feature is restricted to administrators.',
    },
  },

  user_management: {
    name: 'User Management',
    description: 'Manage user accounts, roles, and permissions',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: false,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'This feature is restricted to administrators.',
      citizen: 'This feature is restricted to administrators.',
      researcher: 'This feature is restricted to administrators.',
    },
  },

  api_management: {
    name: 'API Management',
    description: 'Manage API keys, rate limits, and data source configurations',
    anonymousAccess: false,
    citizenAccess: false,
    researcherAccess: false,
    adminAccess: true,
    upgradeMessage: {
      anonymous: 'This feature is restricted to administrators.',
      citizen: 'This feature is restricted to administrators.',
      researcher: 'This feature is restricted to administrators.',
    },
  },
};

export function getFeatureAccess(feature: string, userType: UserType): boolean {
  const config = FEATURE_CONFIG[feature];
  if (!config) {return false;}

  switch (userType) {
    case 'anonymous':
      return config.anonymousAccess;
    case 'citizen':
      return config.citizenAccess;
    case 'researcher':
      return config.researcherAccess;
    case 'admin':
      return config.adminAccess;
    default:
      return false;
  }
}

export function getFeatureLimit(feature: string, userType: UserType): number | undefined {
  const config = FEATURE_CONFIG[feature];
  if (!config || !config.usageLimits) {return undefined;}

  return config.usageLimits[userType];
}

export function getUpgradeMessage(feature: string, userType: UserType): string {
  const config = FEATURE_CONFIG[feature];
  if (!config) {return 'Upgrade your account to access this feature!';}

  if (userType === 'anonymous') {
    return config.upgradeMessage.anonymous;
  } else if (userType === 'citizen') {
    return config.upgradeMessage.citizen;
  } else if (userType === 'researcher' && config.upgradeMessage.researcher) {
    return config.upgradeMessage.researcher;
  }

  return 'This feature is available in your plan!';
}

export default FEATURE_CONFIG;
