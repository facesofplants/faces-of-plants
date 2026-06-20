import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import {
  getFeatureAccess,
  getFeatureLimit,
  getUpgradeMessage as getConfigUpgradeMessage,
} from '../config/features';
import { type UserType, type AnonymousSession } from '../types/auth';

export interface AccessControlPermissions {
  canSearch: boolean;
  canUseMap: boolean;
  canExportData: boolean;
  canCreateCollections: boolean;
  canAccessAnalytics: boolean;
  canAccessAdvancedFeatures: boolean;
  canAccessAPI: boolean;
  searchLimit?: number;
  mapInteractionLimit?: number;
  exportLimit?: number;
}

export interface UsageLimits {
  search: {
    current: number;
    limit: number;
    isLimited: boolean;
  };
  map: {
    current: number;
    limit: number;
    isLimited: boolean;
  };
  export: {
    current: number;
    limit: number;
    isLimited: boolean;
  };
}

export interface AccessControlData {
  usageLimits: UsageLimits;
  userType: UserType;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  canPerformAction: (action: string) => boolean;
  getRemainingUsage: (action: 'search' | 'map' | 'export') => number;
  getUpgradeMessage: (action: string) => string;
  shouldShowUpgradePrompt: () => boolean;
}

export function useAccessControl(): AccessControlData {
  const { data: session, status } = useSession();
  const [anonymousSession, setAnonymousSession] = useState<AnonymousSession | null>(null);

  const isAuthenticated = status === 'authenticated';
  const isAnonymous = !isAuthenticated;
  const userType: UserType =
    (session?.user as any)?.userType || (isAuthenticated ? 'citizen' : 'anonymous');

  const initAnonymousSession = useCallback((): AnonymousSession => {
    const newSession: AnonymousSession = {
      sessionId: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date().toISOString(),
      searchCount: 0,
      mapInteractions: 0,
      lastActivity: new Date().toISOString(),
      usageLimits: {
        maxSearches: 10,
        maxMapInteractions: 50,
      },
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('anonymousSession', JSON.stringify(newSession));
    }

    setAnonymousSession(newSession);
    return newSession;
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !anonymousSession) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('anonymousSession');
        if (stored) {
          try {
            const session = JSON.parse(stored);
            const sessionAge = Date.now() - new Date(session.startTime).getTime();
            if (sessionAge < 24 * 60 * 60 * 1000) {
              setAnonymousSession(session);
            } else {
              initAnonymousSession();
            }
          } catch {
            initAnonymousSession();
          }
        } else {
          initAnonymousSession();
        }
      }
    }
  }, [isAuthenticated, anonymousSession, initAnonymousSession]);

  const getUsageLimits = (): UsageLimits => {
    if (isAuthenticated) {
      return {
        search: {
          current: 0,
          limit: getFeatureLimit('search', userType) || Infinity,
          isLimited: getFeatureLimit('search', userType) !== undefined,
        },
        map: {
          current: 0,
          limit: getFeatureLimit('map', userType) || Infinity,
          isLimited: getFeatureLimit('map', userType) !== undefined,
        },
        export: {
          current: 0,
          limit: getFeatureLimit('export', userType) || Infinity,
          isLimited: getFeatureLimit('export', userType) !== undefined,
        },
      };
    }

    if (isAnonymous && anonymousSession) {
      return {
        search: {
          current: anonymousSession.searchCount,
          limit: anonymousSession.usageLimits.maxSearches,
          isLimited: true,
        },
        map: {
          current: anonymousSession.mapInteractions,
          limit: anonymousSession.usageLimits.maxMapInteractions,
          isLimited: true,
        },
        export: {
          current: 0,
          limit: 0,
          isLimited: true,
        },
      };
    }

    // Default anonymous limits
    return {
      search: {
        current: 0,
        limit: getFeatureLimit('search', 'anonymous') || 10,
        isLimited: true,
      },
      map: {
        current: 0,
        limit: getFeatureLimit('map', 'anonymous') || 50,
        isLimited: true,
      },
      export: {
        current: 0,
        limit: 0,
        isLimited: true,
      },
    };
  };

  const usageLimits = getUsageLimits();

  const canPerformAction = (action: string): boolean => {
    const hasAccess = getFeatureAccess(action, userType);
    if (!hasAccess) {return false;}

    if (action === 'search' || action === 'map' || action === 'export') {
      const usage = usageLimits[action as keyof typeof usageLimits];
      return usage.current < usage.limit;
    }

    return true;
  };

  const getRemainingUsage = (action: 'search' | 'map' | 'export'): number => {
    const usage = usageLimits[action];
    return Math.max(0, usage.limit - usage.current);
  };

  const getUpgradeMessage = (action: string): string => {
    return getConfigUpgradeMessage(action, userType);
  };

  const shouldShowUpgradePrompt = (): boolean => {
    if (isAnonymous) {
      const searchUsage = usageLimits.search;
      const mapUsage = usageLimits.map;

      const searchThreshold = searchUsage.limit * 0.7;
      const mapThreshold = mapUsage.limit * 0.7;

      return searchUsage.current >= searchThreshold || mapUsage.current >= mapThreshold;
    }

    if (userType === 'citizen') {
      return Math.random() < 0.1; // 10% chance to show
    }

    return false;
  };

  return {
    usageLimits,
    userType,
    isAuthenticated,
    isAnonymous,
    canPerformAction,
    getRemainingUsage,
    getUpgradeMessage,
    shouldShowUpgradePrompt,
  };
}

export default useAccessControl;
