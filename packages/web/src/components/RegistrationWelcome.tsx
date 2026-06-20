'use client';

import { Leaf, Sparkle, Users, Globe } from '@phosphor-icons/react';
import React from 'react';

import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

interface RegistrationWelcomeProps {
  onContinue: () => void;
}

export function RegistrationWelcome({ onContinue }: RegistrationWelcomeProps) {
  const { user } = useAuth();
  const { theme } = useMode();

  const benefits = [
    {
      icon: <Sparkle className="w-6 h-6" />,
      title: 'Unlimited Access',
      description: 'No limits on searches, map interactions, or data exploration',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Personal Collections',
      description: 'Save and organize your favorite species and observations',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Global Community',
      description: 'Connect with other nature enthusiasts and researchers worldwide',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <div className="mb-8">
        <div className="flex justify-center mb-4">
          <div
            className={`p-4 rounded-full ${theme === 'light' ? 'bg-green-100' : 'bg-green-900/30'}`}
          >
            <Leaf className="w-12 h-12 text-green-600" />
          </div>
        </div>

        <h1
          className={`text-3xl font-bold mb-4 ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}
        >
          Welcome to Faces of Plants, {user?.name || user?.username}!
        </h1>

        <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
          You&apos;re now part of the global biodiversity community. Let&apos;s set up your profile
          to give you the best possible experience.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {benefits.map((benefit, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              theme === 'light'
                ? 'bg-white/60 border border-gray-200'
                : 'bg-gray-800/60 border border-gray-600'
            }`}
          >
            <div
              className={`flex justify-center mb-3 ${
                theme === 'light' ? 'text-green-600' : 'text-green-400'
              }`}
            >
              {benefit.icon}
            </div>
            <h3
              className={`font-semibold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}
            >
              {benefit.title}
            </h3>
            <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
              {benefit.description}
            </p>
          </div>
        ))}
      </div>

      <div
        className={`p-6 rounded-lg mb-8 ${
          theme === 'light'
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-blue-900/20 border border-blue-700/30'
        }`}
      >
        <h3
          className={`font-semibold mb-2 ${theme === 'light' ? 'text-blue-900' : 'text-blue-300'}`}
        >
          What&apos;s Next?
        </h3>
        <p className={`text-sm ${theme === 'light' ? 'text-blue-800' : 'text-blue-200'}`}>
          We&apos;ll help you choose the right profile type and customize your experience. This will
          only take a minute and you can always change these settings later.
        </p>
      </div>

      <button
        onClick={onContinue}
        className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
      >
        <span>Let&apos;s Get Started</span>
        <Sparkle className="w-4 h-4" />
      </button>
    </div>
  );
}

export default RegistrationWelcome;
