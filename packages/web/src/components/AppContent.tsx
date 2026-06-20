'use client';

import React from 'react';

import { useServiceWorker } from '../hooks/useServiceWorker';

import Footer from './Footer';
import { OfflineIndicator } from './OfflineIndicator';
import NavBar from './NavBar';

interface AppContentProps {
  children: React.ReactNode;
}

const AppContent: React.FC<AppContentProps> = ({ children }) => {
  useServiceWorker();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
      <OfflineIndicator />
    </div>
  );
};

export default AppContent;
