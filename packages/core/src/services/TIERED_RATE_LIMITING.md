# Tiered Rate Limiting

This module implements tiered rate limiting for API endpoints based on user authentication status and subscription tier.

## Overview

The tiered rate limiting system automatically detects the user's tier from the API Gateway event and applies appropriate rate limits:

- **Anonymous**: 100 requests per minute (unauthenticated users)
- **Authenticated**: 300 requests per minute (logged-in users)
- **Premium**: 1000 requests per minute (premium subscribers)

## Usage

### Basic Usage

```typescript
import { tieredRateLimitMiddleware } from '@faces-of-plants/core';
import { RateLimiter } from '@faces-of-plants/core';
import { RateLimitRepository } from '@faces-of-plants/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Set up dependencies
const dynamoClient = new DynamoDBClient({});
const repository = new RateLimitRepository('rate-limits-table', dynamoClient);
const rateLimiter = new RateLimiter(repository, {
  capacity: 1000, // Max capacity to support premium tier
  refillRate: 10,
  refillInterval: 60,
});

// Create middleware
const middleware = tieredRateLimitMiddleware({ rateLimiter });

// Wrap your Lambda handler
export const handler = middleware(async (event) => {
  // Your handler logic
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
});
```

### How Tier Detection Works

The middleware automatically detects the user tier from the API Gateway event:

1. **Anonymous**: No authorizer context present
2. **Authenticated**: Authorizer context present with user ID (sub or userId claim)
3. **Premium**: Authorizer context with `tier: 'premium'` claim

### Rate Limit Keys

- **Authenticated users**: Rate limits are tracked by user ID (`user:{userId}`)
- **Anonymous users**: Rate limits are tracked by IP address (`ip:{ipAddress}`)

This ensures that authenticated users have consistent rate limits across different IP addresses.

### Response Headers

All responses include rate limit information in headers:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 2024-01-01T12:01:00.000Z
X-RateLimit-Tier: authenticated
```

### Error Responses

When rate limit is exceeded, the middleware returns a 429 status code:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 45,
    "tier": "anonymous"
  }
}
```

## Configuration

### Custom Tier Limits

You can customize the rate limits by modifying the `TIER_RATE_LIMITS` constant:

```typescript
import { TIER_RATE_LIMITS } from '@faces-of-plants/core';

// View current limits
console.log(TIER_RATE_LIMITS);
// {
//   anonymous: { limit: 100, window: 60 },
//   authenticated: { limit: 300, window: 60 },
//   premium: { limit: 1000, window: 60 }
// }
```

### Custom Error Handling

You can provide a custom error handler:

```typescript
const middleware = tieredRateLimitMiddleware({
  rateLimiter,
  onRateLimitExceeded: (key, retryAfter, tier, limit) => ({
    statusCode: 429,
    headers: {
      'Retry-After': retryAfter.toString(),
    },
    body: JSON.stringify({
      error: 'Custom rate limit message',
      tier,
      limit,
    }),
  }),
});
```

## Integration with NextAuth

The middleware is designed to work seamlessly with NextAuth JWT tokens:

```typescript
// NextAuth configuration
export default NextAuth({
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tier = user.tier; // Add tier to JWT
      }
      return token;
    },
  },
});
```

The middleware will automatically extract the tier from the JWT claims.

## Testing

The module includes comprehensive tests:

- Unit tests for tier detection and key generation
- Integration tests for middleware behavior
- Property-based tests for rate limit enforcement

Run tests:

```bash
npm test -- tieredRateLimiting.test.ts
npm test -- tieredRateLimitMiddleware.test.ts
```

## Requirements

This implementation satisfies:

- **Requirement 3.3**: Tiered rate limiting based on user authentication status
- **Requirement 3.1**: Rate limiting on all API endpoints
- **Requirement 3.2**: 429 status code with retry-after headers
- **Requirement 3.4**: Token bucket algorithm for rate limiting
- **Requirement 3.5**: DynamoDB-backed distributed rate limiting
