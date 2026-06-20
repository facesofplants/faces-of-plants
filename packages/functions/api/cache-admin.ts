import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';
import { CacheService } from '../../core/src/services/CacheService';

const dynamoClient = new DynamoDBClient({});

// Initialize cache service
const cacheService = new CacheService(
  process.env.CACHE_TABLE || '',
  dynamoClient,
  3600
);

/**
 * Admin endpoint for cache invalidation
 * Supports invalidating specific keys or patterns
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Check admin authentication
    const authResult = await checkAdminAuth(event);
    if (!authResult.isAdmin) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin access required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { cacheKey, pattern } = body;

    if (!cacheKey && !pattern) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either cacheKey or pattern must be provided',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    let invalidatedCount = 0;

    if (cacheKey) {
      // Invalidate specific cache key
      await cacheService.invalidate(cacheKey);
      invalidatedCount = 1;
    } else if (pattern) {
      // Invalidate by pattern
      invalidatedCount = await cacheService.invalidatePattern(pattern);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invalidatedCount,
        message: `Successfully invalidated ${invalidatedCount} cache ${
          invalidatedCount === 1 ? 'entry' : 'entries'
        }`,
        requestId: event.requestContext.requestId,
      }),
    };
  } catch (error) {
    console.error('Cache invalidation error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to invalidate cache',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};

/**
 * Check if the request is from an admin user
 * This is a simplified implementation - in production, you would:
 * 1. Validate JWT token from NextAuth
 * 2. Check user role from database
 * 3. Implement proper RBAC
 */
async function checkAdminAuth(
  event: APIGatewayProxyEvent
): Promise<{ isAdmin: boolean; userId?: string }> {
  // Get authorization header
  const authHeader = event.headers.Authorization || event.headers.authorization;

  if (!authHeader) {
    return { isAdmin: false };
  }

  // For now, check for a simple admin token
  // In production, this should validate NextAuth JWT and check user role
  const adminToken = process.env.ADMIN_API_TOKEN;

  if (adminToken && authHeader === `Bearer ${adminToken}`) {
    return { isAdmin: true, userId: 'admin' };
  }

  // TODO: Implement proper JWT validation with NextAuth
  // 1. Extract JWT from Authorization header
  // 2. Verify JWT signature
  // 3. Extract user ID from JWT
  // 4. Query user from database
  // 5. Check if user.userType === 'admin'

  return { isAdmin: false };
}
