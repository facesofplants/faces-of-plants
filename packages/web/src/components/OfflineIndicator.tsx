'use client';

import { CheckCircle, Warning } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';

import { useMode } from '../context/ModeContext';

/**
 * Shows online/offline status indicator.
 */
export function OfflineIndicator() {
  const { theme } = useMode();
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setShowBanner(false), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showBanner) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <CheckCircle size={16} />
          <span>Back online</span>
        </>
      ) : (
        <>
          <Warning size={16} />
          <span>Offline — using cached data</span>
        </>
      )}
    </div>
  );
}
