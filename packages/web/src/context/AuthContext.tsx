'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import {
  type UserProfile,
  type AnonymousSession,
  type AuthContextType,
  type UserType,
  type UserPreferences,
} from '../types/auth';

// Define a type for the extended session user
interface ExtendedSessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  // Add any other properties you expect from your Auth.js session user
  userId?: string;
  username?: string;
  picture?: string;
  userType?: UserType; // Added
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  console.log('AuthContext: session status', status, 'session data:', session);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [anonymousSession, setAnonymousSession] = useState<AnonymousSession | null>(null);
  const isLoading = status === 'loading';

  // Derived state
  const isAuthenticated = status === 'authenticated';
  const isAnonymous = !isAuthenticated && !!anonymousSession;
  const userType: UserType = user?.userType || (isAuthenticated ? 'citizen' : 'anonymous');

  // Function to map Auth.js session to UserProfile
  const mapSessionToUserProfile = useCallback((sessionUser: ExtendedSessionUser): UserProfile => {
    return {
      userId: sessionUser.userId || sessionUser.email || sessionUser.name || 'unknown', // Fallback for userId
      username: sessionUser.username || sessionUser.email || sessionUser.name || 'unknown', // Fallback for username
      email: sessionUser.email || undefined,
      name: sessionUser.name || undefined,
      picture: sessionUser.picture || sessionUser.image || undefined,
      userType: sessionUser.userType || 'citizen', // Use userType from session, default to citizen
      registrationDate: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      isFirstLogin: false, // Assume not first login if authenticated via Auth.js
      setupCompleted: true, // Assume setup completed for now
      preferences: {
        theme: 'auto',
        notifications: { email: true, inApp: true },
        privacy: { shareObservations: false, publicProfile: false },
      },
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && session?.user) {
      const mappedUser = mapSessionToUserProfile(session.user as ExtendedSessionUser);
      setUser(mappedUser);
    } else if (!isAuthenticated) {
      setUser(null);
    }
  }, [isAuthenticated, session, mapSessionToUserProfile]);

  // Aggressive sign-out logic
  const aggressiveSignOut = async () => {
    console.log('Starting aggressive local sign-out...');
    setUser(null); // Clear user state immediately

    if (typeof window !== 'undefined') {
      console.log('Clearing ALL browser storage...');
      try {
        sessionStorage.clear();
        console.log('Session storage cleared');
      } catch (e) {
        console.warn('Could not clear session storage:', e);
      }
      try {
        localStorage.clear();
        console.log('Local storage cleared');
      } catch (e) {
        console.warn('Could not clear local storage:', e);
      }
      try {
        if ('indexedDB' in window) {
          const dbDeleteRequest = indexedDB.deleteDatabase('amplify-datastore'); // Still clear if Amplify was used
          dbDeleteRequest.onsuccess = () => console.log('IndexedDB cleared');
        }
      } catch (e) {
        console.warn('Could not clear IndexedDB:', e);
      }
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => {
              registration.unregister();
            });
          });
        }
      } catch (e) {
        console.warn('Could not clear service worker:', e);
      }
      try {
        const cookies = document.cookie.split(';');
        cookies.forEach((cookie) => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (
            name.toLowerCase().includes('auth') ||
            name.toLowerCase().includes('cognito') ||
            name.toLowerCase().includes('amplify') ||
            name.toLowerCase().includes('next-auth')
          ) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
            console.log(`Cleared cookie: ${name}`);
          }
        });
      } catch (e) {
        console.warn('Could not clear cookies:', e);
      }
      console.log('Complete storage clearing completed');
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log('Forcing page reload to ensure clean state...');
      window.location.reload();
    }
    console.log('Complete local sign-out finished - NO Auth.js calls made');
  };

  const handleSignInWithGoogle = async () => {
    await signIn('google'); // Use Auth.js signIn with 'google' provider
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false }); // Sign out from Auth.js, prevent immediate redirect
    await aggressiveSignOut(); // Then perform aggressive local sign-out
  };

  // Anonymous session management (re-integrated from original AuthContext)
  const initAnonymousSession = useCallback((): AnonymousSession => {
    const session: AnonymousSession = {
      sessionId: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date().toISOString(),
      searchCount: 0,
      mapInteractions: 0,
      lastActivity: new Date().toISOString(),
      usageLimits: {
        maxSearches: 10,
        maxMapInteractions: 50,
      },
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('anonymousSession', JSON.stringify(session));
    }

    setAnonymousSession(session);
    return session;
  }, []);

  const updateAnonymousUsage = useCallback(
    (action: 'search' | 'map') => {
      if (!anonymousSession && !isAuthenticated) {
        initAnonymousSession();
        return;
      }

      if (anonymousSession) {
        const updatedSession = {
          ...anonymousSession,
          [action === 'search' ? 'searchCount' : 'mapInteractions']:
            anonymousSession[action === 'search' ? 'searchCount' : 'mapInteractions'] + 1,
          lastActivity: new Date().toISOString(),
        };

        setAnonymousSession(updatedSession);

        if (typeof window !== 'undefined') {
          localStorage.setItem('anonymousSession', JSON.stringify(updatedSession));
        }
      }
    },
    [anonymousSession, isAuthenticated, initAnonymousSession],
  );

  const checkUsageLimit = useCallback(
    (action: 'search' | 'map'): boolean => {
      if (isAuthenticated) {return true;} // No limits for authenticated users

      if (!anonymousSession) {
        initAnonymousSession();
        return true; // First action is always allowed
      }

      const current =
        action === 'search' ? anonymousSession.searchCount : anonymousSession.mapInteractions;
      const limit =
        action === 'search'
          ? anonymousSession.usageLimits.maxSearches
          : anonymousSession.usageLimits.maxMapInteractions;

      return current < limit;
    },
    [anonymousSession, isAuthenticated, initAnonymousSession],
  );

  useEffect(() => {
    if (!isAuthenticated && !anonymousSession) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('anonymousSession');
        if (stored) {
          try {
            const session = JSON.parse(stored);
            const sessionAge = Date.now() - new Date(session.startTime).getTime();
            if (sessionAge < 24 * 60 * 60 * 1000) {
              setAnonymousSession(session);
            } else {
              initAnonymousSession();
            }
          } catch {
            initAnonymousSession();
          }
        } else {
          initAnonymousSession();
        }
      }
    }
  }, [isAuthenticated, anonymousSession, initAnonymousSession]);

  // Placeholder for refreshAuth - Auth.js handles session refresh internally
  const refreshAuth = useCallback(async () => {
    console.log('refreshAuth called: Auth.js handles session refresh internally.');
    // You might want to re-fetch session data if needed, but useSession usually keeps it up to date.
    // If you need to force a re-fetch, you can use `getSession()` from 'next-auth/react'
  }, []);

  // Placeholder for user profile management (these would typically interact with a backend API)
  const updateUserType = useCallback(
    async (newUserType: UserType): Promise<void> => {
      if (!user) {throw new Error('User must be authenticated to update user type');}
      setUser((prev) => (prev ? { ...prev, userType: newUserType } : null));
    },
    [user],
  );

  const updatePreferences = useCallback(
    async (newPreferences: Partial<UserPreferences>): Promise<void> => {
      if (!user) {throw new Error('User must be authenticated to update preferences');}
      setUser((prev) =>
        prev ? { ...prev, preferences: { ...prev.preferences, ...newPreferences } } : null,
      );
    },
    [user],
  );

  const completeSetup = useCallback(
    async (userType?: UserType, preferences?: Partial<UserPreferences>): Promise<void> => {
      if (!user) {throw new Error('User must be authenticated to complete setup');}
      setUser((prev) =>
        prev
          ? {
              ...prev,
              setupCompleted: true,
              isFirstLogin: false,
              userType: userType || prev.userType || 'citizen',
              preferences: preferences ? { ...prev.preferences, ...preferences } : prev.preferences,
            }
          : null,
      );
    },
    [user],
  );

  const value: AuthContextType = {
    user,
    anonymousSession,
    isLoading,
    isAuthenticated,
    isAnonymous,
    userType,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    refreshAuth,
    updateUserType,
    updatePreferences,
    completeSetup,
    initAnonymousSession,
    updateAnonymousUsage,
    checkUsageLimit,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
