import { type APIGatewayProxyEvent } from 'aws-lambda';
import { describe, it, expect, vi } from 'vitest';

import { withVersioning, addDeprecationHeaders, getRequestVersion } from '../versioning';

describe('Versioning Middleware', () => {
  describe('withVersioning', () => {
    it('should extract version from path', async () => {
      const handler = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      });

      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/v1/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(handler).toHaveBeenCalledWith(event, 'v1');
      expect(result.headers).toHaveProperty('X-API-Version', 'v1');
    });

    it('should extract version from Accept-Version header', async () => {
      const handler = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      });

      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/query',
        headers: {
          'Accept-Version': 'v1',
        },
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(handler).toHaveBeenCalledWith(event, 'v1');
      expect(result.headers).toHaveProperty('X-API-Version', 'v1');
    });

    it('should use default version when no version specified', async () => {
      const handler = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      });

      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(handler).toHaveBeenCalledWith(event, 'v1'); // v1 is current default
      expect(result.headers).toHaveProperty('X-API-Version', 'v1');
    });

    it('should return 400 for unsupported version', async () => {
      const handler = vi.fn();
      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/v99/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(handler).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNSUPPORTED_API_VERSION');
      expect(body.error.supportedVersions).toContain('v1');
    });

    it('should prefer path version over header version', async () => {
      const handler = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      });

      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/v1/query',
        headers: {
          'Accept-Version': 'v2',
        },
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(handler).toHaveBeenCalledWith(event, 'v1');
    });

    it('should add deprecation headers for deprecated version (v1)', async () => {
      const handler = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      });

      const wrappedHandler = withVersioning(handler);

      const event = {
        path: '/v1/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const result = await wrappedHandler(event);

      expect(result.headers).toHaveProperty('Deprecation', 'true');
      expect(result.headers).toHaveProperty('Sunset', '2025-12-31');
      expect(result.headers).toHaveProperty('X-Deprecation-Message');
      expect(result.headers).toHaveProperty('Link');

      // Verify Link header format
      const linkHeader = result.headers!['Link'] as string;
      expect(linkHeader).toContain('</v2/query>');
      expect(linkHeader).toContain('rel="successor-version"');
    });
  });

  describe('addDeprecationHeaders', () => {
    it('should add deprecation headers for deprecated version (v1)', () => {
      const response = {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // v1 is now marked as deprecated
      const result = addDeprecationHeaders(response, 'v1');

      expect(result.headers).toHaveProperty('Deprecation', 'true');
      expect(result.headers).toHaveProperty('Sunset', '2025-12-31');
      expect(result.headers).toHaveProperty('X-Deprecation-Message');
      expect(result.headers).toHaveProperty('X-Successor-Version', 'v2');
    });

    it('should preserve existing headers when adding deprecation headers', () => {
      const response = {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      };

      const result = addDeprecationHeaders(response, 'v1');

      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('X-Custom-Header', 'custom-value');
      expect(result.headers).toHaveProperty('Deprecation', 'true');
    });
  });

  describe('getRequestVersion', () => {
    it('should extract version from path', () => {
      const event = {
        path: '/v1/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const version = getRequestVersion(event);
      expect(version).toBe('v1');
    });

    it('should extract version from header', () => {
      const event = {
        path: '/query',
        headers: {
          'Accept-Version': 'v1',
        },
      } as APIGatewayProxyEvent;

      const version = getRequestVersion(event);
      expect(version).toBe('v1');
    });

    it('should return default version when none specified', () => {
      const event = {
        path: '/query',
        headers: {},
      } as APIGatewayProxyEvent;

      const version = getRequestVersion(event);
      expect(version).toBe('v1'); // Current default
    });

    it('should handle case-insensitive headers', () => {
      const event = {
        path: '/query',
        headers: {
          'accept-version': 'v1',
        },
      } as APIGatewayProxyEvent;

      const version = getRequestVersion(event);
      expect(version).toBe('v1');
    });
  });
});
