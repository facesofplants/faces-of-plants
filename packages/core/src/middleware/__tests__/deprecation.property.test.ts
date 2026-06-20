import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';
import * as fc from 'fast-check';
import { describe, it, expect, vi } from 'vitest';

import { API_VERSIONS } from '../../../../../infra/versioning';
import { withVersioning, addDeprecationHeaders } from '../versioning';

/**
 * Feature: production-readiness, Property 14: Deprecated endpoints include warning headers
 * Validates: Requirements 8.3
 *
 * For any request to a deprecated API endpoint, the response should include deprecation warning headers
 */
describe('Deprecation Headers Property Tests', () => {
  it('deprecated versions always include deprecation headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary paths
        fc.constantFrom('/query', '/species/123', '/collections', '/data-sources'),
        // Generate arbitrary HTTP methods
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        // Generate arbitrary response status codes
        fc.integer({ min: 200, max: 599 }),
        // Generate arbitrary response bodies
        fc.record({
          data: fc.anything(),
          message: fc.string(),
        }),
        async (path, method, statusCode, responseBody) => {
          // Create a mock handler that returns a response
          const mockHandler = vi.fn().mockResolvedValue({
            statusCode,
            body: JSON.stringify(responseBody),
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const wrappedHandler = withVersioning(mockHandler);

          // Create event with deprecated version (v1)
          const event = {
            path: `/v1${path}`,
            httpMethod: method,
            headers: {},
            body: null,
            isBase64Encoded: false,
          } as APIGatewayProxyEvent;

          const result = await wrappedHandler(event);

          // Property: Deprecated versions MUST include deprecation headers
          expect(result.headers).toHaveProperty('Deprecation', 'true');
          expect(result.headers).toHaveProperty('Sunset');
          expect(result.headers).toHaveProperty('X-Deprecation-Message');

          // Verify sunset date is a valid date string
          const sunsetDate = result.headers!['Sunset'] as string;
          expect(sunsetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

          // Verify deprecation message is non-empty
          const message = result.headers!['X-Deprecation-Message'] as string;
          expect(message.length).toBeGreaterThan(0);

          // Verify Link header for successor version is present
          expect(result.headers).toHaveProperty('Link');
          const linkHeader = result.headers!['Link'] as string;
          expect(linkHeader).toContain('rel="successor-version"');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('addDeprecationHeaders adds all required headers for deprecated versions', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary response status codes
        fc.integer({ min: 200, max: 599 }),
        // Generate arbitrary response bodies
        fc.jsonValue(),
        // Generate arbitrary existing headers
        fc.dictionary(fc.string(), fc.string()),
        (statusCode, body, existingHeaders) => {
          const response: APIGatewayProxyResult = {
            statusCode,
            body: JSON.stringify(body),
            headers: existingHeaders,
          };

          // Apply deprecation headers for v1 (which is deprecated)
          const result = addDeprecationHeaders(response, API_VERSIONS.V1);

          // Property: All deprecated versions must have deprecation headers
          expect(result.headers).toHaveProperty('Deprecation', 'true');
          expect(result.headers).toHaveProperty('Sunset');
          expect(result.headers).toHaveProperty('X-Deprecation-Message');

          // Verify existing headers are preserved
          Object.keys(existingHeaders).forEach((key) => {
            expect(result.headers).toHaveProperty(key, existingHeaders[key]);
          });

          // Verify sunset date format
          const sunsetDate = result.headers!['Sunset'] as string;
          expect(sunsetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deprecation headers are consistent across multiple requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of requests
        fc.array(
          fc.record({
            path: fc.constantFrom('/query', '/species/123', '/collections'),
            method: fc.constantFrom('GET', 'POST'),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (requests) => {
          const mockHandler = vi.fn().mockResolvedValue({
            statusCode: 200,
            body: JSON.stringify({ success: true }),
            headers: {},
          });

          const wrappedHandler = withVersioning(mockHandler);

          // Make all requests and collect deprecation headers
          const results = await Promise.all(
            requests.map((req) => {
              const event = {
                path: `/v1${req.path}`,
                httpMethod: req.method,
                headers: {},
              } as APIGatewayProxyEvent;
              return wrappedHandler(event);
            })
          );

          // Property: Deprecation headers should be consistent across all requests
          const firstSunset = results[0].headers!['Sunset'];
          const firstMessage = results[0].headers!['X-Deprecation-Message'];

          results.forEach((result) => {
            expect(result.headers).toHaveProperty('Deprecation', 'true');
            expect(result.headers!['Sunset']).toBe(firstSunset);
            expect(result.headers!['X-Deprecation-Message']).toBe(firstMessage);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('deprecation headers do not interfere with response body or status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 599 }),
        fc.record({
          data: fc.array(fc.string()),
          count: fc.integer(),
          success: fc.boolean(),
        }),
        async (statusCode, responseData) => {
          const mockHandler = vi.fn().mockResolvedValue({
            statusCode,
            body: JSON.stringify(responseData),
            headers: {
              'Content-Type': 'application/json',
              'X-Custom-Header': 'custom-value',
            },
          });

          const wrappedHandler = withVersioning(mockHandler);

          const event = {
            path: '/v1/query',
            httpMethod: 'POST',
            headers: {},
          } as APIGatewayProxyEvent;

          const result = await wrappedHandler(event);

          // Property: Deprecation headers should not modify response body or status
          expect(result.statusCode).toBe(statusCode);
          expect(JSON.parse(result.body)).toEqual(responseData);

          // Original headers should be preserved
          expect(result.headers).toHaveProperty('Content-Type', 'application/json');
          expect(result.headers).toHaveProperty('X-Custom-Header', 'custom-value');

          // Deprecation headers should be added
          expect(result.headers).toHaveProperty('Deprecation', 'true');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Link header points to correct successor version path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/query',
          '/species/123',
          '/collections',
          '/collections/user-123',
          '/data-sources'
        ),
        async (path) => {
          const mockHandler = vi.fn().mockResolvedValue({
            statusCode: 200,
            body: JSON.stringify({ success: true }),
            headers: {},
          });

          const wrappedHandler = withVersioning(mockHandler);

          const event = {
            path: `/v1${path}`,
            httpMethod: 'GET',
            headers: {},
          } as APIGatewayProxyEvent;

          const result = await wrappedHandler(event);

          // Property: Link header should point to the same path with successor version
          const linkHeader = result.headers!['Link'] as string;
          expect(linkHeader).toContain(`</v2${path}>`);
          expect(linkHeader).toContain('rel="successor-version"');
        }
      ),
      { numRuns: 100 }
    );
  });
});
