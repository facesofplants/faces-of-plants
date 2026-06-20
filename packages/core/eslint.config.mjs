import rootConfig from "../../eslint.config.mjs";

/**
 * ESLint configuration for @faces-of-plants/core package.
 * Extends the root configuration with package-specific rules.
 */
export default [
  ...rootConfig,
  {
    files: ["**/*.ts"],
    rules: {
      // Core package should have stricter type checking
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
    },
  },
];
