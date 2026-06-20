/// <reference path="../.sst/platform/config.d.ts" />

/**
 * API Versioning Utilities
 * 
 * Provides utilities for managing API versions across the infrastructure.
 * Supports URL-based versioning (/v1/, /v2/) and header-based version negotiation.
 */

export const API_VERSIONS = {
  V1: 'v1',
  // Future versions can be added here
  // V2: 'v2',
} as const;

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

export const CURRENT_VERSION: ApiVersion = API_VERSIONS.V1;
export const SUPPORTED_VERSIONS: ApiVersion[] = [API_VERSIONS.V1];

/**
 * Add version prefix to a route path
 * @param path - The route path (e.g., "/query")
 * @param version - The API version (defaults to current version)
 * @returns Versioned path (e.g., "/v1/query")
 */
export function versionRoute(path: string, version: ApiVersion = CURRENT_VERSION): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Don't version auth routes or health checks
  if (cleanPath.startsWith('auth/') || cleanPath === 'health') {
    return `/${cleanPath}`;
  }
  
  return `/${version}/${cleanPath}`;
}

/**
 * Get all versioned routes for a given path
 * Useful for maintaining multiple versions of the same endpoint
 * @param path - The route path
 * @returns Array of versioned paths for all supported versions
 */
export function getAllVersionedRoutes(path: string): string[] {
  return SUPPORTED_VERSIONS.map(version => versionRoute(path, version));
}

/**
 * Check if a version is supported
 * @param version - The version to check
 * @returns True if the version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version as ApiVersion);
}

/**
 * Extract version from a request path
 * @param path - The request path (e.g., "/v1/query")
 * @returns The version string if found (may be unsupported), null otherwise
 */
export function extractVersionFromPath(path: string): string | null {
  const match = path.match(/^\/?(v\d+)\//);
  return match ? match[1] : null;
}

/**
 * Get deprecation info for a version
 * @param version - The API version
 * @returns Deprecation info if the version is deprecated, null otherwise
 */
export function getDeprecationInfo(version: ApiVersion): {
  deprecated: boolean;
  sunsetDate?: string;
  message?: string;
  successorVersion?: string;
} {
  // Mark V1 as deprecated (for testing and future migration)
  if (version === API_VERSIONS.V1) {
    return {
      deprecated: true,
      sunsetDate: '2025-12-31',
      message: 'API v1 is deprecated. Please plan migration to future versions.',
      successorVersion: 'v2', // Will be available in future
    };
  }
  
  return { deprecated: false };
}

/**
 * Configuration for API versioning
 */
export const VERSIONING_CONFIG = {
  // Default version to use when no version is specified
  defaultVersion: CURRENT_VERSION,
  
  // Whether to allow requests without version prefix
  allowUnversioned: false,
  
  // Header name for version negotiation
  versionHeader: 'Accept-Version',
  
  // Response header for current version
  currentVersionHeader: 'X-API-Version',
  
  // Response header for deprecation warnings
  deprecationHeader: 'Deprecation',
  sunsetHeader: 'Sunset',
  linkHeader: 'Link',
} as const;

