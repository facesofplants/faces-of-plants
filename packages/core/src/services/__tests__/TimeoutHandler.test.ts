import { type Context } from 'aws-lambda';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GatewayTimeoutError } from '../../validation/errors';
import { TimeoutHandler, getRemainingTime, isApproachingTimeout } from '../TimeoutHandler';

// Mock Lambda context
function createMockContext(remainingTimeMs: number): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => remainingTimeMs,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  } as Context;
}

describe('TimeoutHandler', () => {
  let handler: TimeoutHandler;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    handler = new TimeoutHandler();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getRemainingTime', () => {
    it('should return remaining time from context', () => {
      const context = createMockContext(5000);
      expect(handler.getRemainingTime(context)).toBe(5000);
    });
  });

  describe('isApproachingTimeout', () => {
    it('should return false when plenty of time remains', () => {
      const context = createMockContext(25000); // 25 seconds remaining
      expect(handler.isApproachingTimeout(context)).toBe(false);
    });

    it('should return true when approaching timeout threshold', () => {
      const context = createMockContext(5000); // 5 seconds remaining
      expect(handler.isApproachingTimeout(context)).toBe(true);
    });
  });

  describe('shouldAbort', () => {
    it('should return false when time remains above grace period', () => {
      const context = createMockContext(2000); // 2 seconds remaining
      expect(handler.shouldAbort(context)).toBe(false);
    });

    it('should return true when within grace period', () => {
      const context = createMockContext(500); // 500ms remaining
      expect(handler.shouldAbort(context)).toBe(true);
    });

    it('should respect custom grace period', () => {
      const customHandler = new TimeoutHandler({ gracePeriod: 2000 });
      const context = createMockContext(1500); // 1.5 seconds remaining
      expect(customHandler.shouldAbort(context)).toBe(true);
    });
  });

  describe('logTimeoutWarning', () => {
    it('should log warning with context information', () => {
      const context = createMockContext(5000);
      handler.logTimeoutWarning(context, 'test-operation');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const logEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('WARN');
      expect(logEntry.message).toBe('Approaching Lambda timeout');
      expect(logEntry.requestId).toBe('test-request-id');
      expect(logEntry.operation).toBe('test-operation');
      expect(logEntry.remainingTimeMs).toBe(5000);
    });
  });

  describe('logTimeout', () => {
    it('should log error with context information', () => {
      const context = createMockContext(500);
      handler.logTimeout(context, 'test-operation');

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('Lambda function timeout');
      expect(logEntry.requestId).toBe('test-request-id');
      expect(logEntry.operation).toBe('test-operation');
    });
  });

  describe('throwTimeoutError', () => {
    it('should throw GatewayTimeoutError with details', () => {
      const context = createMockContext(500);

      expect(() => {
        handler.throwTimeoutError(context, 'test-operation');
      }).toThrow(GatewayTimeoutError);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include operation and request details in error', () => {
      const context = createMockContext(500);

      try {
        handler.throwTimeoutError(context, 'test-operation');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(GatewayTimeoutError);
        const timeoutError = error as GatewayTimeoutError;
        expect(timeoutError.details?.operation).toBe('test-operation');
        expect(timeoutError.details?.requestId).toBe('test-request-id');
        expect(timeoutError.details?.functionName).toBe('test-function');
      }
    });
  });

  describe('withTimeout', () => {
    it('should execute operation successfully when time permits', async () => {
      const context = createMockContext(10000);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.withTimeout(context, 'test-op', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should throw timeout error if should abort before operation', async () => {
      const context = createMockContext(500); // Within grace period
      const operation = vi.fn().mockResolvedValue('success');

      await expect(handler.withTimeout(context, 'test-op', operation)).rejects.toThrow(
        GatewayTimeoutError
      );

      expect(operation).not.toHaveBeenCalled();
    });

    it('should log warning when approaching timeout', async () => {
      const context = createMockContext(5000); // Approaching timeout
      const operation = vi.fn().mockResolvedValue('success');

      await handler.withTimeout(context, 'test-op', operation);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should propagate non-timeout errors', async () => {
      const context = createMockContext(10000);
      const testError = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(testError);

      await expect(handler.withTimeout(context, 'test-op', operation)).rejects.toThrow(
        'Test error'
      );
    });

    it('should rethrow GatewayTimeoutError without modification', async () => {
      const context = createMockContext(10000);
      const timeoutError = new GatewayTimeoutError('Already timed out');
      const operation = vi.fn().mockRejectedValue(timeoutError);

      await expect(handler.withTimeout(context, 'test-op', operation)).rejects.toThrow(
        GatewayTimeoutError
      );
    });
  });

  describe('wrapHandler', () => {
    it('should execute handler successfully', async () => {
      const context = createMockContext(10000);
      const event = { test: 'event' };
      const handler = vi.fn().mockResolvedValue({ statusCode: 200 });

      const wrapped = new TimeoutHandler().wrapHandler(handler);
      const result = await wrapped(event, context);

      expect(result).toEqual({ statusCode: 200 });
      expect(handler).toHaveBeenCalledWith(event, context);
    });

    it('should return 504 response on timeout', async () => {
      const context = createMockContext(500); // Within grace period
      const event = { test: 'event' };
      const handler = vi.fn().mockResolvedValue({ statusCode: 200 });

      const wrapped = new TimeoutHandler().wrapHandler(handler);
      const result = await wrapped(event, context);

      expect(result.statusCode).toBe(504);
      expect(JSON.parse(result.body).error.code).toBe('GATEWAY_TIMEOUT');
    });

    it('should propagate non-timeout errors', async () => {
      const context = createMockContext(10000);
      const event = { test: 'event' };
      const testError = new Error('Test error');
      const handler = vi.fn().mockRejectedValue(testError);

      const wrapped = new TimeoutHandler().wrapHandler(handler);

      await expect(wrapped(event, context)).rejects.toThrow('Test error');
    });
  });

  describe('utility functions', () => {
    it('getRemainingTime should return remaining time', () => {
      const context = createMockContext(5000);
      expect(getRemainingTime(context)).toBe(5000);
    });

    it('isApproachingTimeout should detect approaching timeout', () => {
      const context = createMockContext(5000);
      expect(isApproachingTimeout(context, 0.8)).toBe(true);
    });

    it('isApproachingTimeout should return false with plenty of time', () => {
      const context = createMockContext(25000);
      expect(isApproachingTimeout(context, 0.8)).toBe(false);
    });
  });
});
