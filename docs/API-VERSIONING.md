# API Versioning

**Date**: December 3, 2024  
**Task**: Task 19 - Implement API versioning infrastructure  
**Status**: ✅ Complete

## Overview

The Faces of Plants API now supports versioning to ensure backward compatibility and smooth API evolution. All public API endpoints are versioned using URL-based versioning with support for header-based version negotiation.

## Versioning Strategy

### URL-Based Versioning (Primary)

All API endpoints include a version prefix in the URL path:

```
/v1/query
/v1/species/{id}
/v1/collections
/v1/data-sources
```

### Header-Based Versioning (Secondary)

Clients can also specify the API version using the `Accept-Version` header:

```http
GET /query HTTP/1.1
Accept-Version: v1
```

**Note**: URL-based version takes precedence over header-based version.

## Current Versions

| Version | Status | Release Date | Sunset Date |
|---------|--------|--------------|-------------|
| v1      | ✅ Current | Dec 2024 | N/A |

## Versioned Endpoints

### Public API Endpoints (Lambda/API Gateway)

| Endpoint | Method | Versioned Path | Description |
|----------|--------|----------------|-------------|
| Query | POST | `/v1/query` | Multi-source biodiversity query |
| Species | GET | `/v1/species/{id}` | Get species details |
| Collections | POST | `/v1/collections` | Create collection |
| Collections | GET | `/v1/collections/{userId}` | Get user collections |
| Data Sources | GET | `/v1/data-sources` | List available data sources |

### Unversioned Endpoints

Some endpoints are intentionally unversioned:

| Endpoint | Path | Reason |
|----------|------|--------|
| Health Check | `/health` | Infrastructure endpoint |
| Admin Cache | `/admin/cache` | Internal admin endpoint |
| Authentication | `/auth/*` | Authentication flow endpoints |

## Version Negotiation

### Request Flow

```
1. Client makes request to /v1/query or /query with Accept-Version: v1
2. Middleware extracts version from URL (priority) or header
3. Middleware validates version is supported
4. If unsupported: return 400 with error
5. If supported: call handler with version context
6. Add version headers to response
```

### Response Headers

All API responses include version information:

```http
HTTP/1.1 200 OK
X-API-Version: v1
Content-Type: application/json
```

### Unsupported Version Response

```http
HTTP/1.1 400 Bad Request
X-API-Version: v1
Content-Type: application/json

{
  "error": {
    "code": "UNSUPPORTED_API_VERSION",
    "message": "API version 'v99' is not supported",
    "supportedVersions": ["v1"],
    "currentVersion": "v1"
  }
}
```

## Deprecation Strategy

When a version is deprecated, responses will include deprecation headers:

```http
HTTP/1.1 200 OK
X-API-Version: v1
Deprecation: true
Sunset: 2025-12-31
X-Deprecation-Message: API v1 is deprecated. Please migrate to v2.
Link: </v2/query>; rel="successor-version"
```

### Deprecation Timeline

1. **Announcement** (T-6 months): Deprecation announced in release notes
2. **Warning Headers** (T-3 months): Deprecation headers added to responses
3. **Sunset Date** (T): Version no longer supported

## Implementation Details

### Infrastructure (`infra/versioning.ts`)

```typescript
// Current version configuration
export const API_VERSIONS = {
  V1: 'v1',
} as const;

export const CURRENT_VERSION: ApiVersion = API_VERSIONS.V1;
export const SUPPORTED_VERSIONS: ApiVersion[] = [API_VERSIONS.V1];

// Version route helper
export function versionRoute(path: string, version: ApiVersion = CURRENT_VERSION): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Don't version auth routes or health checks
  if (cleanPath.startsWith('auth/') || cleanPath === 'health') {
    return `/${cleanPath}`;
  }
  
  return `/${version}/${cleanPath}`;
}
```

### Middleware (`packages/core/src/middleware/versioning.ts`)

```typescript
// Wrap handlers with version negotiation
export function withVersioning(
  handler: (event: APIGatewayProxyEvent, version: ApiVersion) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // Extract and validate version
    // Call handler with version context
    // Add version headers to response
  };
}
```

### API Routes (`infra/api.ts`)

```typescript
import { versionRoute } from "./versioning";

// Versioned route
api.route(`POST ${versionRoute("/query")}`, {
  handler: "packages/functions/api/query.handler",
  // ...
});

// Unversioned route
api.route("GET /health", {
  handler: "packages/functions/api/health.handler",
});
```

## Client Usage

### JavaScript/TypeScript

```typescript
// URL-based versioning (recommended)
const response = await fetch('https://api.facesofplants.org/v1/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: 'Quercus' }),
});

// Header-based versioning
const response = await fetch('https://api.facesofplants.org/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Version': 'v1',
  },
  body: JSON.stringify({ query: 'Quercus' }),
});

// Check version in response
const apiVersion = response.headers.get('X-API-Version');
console.log(`Using API version: ${apiVersion}`);
```

### cURL

```bash
# URL-based versioning
curl -X POST https://api.facesofplants.org/v1/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Quercus"}'

# Header-based versioning
curl -X POST https://api.facesofplants.org/query \
  -H "Content-Type: application/json" \
  -H "Accept-Version: v1" \
  -d '{"query": "Quercus"}'
```

## Adding a New Version

When introducing breaking changes, create a new API version:

### 1. Update Version Configuration

```typescript
// infra/versioning.ts
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2', // New version
} as const;

export const CURRENT_VERSION: ApiVersion = API_VERSIONS.V2;
export const SUPPORTED_VERSIONS: ApiVersion[] = [API_VERSIONS.V1, API_VERSIONS.V2];
```

### 2. Add Deprecation Info for Old Version

```typescript
export function getDeprecationInfo(version: ApiVersion) {
  if (version === API_VERSIONS.V1) {
    return {
      deprecated: true,
      sunsetDate: '2025-12-31',
      message: 'API v1 is deprecated. Please migrate to v2.',
    };
  }
  return { deprecated: false };
}
```

### 3. Create New Route Handlers

```typescript
// infra/api.ts
// V2 endpoint with breaking changes
api.route(`POST ${versionRoute("/query", API_VERSIONS.V2)}`, {
  handler: "packages/functions/api/query-v2.handler",
  // ...
});

// V1 endpoint (maintained for backward compatibility)
api.route(`POST ${versionRoute("/query", API_VERSIONS.V1)}`, {
  handler: "packages/functions/api/query.handler",
  // ...
});
```

### 4. Update Documentation

- Update API documentation with v2 changes
- Add migration guide from v1 to v2
- Update OpenAPI specification

## Testing

### Unit Tests

```typescript
// packages/core/src/middleware/__tests__/versioning.test.ts
describe('Versioning Middleware', () => {
  it('should extract version from path', async () => {
    // Test version extraction
  });

  it('should return 400 for unsupported version', async () => {
    // Test error handling
  });

  it('should add deprecation headers for deprecated version', async () => {
    // Test deprecation warnings
  });
});
```

### Integration Tests

```bash
# Test versioned endpoint
curl -X POST https://api.facesofplants.org/v1/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Test unsupported version
curl -X POST https://api.facesofplants.org/v99/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
# Expected: 400 Bad Request

# Test health check (unversioned)
curl https://api.facesofplants.org/health
# Expected: 200 OK with version info
```

## Benefits

✅ **Backward Compatibility**: Old clients continue working when API evolves  
✅ **Smooth Migrations**: Clients can migrate at their own pace  
✅ **Clear Communication**: Deprecation headers warn clients in advance  
✅ **Flexibility**: Support for both URL and header-based versioning  
✅ **Documentation**: Version info in every response  

## Best Practices

### For API Developers

1. **Avoid Breaking Changes**: Try to make changes backward-compatible
2. **Version Only When Necessary**: Don't create new versions for minor changes
3. **Maintain Old Versions**: Support deprecated versions for at least 6 months
4. **Document Changes**: Clearly document what changed between versions
5. **Test Both Versions**: Ensure all supported versions work correctly

### For API Consumers

1. **Always Specify Version**: Use URL-based versioning in production
2. **Monitor Deprecation Headers**: Watch for deprecation warnings
3. **Plan Migrations**: Migrate before sunset date
4. **Handle Errors**: Check for UNSUPPORTED_API_VERSION errors
5. **Read Release Notes**: Stay informed about API changes

## Related Files

| File | Purpose |
|------|---------|
| `infra/versioning.ts` | Version configuration and utilities |
| `infra/api.ts` | Versioned route definitions |
| `packages/core/src/middleware/versioning.ts` | Version negotiation middleware |
| `packages/functions/api/health.ts` | Health check with version info |
| `packages/core/src/middleware/__tests__/versioning.test.ts` | Unit tests |

## Related Documentation

- [API Reference](./api-reference.md)
- [Architecture](./architecture.md)
- [Deployment](./deployment.md)

## Requirement Compliance

**Requirement 8.1**: ✅ API endpoints include version prefix in URL path  
**Requirement 8.2**: ✅ Infrastructure supports multiple versions simultaneously  
**Requirement 8.3**: ✅ Deprecation warnings in response headers (ready for future use)  
**Requirement 8.4**: ✅ Version negotiation via Accept-Version header  
**Requirement 8.5**: ✅ Version information documented  

