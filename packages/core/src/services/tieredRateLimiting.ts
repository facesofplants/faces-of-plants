import { type APIGatewayProxyEvent } from 'aws-lambda';

/**
 * User tier for rate limiting
 */
export type UserTier = 'anonymous' | 'authenticated' | 'premium';

/**
 * Rate limit configuration for a specific tier
 */
export interface TierRateLimitConfig {
  limit: number; // Maximum requests allowed
  window: number; // Time window in seconds
}

/**
 * Rate limit configurations for all tiers
 *
 * Based on Requirement 3.3:
 * - Anonymous: 100 requests per minute (base tier)
 * - Authenticated: 300 requests per minute (3x base)
 * - Premium: 1000 requests per minute (10x base)
 */
export const TIER_RATE_LIMITS: Record<UserTier, TierRateLimitConfig> = {
  anonymous: {
    limit: 100,
    window: 60, // 1 minute
  },
  authenticated: {
    limit: 300,
    window: 60, // 1 minute
  },
  premium: {
    limit: 1000,
    window: 60, // 1 minute
  },
};

/**
 * User context extracted from API Gateway event
 */
export interface UserContext {
  userId?: string;
  tier: UserTier;
  email?: string;
}

/**
 * Extract user tier from API Gateway event
 *
 * Tier detection logic:
 * 1. Check for authenticated user in authorizer context
 * 2. If authenticated, check user tier from claims
 * 3. Default to 'anonymous' if no authentication
 *
 * @param event - API Gateway proxy event
 * @returns User tier
 */
export function extractUserTier(event: APIGatewayProxyEvent): UserTier {
  // Check for authorizer context (NextAuth JWT or Cognito)
  const authorizer = event.requestContext.authorizer;

  if (!authorizer) {
    return 'anonymous';
  }

  // Check for tier in authorizer claims
  // NextAuth typically stores user data in authorizer.claims or authorizer.jwt
  const claims = (authorizer as any).claims || (authorizer as any).jwt || authorizer;

  if (claims.tier) {
    const tier = claims.tier as string;
    if (tier === 'premium' || tier === 'authenticated' || tier === 'anonymous') {
      return tier as UserTier;
    }
  }

  // If authenticated but no tier specified, default to 'authenticated'
  if (claims.sub || claims.userId || claims.email) {
    return 'authenticated';
  }

  return 'anonymous';
}

/**
 * Extract full user context from API Gateway event
 *
 * @param event - API Gateway proxy event
 * @returns User context with tier and optional user information
 */
export function extractUserContext(event: APIGatewayProxyEvent): UserContext {
  const tier = extractUserTier(event);
  const authorizer = event.requestContext.authorizer;

  if (!authorizer) {
    return { tier };
  }

  const claims = (authorizer as any).claims || (authorizer as any).jwt || authorizer;

  return {
    tier,
    userId: claims.sub || claims.userId,
    email: claims.email,
  };
}

/**
 * Get rate limit configuration for a specific tier
 *
 * @param tier - User tier
 * @returns Rate limit configuration
 */
export function getTierRateLimit(tier: UserTier): TierRateLimitConfig {
  return TIER_RATE_LIMITS[tier];
}

/**
 * Generate rate limit key based on user context
 *
 * For authenticated users, use userId to allow consistent limits across IPs
 * For anonymous users, use IP address
 *
 * @param event - API Gateway proxy event
 * @param context - User context
 * @returns Rate limit key
 */
export function generateRateLimitKey(event: APIGatewayProxyEvent, context: UserContext): string {
  if (context.userId) {
    return `user:${context.userId}`;
  }

  const sourceIp = event.requestContext.identity.sourceIp || 'unknown';
  return `ip:${sourceIp}`;
}
