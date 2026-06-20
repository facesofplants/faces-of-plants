'use client';
import {
  Leaf,
  Users,
  MapPin,
  BookOpen,
  List,
  X,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import Link from 'next/link';
import React, { useState } from 'react';

import { useMode } from '../context/ModeContext';

const navLinks = [
  { href: '/maps', label: 'Maps', icon: <MapPin size={20} /> },
  { href: '/education', label: 'Education', icon: <BookOpen size={20} /> },
];

export default function NavBar() {
  const { mode, setMode, theme, setTheme } = useMode();
  const isCitizen = mode === 'citizen';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Theme-aware colors
  const navBg = theme === 'light' ? 'bg-white/90' : 'bg-black';
  const borderColor = theme === 'light' ? 'border-gray-200/50' : 'border-white/10';
  const logoColor =
    theme === 'light'
      ? isCitizen
        ? 'text-green-600'
        : 'text-blue-600'
      : isCitizen
        ? 'text-green-300'
        : 'text-blue-300';
  const linkColor =
    theme === 'light'
      ? isCitizen
        ? 'text-gray-700 hover:text-green-600'
        : 'text-gray-700 hover:text-blue-600'
      : isCitizen
        ? 'text-green-100 hover:text-green-300'
        : 'text-blue-100 hover:text-blue-300';

  return (
    <nav className={`${navBg} backdrop-blur-lg border-b ${borderColor} sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center space-x-2">
              <Leaf size={32} className={logoColor} />
              <span className={`text-xl lg:text-2xl font-bold ${logoColor}`}>
                <span className="hidden sm:inline">Faces of Plants</span>
                <span className="sm:hidden">FoP</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${linkColor} transition-all`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop Controls */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light'
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Mode Toggle */}
            <div
              className={`flex items-center space-x-2 rounded-full p-1 border ${
                theme === 'light'
                  ? 'bg-gray-100/60 border-gray-200'
                  : 'bg-gray-800/60 border-white/10'
              }`}
            >
              <button
                onClick={() => setMode('citizen')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
                  isCitizen
                    ? 'bg-green-500/80 text-white shadow-md'
                    : `${theme === 'light' ? 'text-gray-600 hover:text-green-600' : 'text-gray-300 hover:text-green-400'}`
                }`}
              >
                <Users size={16} />
                <span>Citizen</span>
              </button>
              <button
                onClick={() => setMode('researcher')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
                  !isCitizen
                    ? 'bg-blue-500/80 text-white shadow-md'
                    : `${theme === 'light' ? 'text-gray-600 hover:text-blue-600' : 'text-gray-300 hover:text-blue-400'}`
                }`}
              >
                <Users size={16} />
                <span>Researcher</span>
              </button>
            </div>

            <Link
              href="/profile"
              className={`p-2 rounded-full transition-colors ${
                theme === 'light'
                  ? isCitizen
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-blue-600 hover:bg-blue-50'
                  : isCitizen
                    ? 'text-green-200 hover:bg-green-700/50'
                    : 'text-blue-200 hover:bg-blue-700/50'
              }`}
            >
              <Users size={20} />
            </Link>
          </div>

          {/* Mobile Controls */}
          <div className="lg:hidden flex items-center space-x-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light'
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Compact Mode Toggle for Mobile */}
            <div
              className={`flex items-center rounded-full p-1 border ${
                theme === 'light'
                  ? 'bg-gray-100/60 border-gray-200'
                  : 'bg-gray-800/60 border-white/10'
              }`}
            >
              <button
                onClick={() => setMode('citizen')}
                className={`p-2 rounded-full text-xs font-medium transition-all ${
                  isCitizen
                    ? 'bg-green-500/80 text-white shadow-md'
                    : `${theme === 'light' ? 'text-gray-600 hover:text-green-600' : 'text-gray-300 hover:text-green-400'}`
                }`}
                title="Citizen Mode"
              >
                {/* MIGRATED: Using Phosphor Leaf instead of emoji */}
                <Leaf size={16} />
              </button>
              <button
                onClick={() => setMode('researcher')}
                className={`p-2 rounded-full text-xs font-medium transition-all ${
                  !isCitizen
                    ? 'bg-blue-500/80 text-white shadow-md'
                    : `${theme === 'light' ? 'text-gray-600 hover:text-blue-600' : 'text-gray-300 hover:text-blue-400'}`
                }`}
                title="Researcher Mode"
              >
                {/* MIGRATED: Keeping microscope emoji for now - could use <Microscope /> */}
                🔬
              </button>
            </div>

            <button
              onClick={toggleMobileMenu}
              className={`p-2 rounded-md transition-colors ${
                theme === 'light'
                  ? isCitizen
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-blue-600 hover:bg-blue-50'
                  : isCitizen
                    ? 'text-green-200 hover:bg-green-700/50'
                    : 'text-blue-200 hover:bg-blue-700/50'
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div
              className={`px-2 pt-2 pb-3 space-y-1 backdrop-blur-lg border-t ${
                theme === 'light' ? 'bg-white/95 border-gray-200' : 'bg-black/95 border-white/10'
              }`}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-all ${
                    theme === 'light'
                      ? isCitizen
                        ? 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      : isCitizen
                        ? 'text-green-100 hover:bg-green-700/30 hover:text-green-300'
                        : 'text-blue-100 hover:bg-blue-700/30 hover:text-blue-300'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-all ${
                  theme === 'light'
                    ? isCitizen
                      ? 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                    : isCitizen
                      ? 'text-green-100 hover:bg-green-700/30 hover:text-green-300'
                      : 'text-blue-100 hover:bg-blue-700/30 hover:text-blue-300'
                }`}
              >
                <Users size={20} />
                <span>Profile</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
