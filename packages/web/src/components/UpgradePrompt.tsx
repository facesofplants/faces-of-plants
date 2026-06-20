'use client';

import { ArrowRight, X, Sparkle, Users, Crown } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';


interface UpgradePromptProps {
  message: string;
  className?: string;
  variant?: 'inline' | 'modal' | 'banner';
  showDismiss?: boolean;
  onDismiss?: () => void;
}

export function UpgradePrompt({
  message,
  className = '',
  variant = 'inline',
  showDismiss = true,
  onDismiss,
}: UpgradePromptProps) {
  const { isAnonymous, userType, signInWithGoogle } = useAuth();
  const { theme } = useMode();
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);

  const handleAction = async () => {
    if (isAnonymous) {
      // Sign up flow
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error('Error signing in:', error);
      }
    } else if (userType === 'citizen') {
      // Upgrade to researcher flow
      router.push('/profile?upgrade=true');
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  const getActionText = () => {
    if (isAnonymous) {
      return 'Sign Up Free';
    } else if (userType === 'citizen') {
      return 'Upgrade to Researcher';
    }
    return 'Learn More';
  };

  const getIcon = () => {
    if (isAnonymous) {
      return <Users className="w-5 h-5" />;
    } else if (userType === 'citizen') {
      return <Crown className="w-5 h-5" />;
    }
    return <Sparkle className="w-5 h-5" />;
  };

  const baseClasses = `rounded-lg border transition-all duration-200 ${className}`;

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div
          className={`max-w-md w-full p-6 ${
            theme === 'light' ? 'bg-white' : 'bg-gray-800'
          } rounded-xl shadow-xl`}
        >
          {showDismiss && (
            <button
              onClick={handleDismiss}
              className={`float-right ${
                theme === 'light'
                  ? 'text-gray-400 hover:text-gray-600'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-start space-x-3">
            <div
              className={`p-2 rounded-lg ${
                isAnonymous
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}
            >
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3
                className={`font-semibold mb-2 ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}
              >
                {isAnonymous ? 'Unlock Full Access' : 'Upgrade Required'}
              </h3>
              <p
                className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}
              >
                {message}
              </p>
              <button
                onClick={handleAction}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAnonymous
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span>{getActionText()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={`${baseClasses} p-4 ${
          isAnonymous
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700/30'
            : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${
                isAnonymous
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}
            >
              {getIcon()}
            </div>
            <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-200'}`}>
              {message}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAction}
              className={`inline-flex items-center space-x-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                isAnonymous
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <span>{getActionText()}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            {showDismiss && (
              <button
                onClick={handleDismiss}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'light'
                    ? 'hover:bg-gray-100 text-gray-400'
                    : 'hover:bg-gray-700 text-gray-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div
      className={`${baseClasses} p-6 text-center ${
        isAnonymous
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700/30'
          : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isAnonymous
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        }`}
      >
        {getIcon()}
      </div>
      <h3 className={`font-semibold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
        {isAnonymous ? 'Unlock This Feature' : 'Upgrade Required'}
      </h3>
      <p className={`text-sm mb-4 ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
        {message}
      </p>
      <button
        onClick={handleAction}
        className={`inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
          isAnonymous
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <span>{getActionText()}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default UpgradePrompt;
