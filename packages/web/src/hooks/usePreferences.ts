'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'fop-preferences';

export interface UserPreferences {
  theme: 'light' | 'dark';
  mapLayer: 'standard' | 'terrain' | 'satellite';
}

const DEFAULTS: UserPreferences = {
  theme: 'light',
  mapLayer: 'satellite',
};

function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setPrefs(loadPreferences());
    setLoaded(true);
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }, []);

  return { prefs, loaded, updatePreference };
}
