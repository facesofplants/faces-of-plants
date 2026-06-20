'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';

import RegistrationWelcome from '../../../components/RegistrationWelcome';
import UserTypeSelector from '../../../components/UserTypeSelector';
import { useAuth } from '../../../context/AuthContext';
import { useMode, getBackgroundGradient } from '../../../context/ModeContext';
import { type UserType } from '../../../types/auth';

type SetupStep = 'welcome' | 'userType' | 'complete';

export default function SetupPage() {
  const { user, isLoading, isAuthenticated, completeSetup } = useAuth();
  const { mode, theme } = useMode();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Redirect to home if not authenticated
        router.push('/');
      } else if (user?.setupCompleted) {
        // Redirect to home if setup is already completed
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleWelcomeContinue = () => {
    setCurrentStep('userType');
  };

  const handleUserTypeComplete = async (userType: UserType) => {
    try {
      // Pass the selected user type to completeSetup
      await completeSetup(userType);
      setCurrentStep('complete');

      // Redirect to home after a brief delay to show completion
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Error completing setup:', error);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${getBackgroundGradient(mode, theme)} flex items-center justify-center`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'welcome' ||
                currentStep === 'userType' ||
                currentStep === 'complete'
                  ? 'bg-blue-600 text-white'
                  : theme === 'light'
                    ? 'bg-gray-200 text-gray-600'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              1
            </div>
            <div
              className={`flex-1 h-1 mx-2 ${
                currentStep === 'userType' || currentStep === 'complete'
                  ? 'bg-blue-600'
                  : theme === 'light'
                    ? 'bg-gray-200'
                    : 'bg-gray-700'
              }`}
            ></div>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'userType' || currentStep === 'complete'
                  ? 'bg-blue-600 text-white'
                  : theme === 'light'
                    ? 'bg-gray-200 text-gray-600'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              2
            </div>
            <div
              className={`flex-1 h-1 mx-2 ${
                currentStep === 'complete'
                  ? 'bg-blue-600'
                  : theme === 'light'
                    ? 'bg-gray-200'
                    : 'bg-gray-700'
              }`}
            ></div>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 'complete'
                  ? 'bg-green-600 text-white'
                  : theme === 'light'
                    ? 'bg-gray-200 text-gray-600'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              ✓
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Welcome</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Profile</span>
            <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>Complete</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-6xl mx-auto">
          {currentStep === 'welcome' && <RegistrationWelcome onContinue={handleWelcomeContinue} />}

          {currentStep === 'userType' && (
            <UserTypeSelector onComplete={handleUserTypeComplete} showSkip={false} />
          )}

          {currentStep === 'complete' && (
            <div className="text-center py-12">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2
                  className={`text-3xl font-bold mb-4 ${
                    theme === 'light' ? 'text-gray-900' : 'text-white'
                  }`}
                >
                  Setup Complete!
                </h2>
                <p className={`text-lg ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
                  Your profile has been configured. Redirecting you to the homepage...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
