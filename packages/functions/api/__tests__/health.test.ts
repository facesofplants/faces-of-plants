import { type APIGatewayProxyEvent } from 'aws-lambda';
import { describe, it, expect } from 'vitest';

/**
 * Health Check Endpoint Tests
 *
 * These are integration tests that verify the health check endpoint structure
 * and response format. The actual provider and database health checks are tested
 * separately in their respective test files.
 *
 * Requirements: 6.4
 */
describe('Health Check Endpoint', () => {
  const mockEvent = {
    httpMethod: 'GET',
    path: '/health',
    headers: {},
    body: null,
  } as APIGatewayProxyEvent;

  it('should return a valid health check response structure', async () => {
    // Import handler dynamically to avoid module-level initialization issues
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    // Should return either 200 or 503
    expect([200, 503]).toContain(response.statusCode);

    const body = JSON.parse(response.body);

    // Verify response structure
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('service');
    expect(body).toHaveProperty('checks');

    // Verify version information
    expect(body.version).toHaveProperty('current');
    expect(body.version).toHaveProperty('supported');
    expect(Array.isArray(body.version.supported)).toBe(true);

    // Verify checks structure
    expect(body.checks).toHaveProperty('providers');
    expect(body.checks).toHaveProperty('database');

    // Verify provider checks
    expect(body.checks.providers).toHaveProperty('gbif');
    expect(body.checks.providers).toHaveProperty('inaturalist');
    expect(body.checks.providers).toHaveProperty('eol');

    // Each provider check should have status
    expect(body.checks.providers.gbif).toHaveProperty('status');
    expect(body.checks.providers.inaturalist).toHaveProperty('status');
    expect(body.checks.providers.eol).toHaveProperty('status');

    // Database check should have status
    expect(body.checks.database).toHaveProperty('status');
  });

  it('should include response times for all checks', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    const body = JSON.parse(response.body);

    // All checks should include response times
    expect(body.checks.providers.gbif.responseTime).toBeGreaterThanOrEqual(0);
    expect(body.checks.providers.inaturalist.responseTime).toBeGreaterThanOrEqual(0);
    expect(body.checks.providers.eol.responseTime).toBeGreaterThanOrEqual(0);
    expect(body.checks.database.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('should return 503 if overall status is unhealthy', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    const body = JSON.parse(response.body);

    // If status is unhealthy, status code should be 503
    if (body.status === 'unhealthy') {
      expect(response.statusCode).toBe(503);
    }
  });

  it('should return 200 if overall status is healthy', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    const body = JSON.parse(response.body);

    // If status is healthy, status code should be 200
    if (body.status === 'healthy') {
      expect(response.statusCode).toBe(200);
    }
  });

  it('should include service name', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    const body = JSON.parse(response.body);
    expect(body.service).toBe('faces-of-plants-api');
  });

  it('should include timestamp in ISO format', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    const body = JSON.parse(response.body);
    expect(body.timestamp).toBeDefined();

    // Verify it's a valid ISO date string
    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });

  it('should include X-API-Version header', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    expect(response.headers).toHaveProperty('X-API-Version');
    expect(response.headers?.['X-API-Version']).toBeDefined();
  });

  it('should include Content-Type header', async () => {
    const { handler } = await import('../health');
    const response = await handler(mockEvent);

    expect(response.headers).toHaveProperty('Content-Type');
    expect(response.headers?.['Content-Type']).toBe('application/json');
  });
});
