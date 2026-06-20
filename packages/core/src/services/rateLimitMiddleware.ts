import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { type RateLimiter } from './RateLimiter';
import {
  type UserTier,
  TierRateLimitConfig,
  extractUserContext,
  getTierRateLimit,
  generateRateLimitKey,
} from './tieredRateLimiting';

/**
 * Rate limit middleware configuration
 */
export interface RateLimitMiddlewareConfig {
  rateLimiter: RateLimiter;
  keyExtractor?: (event: APIGatewayProxyEvent) => string;
  onRateLimitExceeded?: (
    key: string,
    retryAfter: number,
    tier?: UserTier,
    limit?: number
  ) => APIGatewayProxyResult;
}

/**
 * Default key extractor - uses source IP address
 */
const defaultKeyExtractor = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.identity.sourceIp || 'unknown';
};

/**
 * Default rate limit exceeded handler
 */
const defaultRateLimitExceededHandler = (
  key: string,
  retryAfter: number,
  tier?: UserTier,
  limit?: number
): APIGatewayProxyResult => {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': (limit || 100).toString(),
      'X-RateLimit-Remaining': '0',
    },
    body: JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter,
        tier,
      },
    }),
  };
};

/**
 * Rate limit middleware for Lambda functions
 *
 * Usage:
 * ```typescript
 * export const handler = rateLimitMiddleware(config)(async (event) => {
 *   // Your handler logic
 * });
 * ```
 */
export const rateLimitMiddleware = (config: RateLimitMiddlewareConfig) => {
  const keyExtractor = config.keyExtractor || defaultKeyExtractor;
  const onRateLimitExceeded = config.onRateLimitExceeded || defaultRateLimitExceededHandler;

  return (handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>) => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const key = keyExtractor(event);

      // Check rate limit
      const result = await config.rateLimiter.checkLimit(key);

      if (!result.allowed) {
        return onRateLimitExceeded(key, result.retryAfter || 60);
      }

      // Consume token
      const consumed = await config.rateLimiter.consumeToken(key);

      if (!consumed) {
        return defaultRateLimitExceededHandler(key, result.retryAfter || 60);
      }

      // Execute handler
      const response = await handler(event);

      // Add rate limit headers to response
      return {
        ...response,
        headers: {
          ...response.headers,
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toISOString(),
        },
      };
    };
  };
};

/**
 * Create a rate limit middleware with tiered limits
 *
 * This middleware automatically detects user tier from the API Gateway event
 * and applies appropriate rate limits based on the tier.
 *
 * Tier detection:
 * - Anonymous: No authentication present
 * - Authenticated: Valid JWT token present
 * - Premium: JWT token with tier='premium' claim
 *
 * Rate limits (per minute):
 * - Anonymous: 100 requests
 * - Authenticated: 300 requests
 * - Premium: 1000 requests
 *
 * @param config - Base rate limiter configuration
 * @returns Middleware function
 */
export const tieredRateLimitMiddleware = (config: RateLimitMiddlewareConfig) => {
  return (handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>) => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      // Extract user context and tier
      const userContext = extractUserContext(event);
      const tierConfig = getTierRateLimit(userContext.tier);

      // Generate rate limit key based on user context
      const key = generateRateLimitKey(event, userContext);

      // Check rate limit with tier-specific limits
      const result = await config.rateLimiter.checkLimit(key, tierConfig.limit, tierConfig.window);

      if (!result.allowed) {
        const handler = config.onRateLimitExceeded || defaultRateLimitExceededHandler;
        return handler(key, result.retryAfter || 60, userContext.tier, tierConfig.limit);
      }

      // Consume token
      const consumed = await config.rateLimiter.consumeToken(key);

      if (!consumed) {
        return defaultRateLimitExceededHandler(
          key,
          result.retryAfter || 60,
          userContext.tier,
          tierConfig.limit
        );
      }

      // Execute handler
      const response = await handler(event);

      // Add rate limit headers to response with tier information
      return {
        ...response,
        headers: {
          ...response.headers,
          'X-RateLimit-Limit': tierConfig.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetAt.toISOString(),
          'X-RateLimit-Tier': userContext.tier,
        },
      };
    };
  };
};
