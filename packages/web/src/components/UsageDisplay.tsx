'use client';

import { TrendUp, Warning, CheckCircle } from '@phosphor-icons/react';
import React from 'react';

import { useMode } from '../context/ModeContext';
import { useAccessControl } from '../hooks/useAccessControl';

interface UsageDisplayProps {
  action: 'search' | 'map' | 'export';
  showIcon?: boolean;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function UsageDisplay({
  action,
  showIcon = true,
  variant = 'compact',
  className = '',
}: UsageDisplayProps) {
  const { usageLimits, isAuthenticated } = useAccessControl();
  const { theme } = useMode();

  const usage = usageLimits[action];

  if (!usage.isLimited || isAuthenticated) {
    if (variant === 'detailed') {
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          {showIcon && <CheckCircle className="w-4 h-4 text-green-500" />}
          <span className={`text-sm ${theme === 'light' ? 'text-green-600' : 'text-green-400'}`}>
            Unlimited
          </span>
        </div>
      );
    }
    return null;
  }

  const percentage = (usage.current / usage.limit) * 100;
  const remaining = usage.limit - usage.current;
  const isNearLimit = percentage >= 80;
  const isAtLimit = usage.current >= usage.limit;

  const getStatusColor = () => {
    if (isAtLimit) {return 'text-red-600 dark:text-red-400';}
    if (isNearLimit) {return 'text-yellow-600 dark:text-yellow-400';}
    return theme === 'light' ? 'text-gray-600' : 'text-gray-400';
  };

  const getIcon = () => {
    if (isAtLimit) {return <Warning className="w-4 h-4" />;}
    return <TrendUp className="w-4 h-4" />;
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-1 text-sm ${getStatusColor()} ${className}`}>
        {showIcon && getIcon()}
        <span>
          {remaining}/{usage.limit}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          {showIcon && <div className={getStatusColor()}>{getIcon()}</div>}
          <span
            className={`text-sm font-medium ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}
          >
            {action.charAt(0).toUpperCase() + action.slice(1)}
          </span>
        </div>
        <span className={`text-sm ${getStatusColor()}`}>
          {usage.current}/{usage.limit}
        </span>
      </div>

      <div
        className={`w-full h-2 rounded-full overflow-hidden ${
          theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
        }`}
      >
        <div
          className={`h-full transition-all duration-300 ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {remaining <= 5 && remaining > 0 && (
        <p className={`text-xs mt-1 ${getStatusColor()}`}>{remaining} remaining</p>
      )}

      {isAtLimit && <p className="text-xs mt-1 text-red-600 dark:text-red-400">Limit reached</p>}
    </div>
  );
}

export default UsageDisplay;
