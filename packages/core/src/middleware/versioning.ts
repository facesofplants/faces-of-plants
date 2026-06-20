import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import {
  extractVersionFromPath,
  getDeprecationInfo,
  isVersionSupported,
  VERSIONING_CONFIG,
  CURRENT_VERSION,
  type ApiVersion,
} from '../../../../infra/versioning';

/**
 * Version negotiation middleware
 * Handles API version detection from URL path or Accept-Version header
 */
export function withVersioning(
  handler: (event: APIGatewayProxyEvent, version: ApiVersion) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Extract version from path
    const pathVersion = extractVersionFromPath(event.path);

    // Extract version from header
    const headerVersion =
      event.headers[VERSIONING_CONFIG.versionHeader] ||
      event.headers[VERSIONING_CONFIG.versionHeader.toLowerCase()];

    // Determine which version to use (path takes precedence)
    const requestedVersion =
      pathVersion || (headerVersion as ApiVersion) || VERSIONING_CONFIG.defaultVersion;

    // Validate version
    if (!isVersionSupported(requestedVersion)) {
      const errorResponse: APIGatewayProxyResult = {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          [VERSIONING_CONFIG.currentVersionHeader]: CURRENT_VERSION,
        },
        body: JSON.stringify({
          error: {
            code: 'UNSUPPORTED_API_VERSION',
            message: `API version '${requestedVersion}' is not supported`,
            supportedVersions: ['v1'], // From SUPPORTED_VERSIONS
            currentVersion: CURRENT_VERSION,
          },
        }),
      };
      return errorResponse;
    }

    // Call the handler with the version
    const result = await handler(event, requestedVersion);

    // Add version headers to response
    const versionHeaders = {
      [VERSIONING_CONFIG.currentVersionHeader]: requestedVersion,
    };

    // Add deprecation headers if version is deprecated
    const deprecationInfo = getDeprecationInfo(requestedVersion);
    if (deprecationInfo.deprecated) {
      versionHeaders[VERSIONING_CONFIG.deprecationHeader] = 'true';
      if (deprecationInfo.sunsetDate) {
        versionHeaders[VERSIONING_CONFIG.sunsetHeader] = deprecationInfo.sunsetDate;
      }
      if (deprecationInfo.message) {
        versionHeaders['X-Deprecation-Message'] = deprecationInfo.message;
      }
      if (deprecationInfo.successorVersion) {
        // Add Link header pointing to successor version
        const currentPath = event.path.replace(/^\/v\d+/, '');
        versionHeaders[VERSIONING_CONFIG.linkHeader] =
          `</${deprecationInfo.successorVersion}${currentPath}>; rel="successor-version"`;
      }
    }

    return {
      ...result,
      headers: {
        ...(result.headers || {}),
        ...versionHeaders,
      },
    };
  };
}

/**
 * Add deprecation warning headers to a response
 */
export function addDeprecationHeaders(
  response: APIGatewayProxyResult,
  version: ApiVersion
): APIGatewayProxyResult {
  const deprecationInfo = getDeprecationInfo(version);

  if (!deprecationInfo.deprecated) {
    return response;
  }

  const deprecationHeaders: Record<string, string> = {
    [VERSIONING_CONFIG.deprecationHeader]: 'true',
  };

  if (deprecationInfo.sunsetDate) {
    deprecationHeaders[VERSIONING_CONFIG.sunsetHeader] = deprecationInfo.sunsetDate;
  }

  if (deprecationInfo.message) {
    deprecationHeaders['X-Deprecation-Message'] = deprecationInfo.message;
  }

  if (deprecationInfo.successorVersion) {
    // Note: Path would need to be passed in for full Link header support
    deprecationHeaders['X-Successor-Version'] = deprecationInfo.successorVersion;
  }

  return {
    ...response,
    headers: {
      ...response.headers,
      ...deprecationHeaders,
    },
  };
}

/**
 * Extract API version from request
 * Utility function for handlers that need to know the version
 */
export function getRequestVersion(event: APIGatewayProxyEvent): ApiVersion {
  const pathVersion = extractVersionFromPath(event.path);
  const headerVersion =
    event.headers[VERSIONING_CONFIG.versionHeader] ||
    event.headers[VERSIONING_CONFIG.versionHeader.toLowerCase()];

  return pathVersion || (headerVersion as ApiVersion) || CURRENT_VERSION;
}
