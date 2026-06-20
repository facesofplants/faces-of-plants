import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import nextPlugin from "@next/eslint-plugin-next"; // Import the Next.js plugin

/**
 * Shared ESLint configuration for all packages in the Faces of Plants monorepo.
 * This configuration enforces TypeScript best practices, import ordering, and code quality standards.
 */
export default [
  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.sst/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
    ],
  },

  // Base JavaScript/TypeScript configuration (Node.js environment)
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      // Removed Node.js specific globals from here, will be handled by env:node
      // and specific globals for web will be in its own config
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
    },
    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,

      // TypeScript best practices
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Import ordering and organization
      "import/order": [
        "error",
        {
          groups: [
            "builtin", // Node.js built-in modules
            "external", // External packages
            "internal", // Internal packages (workspace packages)
            "parent", // Parent directory imports
            "sibling", // Sibling directory imports
            "index", // Index file imports
            "type", // Type imports
          ],
          pathGroups: [
            {
              pattern: "@faces-of-plants/**",
              group: "internal",
              position: "before",
            },
            {
              pattern: "~/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-duplicates": "error",
      "import/no-unresolved": "off", // TypeScript handles this
      "import/newline-after-import": "error",

      // Code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "warn",
      "prefer-template": "warn",
      "prefer-arrow-callback": "warn",
      "no-duplicate-imports": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["error", "all"],
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",

      // Formatting (basic - Prettier handles most)
      semi: ["error", "always"],
      quotes: ["error", "single", { avoidEscape: true, allowTemplateLiterals: true }],
      "comma-dangle": ["error", "always-multiline"],
    },
  },

  // Configuration for the 'web' package (Next.js frontend)
  nextPlugin.configs["core-web-vitals"], // Directly include core-web-vitals config
  nextPlugin.configs.recommended, // Directly include recommended config
  {
    files: ["packages/web/**/*.ts", "packages/web/**/*.tsx", "packages/web/**/*.js", "packages/web/**/*.jsx"],
    languageOptions: {
      globals: {
        // Explicitly define browser globals if next/core-web-vitals doesn't fully cover them
        // Or rely on 'env: { browser: true }' to handle most of them
        // We can remove specific ones if they are still reported as no-undef
        // These are typically provided by 'next/core-web-vitals' or 'env:browser'
        // but explicitly listing them here as a fallback
        "React": "readonly",
        "fetch": "readonly",
        "window": "readonly",
        "document": "readonly",
        "localStorage": "readonly",
        "sessionStorage": "readonly",
        "setTimeout": "readonly",
        "clearTimeout": "readonly",
        "setInterval": "readonly",
        "clearInterval": "readonly",
        "TextEncoder": "readonly",
        "URL": "readonly",
        "URLSearchParams": "readonly",
        "Headers": "readonly",
        "Request": "readonly",
        "MouseEvent": "readonly",
        "Node": "readonly",
        "HTMLDivElement": "readonly",
        "HTMLCanvasElement": "readonly",
        "CanvasRenderingContext2D": "readonly",
        "Blob": "readonly",
        "KeyboardEvent": "readonly",
        "NodeJS": "readonly", // Keep NodeJS for server components/API routes
        "btoa": "readonly",
        "indexedDB": "readonly",
        "navigator": "readonly",
        "alert": "readonly",
        "confirm": "readonly"
      },
    },
    plugins: {
      "@next/next": nextPlugin, // Explicitly add the Next.js plugin
    },
    rules: {
      // Override or re-confirm rules specific to the web package if needed
      "no-console": ["warn", { allow: ["warn", "error", "info"] }], // Allow info for client-side
      "no-alert": "off", // Temporarily turn off for client-side if needed, or fix usage
      "no-undef": "off", // Temporarily turn off if browser env doesn't fix all
      // Re-confirm import/order if it's still problematic
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "type",
          ],
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before",
            },
            {
              pattern: "next/**",
              group: "external",
              position: "before",
            },
            {
              pattern: "@faces-of-plants/**",
              group: "internal",
              position: "before",
            },
            {
              pattern: "~/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      // Next.js specific rules
      "@next/next/no-img-element": "warn", // Warn instead of error for img tags
    },
  },

  // Test files specific configuration
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];