# Prettier Configuration

This document describes the Prettier code formatting configuration for the Faces of Plants project.

## Overview

Prettier is configured at the root level with a shared configuration that applies to all packages in the monorepo. This ensures consistent code formatting across the entire codebase.

## Configuration Files

### Root Configuration

- **`.prettierrc.json`**: Main Prettier configuration file
- **`.prettierignore`**: Files and directories to exclude from formatting

### Package-Level Configuration

Each package inherits the root configuration but can override it if needed:
- `packages/web/.prettierrc`: Web package configuration (matches root)
- `packages/core`: Uses root configuration
- `packages/functions`: Uses root configuration

## Prettier Rules

The following formatting rules are applied:

```json
{
  "semi": true,                    // Add semicolons at the end of statements
  "singleQuote": true,             // Use single quotes instead of double quotes
  "printWidth": 100,               // Wrap lines at 100 characters
  "trailingComma": "es5",          // Add trailing commas where valid in ES5
  "tabWidth": 2,                   // Use 2 spaces for indentation
  "useTabs": false,                // Use spaces instead of tabs
  "arrowParens": "always",         // Always include parentheses around arrow function parameters
  "endOfLine": "lf",               // Use Unix line endings
  "bracketSpacing": true,          // Add spaces inside object literal braces
  "jsxSingleQuote": false,         // Use double quotes in JSX
  "quoteProps": "as-needed"        // Only quote object properties when needed
}
```

## Usage

### Format All Files

From the root directory:

```bash
# Format all files in the project
pnpm format

# Check formatting without making changes
pnpm format:check
```

### Format Specific Packages

```bash
# Format core package
pnpm format:core

# Format functions package
pnpm format:functions

# Format web package
pnpm format:web
```

### Format Individual Packages

From within a package directory:

```bash
# Format files in the current package
pnpm format

# Check formatting in the current package
pnpm format:check
```

## Integration with Development Workflow

### Pre-commit Hooks

Prettier will be integrated with pre-commit hooks (via Husky) in a future task to automatically format code before commits.

### CI/CD Pipeline

The CI/CD pipeline will run `pnpm format:check` to ensure all code is properly formatted before merging pull requests.

### Editor Integration

Developers are encouraged to install Prettier extensions for their editors:

- **VS Code**: [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- **WebStorm/IntelliJ**: Built-in Prettier support
- **Vim/Neovim**: [vim-prettier](https://github.com/prettier/vim-prettier)

Configure your editor to format on save for the best experience.

## Ignored Files

The following files and directories are excluded from formatting (see `.prettierignore`):

- `node_modules/`
- Build outputs (`dist/`, `build/`, `.next/`, `.sst/`, `out/`, `coverage/`)
- Lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`)
- Environment files (`.env*`)
- Generated files (`*.d.ts`, `sst-env.d.ts`)
- Archives (`*.zip`, `*.tar.gz`)
- IDE directories (`.vscode/`, `.idea/`)

## Troubleshooting

### Formatting Conflicts with ESLint

If you encounter conflicts between Prettier and ESLint:

1. Ensure you're using the latest versions of both tools
2. Run `pnpm format` before `pnpm lint:fix`
3. ESLint is configured to work with Prettier (see `docs/ESLINT-CONFIGURATION.md`)

### Files Not Being Formatted

If files aren't being formatted:

1. Check if they're listed in `.prettierignore`
2. Verify the file extension is included in the format script glob pattern
3. Run `pnpm format:check` to see which files need formatting

### Different Formatting in Different Packages

All packages should use the same formatting rules. If you notice differences:

1. Check for package-specific `.prettierrc` files that override the root config
2. Ensure all packages have the same version of Prettier installed
3. Run `pnpm install` to sync dependencies

## Related Documentation

- [ESLint Configuration](./ESLINT-CONFIGURATION.md)
- [Development Guide](./development.md)
- [Contributing Guidelines](../CONTRIBUTING.md) (to be created)

## Requirements

This configuration satisfies:
- **Requirement 9.2**: Code formatting with Prettier
- **Task 28**: Configure Prettier for all packages
