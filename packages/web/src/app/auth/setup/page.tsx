'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { useAuth } from '../../../context/AuthContext';
import { useMode, getBackgroundGradient } from '../../../context/ModeContext';

export default function SetupPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { theme } = useMode();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/');
      } else if (user?.setupCompleted) {
        router.push('/');
      } else {
        // Auto-complete setup for citizen mode
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className={`min-h-screen ${getBackgroundGradient('citizen', theme)} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'}>Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}

export const dynamic = 'force-dynamic';
