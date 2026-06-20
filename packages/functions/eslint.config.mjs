import rootConfig from "../../eslint.config.mjs";

/**
 * ESLint configuration for @faces-of-plants/functions package.
 * Extends the root configuration with Lambda-specific rules.
 */
export default [
  ...rootConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        // AWS Lambda globals
        AWS: "readonly",
      },
    },
    rules: {
      // Lambda functions often use console for CloudWatch logs
      "no-console": "off",
    },
  },
];
