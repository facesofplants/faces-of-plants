'use client';

import { Warning, TrendUp, Users, X } from '@phosphor-icons/react';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

interface UsageLimiterProps {
  action: 'search' | 'map' | 'export';
  current: number;
  limit: number;
  showWarning?: boolean;
  blockWhenExceeded?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

export function UsageLimiter({
  action,
  current,
  limit,
  showWarning = false,
  blockWhenExceeded = false,
  onUpgrade,
  className = '',
}: UsageLimiterProps) {
  const { isAnonymous, signInWithGoogle } = useAuth();
  const { theme } = useMode();
  const [isDismissed, setIsDismissed] = useState(false);

  const remaining = Math.max(0, limit - current);
  const percentage = Math.min(100, (current / limit) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = current >= limit;

  const getActionText = () => {
    if (action === 'search') {return 'searches';}
    if (action === 'map') {return 'map interactions';}
    if (action === 'export') {return 'exports';}
    return 'actions';
  };

  const handleUpgrade = async () => {
    if (isAnonymous) {
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error('Error signing in:', error);
      }
    } else {
      onUpgrade?.();
    }
  };

  // Don't show if dismissed or if there's no limit
  if (isDismissed || limit === Infinity) {
    return null;
  }

  // Only show warning if near limit or at limit
  if (!showWarning && !isAtLimit) {
    return null;
  }

  const getStatusColor = () => {
    if (isAtLimit) {
      return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700/30';
    } else if (isNearLimit) {
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/30';
    }
    return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30';
  };

  const getProgressColor = () => {
    if (isAtLimit) {return 'bg-red-500';}
    if (isNearLimit) {return 'bg-yellow-500';}
    return 'bg-blue-500';
  };

  const getIconColor = () => {
    if (isAtLimit) {
      return 'text-red-600 dark:text-red-400';
    } else if (isNearLimit) {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-blue-600 dark:text-blue-400';
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 ${getIconColor()}`}>
            {isAtLimit ? <Warning className="w-5 h-5" /> : <TrendUp className="w-5 h-5" />}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4
                className={`font-medium text-sm ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}
              >
                {isAtLimit
                  ? `${getActionText()} limit reached`
                  : `${remaining} ${getActionText()} remaining`}
              </h4>
              <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                {current}/{limit}
              </span>
            </div>

            {/* Progress bar */}
            <div
              className={`w-full h-2 rounded-full overflow-hidden ${
                theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
              }`}
            >
              <div
                className={`h-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>

            <p className={`text-xs mt-2 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
              {isAtLimit
                ? `You've reached your ${getActionText()} limit. Sign up for unlimited access!`
                : `You're using ${Math.round(percentage)}% of your ${getActionText()} limit.`}
            </p>

            {(isAtLimit || (isNearLimit && isAnonymous)) && (
              <button
                onClick={handleUpgrade}
                className="inline-flex items-center space-x-1 mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium transition-colors"
              >
                <Users className="w-3 h-3" />
                <span>{isAnonymous ? 'Sign Up Free' : 'Upgrade Plan'}</span>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className={`p-1 rounded transition-colors ${
            theme === 'light'
              ? 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
              : 'hover:bg-gray-700 text-gray-500 hover:text-gray-300'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {blockWhenExceeded && isAtLimit && (
        <div className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Warning className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <p className={`font-medium mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
              Limit Exceeded
            </p>
            <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
              Sign up to continue using this feature
            </p>
            <button
              onClick={handleUpgrade}
              className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsageLimiter;
