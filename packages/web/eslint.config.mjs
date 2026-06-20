import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

import rootConfig from '../../eslint.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * ESLint configuration for web package (Next.js).
 * Combines root configuration with Next.js specific rules.
 */
const eslintConfig = [
  // Apply root config first
  ...rootConfig,

  // Then apply Next.js specific rules
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Web-specific overrides
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // React components don't need explicit return types
      '@typescript-eslint/explicit-function-return-type': 'off',

      // Allow console in development
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // React hooks and Next.js patterns
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default eslintConfig;
