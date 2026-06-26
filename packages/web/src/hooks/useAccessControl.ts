import { useSession } from 'next-auth/react';

import { type UserType } from '../types/auth';

export interface AccessControlPermissions {
  canSearch: boolean;
  canUseMap: boolean;
  canExportData: boolean;
  canCreateCollections: boolean;
  canAccessAnalytics: boolean;
  canAccessAdvancedFeatures: boolean;
  canAccessAPI: boolean;
}

export interface UsageLimits {
  search: { current: number; limit: number; isLimited: boolean };
  map: { current: number; limit: number; isLimited: boolean };
  export: { current: number; limit: number; isLimited: boolean };
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

const unlimitedLimits: UsageLimits = {
  search: { current: 0, limit: Infinity, isLimited: false },
  map: { current: 0, limit: Infinity, isLimited: false },
  export: { current: 0, limit: Infinity, isLimited: false },
};

export function useAccessControl(): AccessControlData {
  const { data: session, status } = useSession();

  const isAuthenticated = status === 'authenticated';
  const isAnonymous = !isAuthenticated;
  const userType: UserType = isAuthenticated ? 'citizen' : 'anonymous';

  return {
    usageLimits: unlimitedLimits,
    userType,
    isAuthenticated,
    isAnonymous,
    canPerformAction: () => true,
    getRemainingUsage: () => Infinity,
    getUpgradeMessage: () => '',
    shouldShowUpgradePrompt: () => false,
  };
}
