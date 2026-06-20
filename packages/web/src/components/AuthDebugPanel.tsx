'use client';

import React from 'react';

import { useAuth } from '../context/AuthContext';

export function AuthDebugPanel() {
  const { user, isAuthenticated, isLoading, refreshAuth } = useAuth();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm max-w-md">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
        <div>User: {user ? JSON.stringify(user, null, 2) : 'None'}</div>
        <button
          onClick={() => refreshAuth()}
          className="mt-2 px-2 py-1 bg-blue-600 rounded text-xs"
        >
          Refresh Auth
        </button>
      </div>
    </div>
  );
}
