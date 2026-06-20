/**
 * Unit tests for RetryService
 *
 * Tests retry count, backoff timing, retryable vs non-retryable errors,
 * and max retry limit enforcement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  RateLimitError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  ValidationError,
  AuthenticationError,
} from '../../validation/errors';
import { RetryService, DEFAULT_RETRY_CONFIG, createRetryService, withRetry } from '../RetryService';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = new RetryService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should identify timeout errors as retryable', () => {
      const timeoutError = new Error('Request timeout');
      expect(retryService.isRetryableError(timeoutError)).toBe(true);

      const etimedoutError = new Error('ETIMEDOUT');
      expect(retryService.isRetryableError(etimedoutError)).toBe(true);
    });

    it('should identify rate limit errors as retryable', () => {
      const rateLimitError = new RateLimitError('Too many requests');
      expect(retryService.isRetryableError(rateLimitError)).toBe(true);
    });

    it('should identify service unavailable errors as retryable', () => {
      const serviceError = new ServiceUnavailableError('Service down');
      expect(retryService.isRetryableError(serviceError)).toBe(true);
    });

    it('should identify gateway timeout errors as retryable', () => {
      const gatewayError = new GatewayTimeoutError('Gateway timeout');
      expect(retryService.isRetryableError(gatewayError)).toBe(true);
    });

    it('should identify 5xx server errors as retryable', () => {
      const serverError = new Error('API error: 500');
      expect(retryService.isRetryableError(serverError)).toBe(true);

      const serverError503 = new Error('API error: 503');
      expect(retryService.isRetryableError(serverError503)).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      const fetchError = new Error('fetch failed');
      expect(retryService.isRetryableError(fetchError)).toBe(true);

      const networkError = new Error('network error');
      expect(retryService.isRetryableError(networkError)).toBe(true);

      const connRefused = new Error('ECONNREFUSED');
      expect(retryService.isRetryableError(connRefused)).toBe(true);

      const notFound = new Error('ENOTFOUND');
      expect(retryService.isRetryableError(notFound)).toBe(true);
    });

    it('should identify validation errors as non-retryable', () => {
      const validationError = new ValidationError('Invalid input', []);
      expect(retryService.isRetryableError(validationError)).toBe(false);
    });

    it('should identify authentication errors as non-retryable', () => {
      const authError = new AuthenticationError('Invalid token');
      expect(retryService.isRetryableError(authError)).toBe(false);
    });

    it('should identify 4xx client errors as non-retryable', () => {
      const clientError = new Error('API error: 400');
      expect(retryService.isRetryableError(clientError)).toBe(false);

      const notFoundError = new Error('API error: 404');
      expect(retryService.isRetryableError(notFoundError)).toBe(false);
    });

    it('should identify generic errors as non-retryable', () => {
      const genericError = new Error('Something went wrong');
      expect(retryService.isRetryableError(genericError)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff delays', () => {
      const service = new RetryService({
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      });

      // First retry: 1000 * 2^0 = 1000ms
      expect(service.calculateDelay(1)).toBe(1000);

      // Second retry: 1000 * 2^1 = 2000ms
      expect(service.calculateDelay(2)).toBe(2000);

      // Third retry: 1000 * 2^2 = 4000ms
      expect(service.calculateDelay(3)).toBe(4000);

      // Fourth retry: 1000 * 2^3 = 8000ms
      expect(service.calculateDelay(4)).toBe(8000);
    });

    it('should cap delay at maxDelay', () => {
      const service = new RetryService({
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      });

      // Should be capped at 5000ms
      expect(service.calculateDelay(5)).toBe(5000);
      expect(service.calculateDelay(10)).toBe(5000);
    });

    it('should use default configuration values', () => {
      const service = new RetryService();

      expect(service.calculateDelay(1)).toBe(DEFAULT_RETRY_CONFIG.initialDelay);
      expect(service.calculateDelay(2)).toBe(DEFAULT_RETRY_CONFIG.initialDelay * 2);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt without retrying', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryService.executeWithRetry(operation, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new ServiceUnavailableError())
        .mockResolvedValue('success');

      const promise = retryService.executeWithRetry(operation, 'test-op');

      // Fast-forward through delays
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-retryable errors', async () => {
      const validationError = new ValidationError('Invalid input', []);
      const operation = vi.fn().mockRejectedValue(validationError);

      await expect(retryService.executeWithRetry(operation, 'test-op')).rejects.toThrow(
        validationError
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry limit', async () => {
      const service = new RetryService({
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      });

      const operation = vi.fn().mockRejectedValue(new Error('timeout'));

      // Start the promise and immediately set up the expectation
      const promise = service.executeWithRetry(operation, 'test-op').catch((err) => err);

      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry
      await vi.advanceTimersByTimeAsync(400); // Third retry

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('timeout');
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should use correct backoff timing', async () => {
      const service = new RetryService({
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const promise = service.executeWithRetry(operation, 'test-op');

      // Advance through all delays
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      await vi.advanceTimersByTimeAsync(2000); // Second retry delay

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limit errors with retry', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RateLimitError('Too many requests', 60))
        .mockResolvedValue('success');

      const promise = retryService.executeWithRetry(operation, 'test-op');

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle gateway timeout errors with retry', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GatewayTimeoutError())
        .mockResolvedValue('success');

      const promise = retryService.executeWithRetry(operation, 'test-op');

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw authentication errors immediately without retry', async () => {
      const authError = new AuthenticationError('Invalid token');
      const operation = vi.fn().mockRejectedValue(authError);

      await expect(retryService.executeWithRetry(operation, 'test-op')).rejects.toThrow(authError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRetryService', () => {
    it('should create service with default config', () => {
      const service = createRetryService();
      expect(service).toBeInstanceOf(RetryService);
    });

    it('should create service with custom config', () => {
      const service = createRetryService({
        maxRetries: 5,
        initialDelay: 500,
      });

      expect(service.calculateDelay(1)).toBe(500);
    });

    it('should merge custom config with defaults', () => {
      const service = createRetryService({
        maxRetries: 5,
      });

      // Should use custom maxRetries but default initialDelay
      expect(service.calculateDelay(1)).toBe(DEFAULT_RETRY_CONFIG.initialDelay);
    });
  });

  describe('withRetry', () => {
    it('should execute operation with default retry config', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry with default config on retryable errors', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const promise = withRetry(operation, 'test-op');

      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle operations that throw non-Error objects', async () => {
      const operation = vi.fn().mockRejectedValue('string error');

      await expect(retryService.executeWithRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operations that return undefined', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      const result = await retryService.executeWithRetry(operation);

      expect(result).toBeUndefined();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operations that return null', async () => {
      const operation = vi.fn().mockResolvedValue(null);

      const result = await retryService.executeWithRetry(operation);

      expect(result).toBeNull();
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
