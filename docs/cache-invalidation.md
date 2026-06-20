# Cache Invalidation API

## Overview

The cache invalidation endpoint allows administrators to manually clear cached data from the system. This is useful for:

- Clearing stale data after provider API updates
- Forcing fresh data fetches for specific queries
- Troubleshooting cache-related issues
- Bulk clearing of provider-specific caches

## Endpoint

```
DELETE /admin/cache
```

## Authentication

This endpoint requires admin authentication. Include an admin API token in the Authorization header:

```
Authorization: Bearer <ADMIN_API_TOKEN>
```

The admin token should be configured as an environment variable `ADMIN_API_TOKEN` in your Lambda function.

## Request Body

The request body must include either a `cacheKey` or a `pattern`:

### Invalidate Specific Cache Key

```json
{
  "cacheKey": "gbif:search:abc123"
}
```

### Invalidate by Pattern (Prefix Matching)

```json
{
  "pattern": "gbif:"
}
```

This will invalidate all cache entries that start with "gbif:".

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "invalidatedCount": 5,
  "message": "Successfully invalidated 5 cache entries",
  "requestId": "abc-123-def-456"
}
```

### Error Responses

#### Unauthorized (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Admin access required",
    "requestId": "abc-123-def-456"
  }
}
```

#### Validation Error (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Either cacheKey or pattern must be provided",
    "requestId": "abc-123-def-456"
  }
}
```

#### Internal Error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to invalidate cache",
    "requestId": "abc-123-def-456"
  }
}
```

## Examples

### Using cURL

#### Invalidate a specific cache key

```bash
curl -X DELETE https://api.example.com/admin/cache \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"cacheKey": "gbif:search:abc123"}'
```

#### Invalidate all GBIF cache entries

```bash
curl -X DELETE https://api.example.com/admin/cache \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "gbif:"}'
```

#### Invalidate all search operations for GBIF

```bash
curl -X DELETE https://api.example.com/admin/cache \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "gbif:search:"}'
```

### Using JavaScript/TypeScript

```typescript
async function invalidateCache(cacheKey?: string, pattern?: string) {
  const response = await fetch('https://api.example.com/admin/cache', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${process.env.ADMIN_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cacheKey, pattern }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Cache invalidation failed: ${error.error.message}`);
  }

  return await response.json();
}

// Invalidate specific key
await invalidateCache('gbif:search:abc123');

// Invalidate by pattern
await invalidateCache(undefined, 'gbif:');
```

## Cache Key Format

Cache keys follow the format: `provider:operation:hash`

- **provider**: The data provider (e.g., "gbif", "inaturalist", "eol")
- **operation**: The operation type (e.g., "search", "get", "list")
- **hash**: A hash of the query parameters

Examples:
- `gbif:search:a3f2c1b9`
- `inaturalist:search:b4e3d2c8`
- `eol:get:c5f4e3d9`

## Pattern Matching

Pattern matching uses prefix matching. Common patterns:

- `gbif:` - All GBIF cache entries
- `gbif:search:` - All GBIF search operations
- `inaturalist:` - All iNaturalist cache entries
- `eol:get:` - All EOL get operations

## Performance Considerations

⚠️ **Warning**: Pattern-based invalidation uses DynamoDB Scan operations, which can be expensive for large cache tables.

- Use specific cache keys when possible
- Limit pattern-based invalidation to off-peak hours
- Consider the cost implications of scanning large tables
- Monitor CloudWatch metrics after invalidation operations

## Security Considerations

1. **Admin Token**: Store the admin API token securely in environment variables or AWS Secrets Manager
2. **Token Rotation**: Rotate admin tokens regularly
3. **Audit Logging**: All cache invalidation operations are logged with request IDs for auditing
4. **Rate Limiting**: Consider implementing rate limiting for this endpoint to prevent abuse

## Future Enhancements

The current implementation supports prefix matching. Future enhancements could include:

1. **Global Secondary Index (GSI)**: Add a GSI on the provider field for more efficient pattern matching
2. **Regex Patterns**: Support more complex pattern matching with regular expressions
3. **Bulk Operations**: Support invalidating multiple specific keys in a single request
4. **Scheduled Invalidation**: Support scheduling cache invalidation for specific times
5. **JWT Validation**: Implement proper NextAuth JWT validation instead of simple token checking

## Related Documentation

- [Cache Service Documentation](./cache-service.md)
- [API Authentication](./authentication.md)
- [Admin Dashboard](./admin-dashboard.md)
