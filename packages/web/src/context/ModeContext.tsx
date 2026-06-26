'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fop-preferences';

function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'light';
    const prefs = JSON.parse(raw);
    return prefs.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prefs = raw ? JSON.parse(raw) : {};
    prefs.theme = theme;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

interface ModeContextProps {
  mode: 'citizen';
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ModeContext = createContext<ModeContextProps | undefined>(undefined);

export const ModeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(loadTheme());
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    persistTheme(t);
  }, []);

  return (
    <ModeContext.Provider value={{ mode: 'citizen', theme, setTheme }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {throw new Error('useMode must be used within a ModeProvider');}
  return context;
};

export const getBackgroundGradient = (_mode: 'citizen', theme: Theme): string => {
  return theme === 'light'
    ? 'bg-gradient-to-br from-green-50 via-blue-50 to-purple-50'
    : 'bg-gradient-to-br from-emerald-900 via-slate-900 to-gray-900';
};

export const getTextColors = (theme: Theme) => {
  return {
    primary: theme === 'light' ? 'text-gray-900' : 'text-white',
    secondary: theme === 'light' ? 'text-gray-600' : 'text-gray-300',
    muted: theme === 'light' ? 'text-gray-500' : 'text-gray-400',
  };
};

export const getCardBackground = (theme: Theme): string => {
  return theme === 'light' ? 'bg-white/70 border-white/30' : 'bg-gray-900/50 border-gray-700/20';
};
