import {
  Leaf,
  MapPin,
  List,
  X,
  Sun,
  Moon,
  BookOpen,
  Info,
} from '@phosphor-icons/react';
import Link from 'next/link';
import React, { useState } from 'react';

import { useMode } from '../context/ModeContext';

import AuthButton from './AuthButton';

export default function NavBar() {
  const { theme, setTheme } = useMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const navLinks = [
    { href: '/explore', label: 'Explore', icon: <MapPin size={20} /> },
    { href: '/education', label: 'Learn', icon: <BookOpen size={20} /> },
    { href: '/about', label: 'About', icon: <Info size={20} /> },
  ];

  const navBg = theme === 'light' ? 'bg-white/90' : 'bg-black';
  const borderColor = theme === 'light' ? 'border-gray-200/50' : 'border-white/10';
  const logoColor = theme === 'light' ? 'text-green-600' : 'text-green-300';
  const linkColor = theme === 'light'
    ? 'text-gray-700 hover:text-green-600'
    : 'text-green-100 hover:text-green-300';

  return (
    <nav className={`${navBg} backdrop-blur-lg border-b ${borderColor} sticky top-0 z-[9999]`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center space-x-2">
              <Leaf className={`w-7 lg:w-8 h-7 lg:h-8 ${logoColor}`} />
              <span className={`text-lg lg:text-xl xl:text-2xl font-bold ${logoColor}`}>
                <span className="hidden sm:inline">Faces of Plants</span>
                <span className="sm:hidden">FoP</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 xl:space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-1 xl:space-x-2 px-2 xl:px-3 py-2 rounded-md text-sm font-medium ${linkColor} transition-all`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop Controls */}
          <div className="hidden lg:flex items-center space-x-2 xl:space-x-4">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light' ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-800'
              }`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <AuthButton variant="default" />
          </div>

          {/* Mobile Controls */}
          <div className="lg:hidden flex items-center space-x-2">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`p-2 rounded-full transition-colors ${
                theme === 'light' ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={toggleMobileMenu}
              className={`p-2 rounded-md transition-colors ${
                theme === 'light' ? 'text-green-600 hover:bg-green-50' : 'text-green-200 hover:bg-green-700/50'
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div className={`px-2 pt-2 pb-3 space-y-1 backdrop-blur-lg border-t ${
              theme === 'light' ? 'bg-white/95 border-gray-200' : 'bg-black/95 border-white/10'
            }`}>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-md text-base font-medium transition-all ${
                    theme === 'light'
                      ? 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                      : 'text-green-100 hover:bg-green-700/30 hover:text-green-300'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
              <div className={`px-3 py-3 border-t ${theme === 'light' ? 'border-gray-200/50' : 'border-white/10'}`}>
                <AuthButton variant="default" />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
