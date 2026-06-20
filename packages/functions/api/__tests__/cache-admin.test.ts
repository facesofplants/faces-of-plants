import { type APIGatewayProxyEvent } from 'aws-lambda';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the dependencies
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('../../core/src/services/CacheService');
vi.mock('sst', () => ({
  Resource: {
    'faces-of-plants-dev-database-cache': {
      name: 'test-cache-table',
    },
  },
}));

describe('Cache Admin Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (
    body?: any,
    headers?: Record<string, string>,
    method = 'DELETE'
  ): APIGatewayProxyEvent => ({
    body: body ? JSON.stringify(body) : null,
    headers: headers || {},
    httpMethod: method,
    isBase64Encoded: false,
    path: '/admin/cache',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test-account',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/admin/cache',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/admin/cache',
    },
    resource: '/admin/cache',
    multiValueHeaders: {},
  });

  it('should return 401 when no authorization header is provided', async () => {
    // Dynamic import to avoid module-level mocking issues
    const { handler } = await import('../cache-admin');

    const event = createMockEvent({ cacheKey: 'test-key' });
    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Admin access required');
  });

  it('should return 400 when neither cacheKey nor pattern is provided', async () => {
    const { handler } = await import('../cache-admin');

    const event = createMockEvent(
      {},
      { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN || 'test-admin-token'}` }
    );

    // Set the admin token for this test
    process.env.ADMIN_API_TOKEN = 'test-admin-token';

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle CORS preflight requests', async () => {
    const { handler } = await import('../cache-admin');

    const event = createMockEvent(null, {}, 'OPTIONS');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('DELETE');
  });

  it('should accept requests with valid admin token', async () => {
    // Set up the admin token
    process.env.ADMIN_API_TOKEN = 'test-admin-token';

    const { handler } = await import('../cache-admin');

    const event = createMockEvent(
      { cacheKey: 'test-key' },
      { Authorization: 'Bearer test-admin-token' }
    );

    const result = await handler(event);

    // Should not be 401
    expect(result.statusCode).not.toBe(401);
  });
});
