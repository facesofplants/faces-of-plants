'use client';

import { User, SignOut, CaretDown } from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import React, { useState, useRef, useEffect } from 'react';

import { useMode } from '../context/ModeContext';


interface AuthButtonProps {
  variant?: 'default' | 'compact';
}

export function AuthButton({ variant = 'default' }: AuthButtonProps) {
  console.log('AuthButton: Component rendering');

  const { data: session, status } = useSession();
  console.log('AuthButton: useSession status:', status, 'session data:', session);

  const { theme } = useMode();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  useEffect(() => {
    console.log('AuthButton: useEffect for click outside listener running');
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    console.log('AuthButton: Rendering loading state');
    return (
      <div
        className={`animate-pulse ${variant === 'compact' ? 'w-8 h-8' : 'w-10 h-10'} rounded-full ${
          theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
        }`}
      />
    );
  }

  if (isAuthenticated && user) {
    console.log('AuthButton: Rendering authenticated state');
    return (
      <div className="relative" ref={dropdownRef}>
        {/* Profile Button */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all border ${
            theme === 'light'
              ? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-500'
          }`}
          title="User menu"
        >
          {/* Profile Image or Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User avatar'}
                className="w-full h-full object-cover"
                width={32}
                height={32}
                priority
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center text-sm font-medium ${
                  theme === 'light' ? 'bg-gray-300 text-gray-700' : 'bg-gray-600 text-gray-300'
                }`}
              >
                {user.firstName?.charAt(0)?.toUpperCase() ||
                  user.name?.charAt(0)?.toUpperCase() ||
                  'U'}
              </div>
            )}
          </div>

          {/* Dropdown Arrow */}
          <CaretDown
            size={16}
            className={`transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div
            className={`absolute right-0 mt-2 w-64 rounded-lg shadow-lg border z-50 ${
              theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-600'
            }`}
          >
            {/* Profile Section */}
            <div
              className={`px-4 py-3 border-b ${
                theme === 'light' ? 'border-gray-200' : 'border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center flex-shrink-0">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || 'User avatar'}
                      className="w-full h-full object-cover"
                      width={40}
                      height={40}
                      priority
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center text-lg font-medium ${
                        theme === 'light'
                          ? 'bg-gray-300 text-gray-700'
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {user.firstName?.charAt(0)?.toUpperCase() ||
                        user.name?.charAt(0)?.toUpperCase() ||
                        'U'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      theme === 'light' ? 'text-gray-900' : 'text-gray-100'
                    }`}
                  >
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.name}
                  </p>
                  {user.email &&
                    (user.firstName && user.lastName
                      ? user.email !== `${user.firstName} ${user.lastName}`
                      : user.email !== user.name) && (
                      <p
                        className={`text-xs truncate ${
                          theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        {user.email}
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {/* Profile Link */}
              <Link href="/profile">
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
                    theme === 'light'
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <User size={16} className="mr-3" />
                  Profile
                </button>
              </Link>

              {/* Separator */}
              <div
                className={`my-1 border-t ${
                  theme === 'light' ? 'border-gray-200' : 'border-gray-600'
                }`}
              />

              {/* Sign Out */}
              <button
                onClick={() => {
                  console.log('AuthButton: Signing out...');
                  setIsDropdownOpen(false);
                  signOut();
                }}
                className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
                  theme === 'light'
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-red-400 hover:bg-red-900/20'
                }`}
              >
                <SignOut size={16} className="mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  console.log('AuthButton: Rendering unauthenticated state');
  return (
    <button
      onClick={() => {
        console.log('AuthButton: Signing in...');
        signIn();
      }}
      className={`flex items-center justify-center space-x-3 px-6 py-2.5 rounded-lg font-medium transition-all border ${
        theme === 'light'
          ? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 shadow-sm hover:shadow-md'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-500'
      }`}
      disabled={isLoading}
    >
      {variant === 'default' && <span>Sign in</span>}
    </button>
  );
}

export default AuthButton;
