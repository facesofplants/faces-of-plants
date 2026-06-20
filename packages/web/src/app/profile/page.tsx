'use client';

import { User, Gear, Heart } from '@phosphor-icons/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useEffect } from 'react';

import { useMode, getBackgroundGradient, getTextColors } from '../../context/ModeContext';

interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  id?: string;
  firstName?: string;
  lastName?: string;
}

interface UserProfile {
  userId: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  firstName?: string;
  lastName?: string;
  userType: 'citizen' | 'researcher' | 'admin' | 'anonymous';
}

export default function ProfilePage() {
  const router = useRouter();
  const { mode, theme } = useMode();
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const user: UserProfile | null =
    isAuthenticated && session?.user
      ? {
          userId: (session.user as SessionUser).id || session.user.email || 'unknown',
          username: session.user.name || session.user.email || 'unknown',
          email: session.user.email,
          name: session.user.name,
          firstName: (session.user as SessionUser).firstName,
          lastName: (session.user as SessionUser).lastName,
          picture: (session.user as SessionUser).image || session.user.image,
          userType: 'citizen',
        }
      : null;

  const userType: UserProfile['userType'] = (isAuthenticated ? 'citizen' : 'anonymous') as UserProfile['userType'];

  const isCitizen = mode === 'citizen';
  const textColors = getTextColors(theme);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const accentColorClass =
    theme === 'light'
      ? isCitizen ? 'text-green-600' : 'text-blue-600'
      : isCitizen ? 'text-green-500' : 'text-blue-500';

  const sectionBg = theme === 'light' ? 'bg-white/70 border-gray-200/50' : 'bg-gray-900/50 border-gray-700/20';
  const innerCardBg = theme === 'light' ? 'bg-gray-50/80 border-gray-200/40' : 'bg-gray-900/70 border-gray-700/30';
  const innerCardBorder =
    theme === 'light'
      ? isCitizen ? 'border-green-200/60' : 'border-blue-200/60'
      : isCitizen ? 'border-green-700/30' : 'border-blue-700/30';
  const listTextColor = theme === 'light' ? 'text-gray-700' : 'text-gray-300';

  const userTypeName = userType === 'researcher' ? 'Researcher' : userType === 'citizen' ? 'Citizen Scientist' : userType === 'admin' ? 'Administrator' : 'Anonymous';
  const userTypeColor =
    (userType as string) === 'researcher' ? 'text-blue-600' :
    (userType as string) === 'citizen' ? 'text-green-600' :
    (userType as string) === 'admin' ? 'text-purple-600' : 'text-gray-600';

  return (
    <div className={`min-h-screen ${getBackgroundGradient(mode, theme)}`}>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${textColors.primary} mb-2 flex items-center justify-center gap-3`}>
            <User size={32} className={accentColorClass} />
            Profile
          </h1>
          <p className={`text-sm ${textColors.secondary}`}>
            Manage your preferences and account settings.
          </p>
        </div>

        <div className={`rounded-2xl p-6 border backdrop-blur-md mb-8 ${sectionBg}`}>
          <h2 className={`text-lg font-semibold ${accentColorClass} mb-4 flex items-center gap-2`}>
            <Gear size={20} /> User Settings
          </h2>

          {isAuthenticated && user && (
            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder} mb-4`}>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                  {user.picture ? (
                    <Image src={user.picture} alt={user.name || 'Profile'} className="w-full h-full object-cover" width={48} height={48} priority />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-lg font-medium ${theme === 'light' ? 'bg-gray-300 text-gray-700' : 'bg-gray-600 text-gray-300'}`}>
                      {(user.name || user.username)?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className={`text-base font-semibold ${textColors.primary} truncate`}>
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name || user.username}
                  </h3>
                  <p className={`text-sm ${textColors.secondary} truncate`}>{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
              <h4 className={`text-sm font-medium ${accentColorClass} mb-2`}>Account Type</h4>
              <p className={`text-sm ${listTextColor}`}>
                <span className={`font-medium ${userTypeColor}`}>{userTypeName}</span>
              </p>
            </div>

            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
              <h4 className={`text-sm font-medium ${accentColorClass} mb-2`}>Interface Theme</h4>
              <p className={`text-sm ${listTextColor}`}>
                <span className={`font-medium ${mode === 'citizen' ? 'text-green-600' : 'text-blue-600'}`}>
                  {mode === 'citizen' ? 'Citizen' : 'Researcher'}
                </span>
                {' · '}
                {theme === 'light' ? 'Light' : 'Dark'}
              </p>
            </div>

            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
              <h4 className={`text-sm font-medium ${accentColorClass} mb-2`}>Display</h4>
              <div className={`text-sm ${listTextColor} space-y-1`}>
                <p>Language: English</p>
                <p>Default DB: GBIF</p>
              </div>
            </div>

            <div className={`${innerCardBg} rounded-lg p-4 border ${innerCardBorder}`}>
              <h4 className={`text-sm font-medium ${accentColorClass} mb-2`}>Data</h4>
              <div className={`text-sm ${listTextColor} space-y-1`}>
                <p>Result Limit: 50/page</p>
                <p>Auto-save: Enabled</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-6 border backdrop-blur-md ${sectionBg}`}>
          <h2 className={`text-lg font-semibold ${accentColorClass} mb-4 flex items-center gap-2`}>
            <Heart size={20} /> Saved Collections
          </h2>
          <p className={`${listTextColor} text-center py-4 text-sm`}>
            No saved collections yet. Start exploring and save your favorite species!
          </p>
        </div>
      </section>
    </div>
  );
}

export const dynamic = 'force-dynamic';
