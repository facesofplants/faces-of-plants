'use client';

import React, { type ReactNode } from 'react';

import { useAccessControl } from '../hooks/useAccessControl';

import UpgradePrompt from './UpgradePrompt';
import UsageLimiter from './UsageLimiter';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  showUsageLimit?: boolean;
  blockInteraction?: boolean;
  className?: string;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  showUsageLimit = true,
  blockInteraction = false,
  className = '',
}: FeatureGateProps) {
  const { canPerformAction, getUpgradeMessage, usageLimits } = useAccessControl();

  const canAccess = canPerformAction(feature);
  const upgradeMessage = getUpgradeMessage(feature);

  // For usage-limited features, show usage information
  const isUsageLimited = feature === 'search' || feature === 'map' || feature === 'export';
  const usageInfo = isUsageLimited ? usageLimits[feature as keyof typeof usageLimits] : null;

  if (!canAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return <UpgradePrompt message={upgradeMessage} className={className} />;
    }

    return null;
  }

  // If user can access but has usage limits, show with usage information
  if (isUsageLimited && usageInfo && showUsageLimit) {
    return (
      <div className={`relative ${className}`}>
        {children}
        {usageInfo.isLimited && (
          <UsageLimiter
            action={feature as 'search' | 'map' | 'export'}
            current={usageInfo.current}
            limit={usageInfo.limit}
            showWarning={usageInfo.current >= usageInfo.limit * 0.8} // Show warning at 80%
            blockWhenExceeded={blockInteraction}
          />
        )}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

export default FeatureGate;
