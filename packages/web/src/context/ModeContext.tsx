'use client';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Mode = 'citizen' | 'researcher';
type Theme = 'light' | 'dark';

interface ModeContextProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ModeContext = createContext<ModeContextProps | undefined>(undefined);

export const ModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<Mode>('citizen');
  const [theme, setTheme] = useState<Theme>('light');

  // Sync mode with user type from authentication
  useEffect(() => {
    // Import useAuth dynamically to avoid circular dependencies
    // const syncModeWithUserType = async () => {
    //   try {
    //     const { useAuth } = await import('./AuthContext');
    //     // This is a hack to get the current user type
    //     // We'll need to create a proper sync mechanism
    //   } catch (error) {
    //     console.warn('Could not sync mode with user type:', error);
    //   }
    // };
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, theme, setTheme }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {throw new Error('useMode must be used within a ModeProvider');}
  return context;
};

// Helper function to get background gradients
export const getBackgroundGradient = (mode: Mode, theme: Theme): string => {
  if (theme === 'light') {
    return mode === 'citizen'
      ? 'bg-gradient-to-br from-green-50 via-blue-50 to-purple-50'
      : 'bg-gradient-to-br from-blue-50 via-green-50 to-purple-50';
  } else {
    return mode === 'citizen'
      ? 'bg-gradient-to-br from-emerald-900 via-slate-900 to-gray-900'
      : 'bg-gradient-to-br from-blue-900 via-slate-900 to-gray-900';
  }
};

// Helper function to get text colors
export const getTextColors = (theme: Theme) => {
  return {
    primary: theme === 'light' ? 'text-gray-900' : 'text-white',
    secondary: theme === 'light' ? 'text-gray-600' : 'text-gray-300',
    muted: theme === 'light' ? 'text-gray-500' : 'text-gray-400',
  };
};

// Helper function to get card backgrounds
export const getCardBackground = (theme: Theme): string => {
  return theme === 'light' ? 'bg-white/70 border-white/30' : 'bg-gray-900/50 border-gray-700/20';
};
