export type UserType = 'anonymous' | 'citizen' | 'researcher' | 'admin';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  notifications?: {
    email?: boolean;
    inApp?: boolean;
  };
  privacy?: {
    shareObservations?: boolean;
    publicProfile?: boolean;
  };
  citizen?: {
    favoriteRegions?: string[];
    interestAreas?: string[];
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  researcher?: {
    institution?: string;
    researchAreas?: string[];
    dataUsageGoals?: string[];
    publicationPreferences?: {
      citationStyle?: string;
      includeGBIFAttribution?: boolean;
    };
  };
  admin?: {
    dashboardPreferences?: {
      defaultTimeRange?: '1h' | '24h' | '7d' | '30d';
      refreshInterval?: number;
      notificationSettings?: {
        emailAlerts?: boolean;
        systemAlerts?: boolean;
        performanceAlerts?: boolean;
      };
    };
  };
}

export interface UserProfile {
  userId: string;
  username: string;
  email?: string;
  name?: string;
  picture?: string;
  firstName?: string;
  lastName?: string;
  userType: UserType;
  registrationDate: string;
  lastLogin: string;
  preferences: UserPreferences;
  isFirstLogin?: boolean;
  setupCompleted?: boolean;
}

export interface AnonymousSession {
  sessionId: string;
  startTime: string;
  searchCount: number;
  mapInteractions: number;
  lastActivity: string;
  usageLimits: {
    maxSearches: number;
    maxMapInteractions: number;
  };
}

export interface AuthContextType {
  user: UserProfile | null;
  anonymousSession: AnonymousSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  userType: UserType;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: (forceRefresh?: boolean) => Promise<void>;
  updateUserType: (userType: UserType) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  completeSetup: (userType?: UserType, preferences?: Partial<UserPreferences>) => Promise<void>;
  // Anonymous user functions
  initAnonymousSession: () => AnonymousSession;
  updateAnonymousUsage: (action: 'search' | 'map') => void;
  checkUsageLimit: (action: 'search' | 'map') => boolean;
}

// Admin Dashboard Types
export interface SystemMetrics {
  activeUsers: number;
  totalUsers: number;
  apiCalls: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
}

export interface UserAnalytics {
  totalUsers: number;
  usersByType: Record<UserType, number>;
  newUsersToday: number;
  activeUsersToday: number;
  userGrowth: Array<{ date: string; count: number }>;
}

export interface QueryAnalytics {
  totalQueries: number;
  queriesPerDay: Array<{ date: string; count: number }>;
  popularQueries: Array<{ query: string; count: number }>;
  avgResponseTime: number;
  errorRate: number;
  queryTypes: Record<string, number>;
}

export interface APIKeyInfo {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  rateLimitStatus: {
    remaining: number;
    limit: number;
    resetTime?: string;
  };
}

export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'gbif' | 'eol' | 'inaturalist' | 'custom';
  isActive: boolean;
  endpoint: string;
  apiKey?: string;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  lastHealthCheck?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface AdminConfiguration {
  systemSettings: {
    maintenanceMode: boolean;
    rateLimiting: {
      anonymous: number;
      citizen: number;
      researcher: number;
    };
    cacheTTL: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  featureFlags: Record<string, boolean>;
  notifications: {
    emailEnabled: boolean;
    slackWebhook?: string;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      queueSize: number;
    };
  };
}
