'use client';

import { Leaf } from '@phosphor-icons/react';
import Link from 'next/link';
import React from 'react';

import { useMode } from '../context/ModeContext';

export function Footer() {
  const { theme } = useMode();

  const footerBg = theme === 'light' ? 'bg-gray-900' : 'bg-gray-100';
  const textPrimary = theme === 'light' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'light' ? 'text-gray-300' : 'text-gray-600';
  const borderColor = theme === 'light' ? 'border-white/20' : 'border-gray-300/20';
  const logoColor = theme === 'light' ? 'text-green-400' : 'text-green-600';
  const linkColor = theme === 'light' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900';

  return (
    <footer className={`${footerBg} mt-auto`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Section */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Leaf className={`w-6 h-6 ${logoColor}`} />
                <span className={`text-xl font-bold ${textPrimary}`}>Faces of Plants</span>
              </div>
              <p className={`${textSecondary} mb-4`}>
                Making biodiversity data accessible through AI-powered natural language search.
                Powered by GBIF&apos;s global network of scientific institutions.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className={`${linkColor} underline`}>
                  GBIF.org
                </a>
                <span className={`${textSecondary}`}>•</span>
                <Link href="/about" className={`${linkColor} underline`}>
                  About this project
                </Link>
                <span className={`${textSecondary}`}>•</span>
                <span className={`${textSecondary}`}>Open Source (MIT)</span>
              </div>
            </div>

            {/* For Citizens Section */}
            <div>
              <h4 className={`font-semibold ${textPrimary} mb-4`}>Explore</h4>
              <ul className={`space-y-2 text-sm ${textSecondary}`}>
                <li><Link href="/explore" className={`${linkColor}`}>Explore</Link></li>
                <li><Link href="/education" className={`${linkColor}`}>Education</Link></li>
                <li><Link href="/about" className={`${linkColor}`}>About</Link></li>
                <li><Link href="/about" className={`${linkColor}`}>GBIF Data Sources</Link></li>
              </ul>
            </div>

            {/* For Researchers Section */}
            <div>
              <h4 className={`font-semibold ${textPrimary} mb-4`}>Resources</h4>
              <ul className={`space-y-2 text-sm ${textSecondary}`}>
                <li><a href="https://api.gbif.org" target="_blank" rel="noopener noreferrer" className={`${linkColor}`}>GBIF API Docs</a></li>
                <li><a href="https://www.gbif.org/developer/summary" target="_blank" rel="noopener noreferrer" className={`${linkColor}`}>GBIF Developer Portal</a></li>
                <li><a href="https://github.com/facesofplants/faces-of-plants" target="_blank" rel="noopener noreferrer" className={`${linkColor}`}>Source Code</a></li>
                <li><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className={`${linkColor}`}>CC BY 4.0 License</a></li>
              </ul>
            </div>
          </div>

          {/* Copyright & GBIF Attribution */}
          <div className={`border-t ${borderColor} mt-8 pt-8 text-center text-xs ${textSecondary}`}>
            <p className="mb-1">
              © 2026 Faces of Plants. Built with &#10084; for biodiversity research and education.
            </p>
            <p>
              This product uses data from{' '}
              <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className={`underline ${linkColor}`}>
                GBIF.org
              </a>{' '}
              available under a{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className={`underline ${linkColor}`}>
                CC BY 4.0
              </a>{' '}
              license.
            </p>
          </div>
        </div>
      </footer>
  );
}

export default Footer;
