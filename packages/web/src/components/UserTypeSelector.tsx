'use client';

import { Leaf, Microscope, ArrowRight, Check, Shield } from '@phosphor-icons/react';
import React, { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { type UserType } from '../types/auth';

interface UserTypeSelectorProps {
  onComplete?: (userType: UserType) => void;
  showSkip?: boolean;
  showAdmin?: boolean; // Add option to show admin role
}

export function UserTypeSelector({
  onComplete,
  showSkip = false,
  showAdmin = false,
}: UserTypeSelectorProps) {
  const { updateUserType } = useAuth();
  const { theme } = useMode();
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (userType: UserType) => {
    setIsLoading(true);
    setSelectedType(userType);
    console.log('UserTypeSelector: Selected user type:', userType);
    try {
      await updateUserType(userType);
      console.log('UserTypeSelector: Successfully updated user type to:', userType);
      onComplete?.(userType);
    } catch (error) {
      console.error('Error updating user type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const userTypeOptions = [
    {
      type: 'citizen' as UserType,
      icon: <Leaf className="w-8 h-8" />,
      title: 'Citizen Scientist',
      description: 'Perfect for nature enthusiasts, educators, and community scientists',
      features: [
        'Simplified plant identification tools',
        'Local flora discovery guides',
        'Educational content and learning paths',
        'Community-friendly interface',
        'Personal observation tracking',
      ],
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
    },
    {
      type: 'researcher' as UserType,
      icon: <Microscope className="w-8 h-8" />,
      title: 'Researcher',
      description: 'Designed for scientists, academics, and research institutions',
      features: [
        'Advanced data analysis tools',
        'Full scientific dataset access',
        'Research-grade visualizations',
        'API access and bulk operations',
        'Collaboration and sharing tools',
      ],
      gradient: 'from-blue-500 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    },
    ...(showAdmin
      ? [
          {
            type: 'admin' as UserType,
            icon: <Shield className="w-8 h-8" />,
            title: 'Administrator',
            description: 'System administration and platform management',
            features: [
              'Full system administration access',
              'User management and analytics',
              'API key and data source management',
              'System monitoring and configuration',
              'Platform observability tools',
            ],
            gradient: 'from-purple-500 to-violet-600',
            bgGradient: 'from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20',
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2
          className={`text-3xl font-bold mb-4 ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}
        >
          Choose Your Profile Type
        </h2>
        <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
          Select the profile that best matches how you&apos;ll use Faces of Plants
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {userTypeOptions.map((option) => (
          <div
            key={option.type}
            className={`relative cursor-pointer transition-all duration-300 ${
              selectedType === option.type ? 'transform scale-105 shadow-xl' : 'hover:shadow-lg'
            }`}
            onClick={() => setSelectedType(option.type)}
          >
            <div
              className={`bg-gradient-to-br ${option.bgGradient} rounded-xl p-6 border-2 ${
                selectedType === option.type
                  ? `border-transparent bg-gradient-to-r ${option.gradient}`
                  : theme === 'light'
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              {selectedType === option.type && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                </div>
              )}

              <div className={`${selectedType === option.type ? 'text-white' : ''}`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div
                    className={`p-3 rounded-lg ${
                      selectedType === option.type
                        ? 'bg-white/20'
                        : theme === 'light'
                          ? 'bg-white/60'
                          : 'bg-gray-800/60'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{option.title}</h3>
                    <p
                      className={`text-sm ${
                        selectedType === option.type
                          ? 'text-white/80'
                          : theme === 'light'
                            ? 'text-gray-600'
                            : 'text-gray-400'
                      }`}
                    >
                      {option.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {option.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Check
                        className={`w-4 h-4 mt-0.5 ${
                          selectedType === option.type ? 'text-white/80' : 'text-green-500'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          selectedType === option.type
                            ? 'text-white/90'
                            : theme === 'light'
                              ? 'text-gray-600'
                              : 'text-gray-300'
                        }`}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        {selectedType && (
          <button
            onClick={() => handleSelect(selectedType)}
            disabled={isLoading}
            className={`inline-flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : `bg-gradient-to-r ${
                    selectedType === 'citizen'
                      ? 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                      : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                  } text-white shadow-lg hover:shadow-xl`
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Setting up...</span>
              </>
            ) : (
              <>
                <span>
                  Continue as {selectedType === 'citizen' ? 'Citizen Scientist' : 'Researcher'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        {showSkip && (
          <button
            onClick={() => onComplete?.('citizen')} // Default to citizen if skipped
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

export default UserTypeSelector;
