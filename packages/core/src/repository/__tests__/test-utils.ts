import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

/**
 * Create a mocked DynamoDB client for testing
 */
export function createMockDynamoDBClient() {
  return mockClient(DynamoDBClient);
}

/**
 * Reset all mocks
 */
export function resetMocks(mock: ReturnType<typeof mockClient>) {
  mock.reset();
}

/**
 * Sample test data
 */
export const sampleUser = {
  id: 'user_123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  tier: 'authenticated' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const sampleCacheEntry = {
  cacheKey: 'gbif:search:abc123',
  data: JSON.stringify({ results: [] }),
  provider: 'gbif',
  createdAt: Math.floor(Date.now() / 1000),
  ttl: Math.floor(Date.now() / 1000) + 3600,
};

export const sampleRateLimitEntry = {
  limitKey: '192.168.1.1',
  tokens: 100,
  lastRefill: Math.floor(Date.now() / 1000),
  ttl: Math.floor(Date.now() / 1000) + 3600,
};
