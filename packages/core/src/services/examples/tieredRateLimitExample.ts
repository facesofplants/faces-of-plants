/**
 * Example: Using Tiered Rate Limiting in Lambda Functions
 *
 * This example demonstrates how to integrate tiered rate limiting
 * into your Lambda function handlers.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { RateLimitRepository } from '../../repository/RateLimitRepository';
import { RateLimiter } from '../RateLimiter';
import { tieredRateLimitMiddleware } from '../rateLimitMiddleware';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Initialize rate limit repository
const rateLimitRepository = new RateLimitRepository(
  process.env.RATE_LIMIT_TABLE_NAME || 'rate-limits',
  dynamoClient
);

// Initialize rate limiter with configuration
const rateLimiter = new RateLimiter(rateLimitRepository, {
  capacity: 1000, // Max capacity to support premium tier
  refillRate: 10, // Tokens refilled per interval
  refillInterval: 60, // Refill interval in seconds
});

// Create the tiered rate limit middleware
const rateLimitMiddleware = tieredRateLimitMiddleware({
  rateLimiter,
});

/**
 * Example 1: Basic API endpoint with tiered rate limiting
 */
export const queryHandler = rateLimitMiddleware(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Your business logic here
      const query = event.queryStringParameters?.q || '';

      // Simulate data fetching
      const results = await fetchData(query);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          results,
          count: results.length,
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred processing your request',
          },
        }),
      };
    }
  }
);

/**
 * Example 2: API endpoint with custom error handling
 */
export const searchHandler = tieredRateLimitMiddleware({
  rateLimiter,
  onRateLimitExceeded: (key, retryAfter, tier, limit) => ({
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': limit?.toString() || '100',
    },
    body: JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `You have exceeded the ${tier} tier rate limit of ${limit} requests per minute.`,
        retryAfter,
        tier,
        upgradeUrl:
          tier === 'anonymous'
            ? '/auth/signup'
            : tier === 'authenticated'
              ? '/upgrade/premium'
              : undefined,
      },
    }),
  }),
})(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Your handler logic
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
});

/**
 * Example 3: Multiple endpoints sharing the same rate limiter
 */
const createRateLimitedHandler = (
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
) => {
  return rateLimitMiddleware(handler);
};

export const getUserProfile = createRateLimitedHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const userId = event.pathParameters?.userId;
    // Fetch user profile
    return {
      statusCode: 200,
      body: JSON.stringify({ userId, profile: {} }),
    };
  }
);

export const updateUserProfile = createRateLimitedHandler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const userId = event.pathParameters?.userId;
    const updates = JSON.parse(event.body || '{}');
    // Update user profile
    return {
      statusCode: 200,
      body: JSON.stringify({ userId, updated: true }),
    };
  }
);

/**
 * Helper function to simulate data fetching
 */
async function fetchData(query: string): Promise<any[]> {
  // Simulate async operation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, name: 'Result 1' },
        { id: 2, name: 'Result 2' },
      ]);
    }, 100);
  });
}

/**
 * Example 4: Testing tier detection locally
 *
 * This shows how different event structures map to different tiers
 */
export function demonstrateTierDetection() {
  const examples = [
    {
      description: 'Anonymous user (no auth)',
      event: {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' },
          authorizer: null,
        },
      },
      expectedTier: 'anonymous',
      expectedLimit: 100,
    },
    {
      description: 'Authenticated user (basic)',
      event: {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' },
          authorizer: {
            claims: {
              sub: 'user123',
              email: 'user@example.com',
            },
          },
        },
      },
      expectedTier: 'authenticated',
      expectedLimit: 300,
    },
    {
      description: 'Premium user',
      event: {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' },
          authorizer: {
            claims: {
              sub: 'premium456',
              email: 'premium@example.com',
              tier: 'premium',
            },
          },
        },
      },
      expectedTier: 'premium',
      expectedLimit: 1000,
    },
  ];

  return examples;
}
