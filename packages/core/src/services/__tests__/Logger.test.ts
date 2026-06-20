/**
 * Unit tests for Logger service
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Logger, LogLevel, type LogContext } from '../Logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('creates logger with default configuration', () => {
      const logger = new Logger();
      expect(logger.getMinLevel()).toBe('INFO');
    });

    test('creates logger with custom min level', () => {
      const logger = new Logger({ minLevel: 'DEBUG' });
      expect(logger.getMinLevel()).toBe('DEBUG');
    });

    test('allows changing min level after creation', () => {
      const logger = new Logger({ minLevel: 'INFO' });
      expect(logger.getMinLevel()).toBe('INFO');

      logger.setMinLevel('ERROR');
      expect(logger.getMinLevel()).toBe('ERROR');
    });
  });

  describe('Log Level Methods', () => {
    test('info() logs at INFO level', () => {
      const logger = new Logger({ minLevel: 'INFO', formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.info('Test message', context);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('INFO');
      expect(logOutput.message).toBe('Test message');
    });

    test('warn() logs at WARN level', () => {
      const logger = new Logger({ minLevel: 'WARN', formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.warn('Warning message', context);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('WARN');
      expect(logOutput.message).toBe('Warning message');
    });

    test('error() logs at ERROR level with error details', () => {
      const logger = new Logger({ minLevel: 'ERROR', formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };
      const error = new Error('Test error');

      logger.error('Error occurred', error, context);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('ERROR');
      expect(logOutput.message).toBe('Error occurred');
      expect(logOutput.error).toBeDefined();
      expect(logOutput.error.name).toBe('Error');
      expect(logOutput.error.message).toBe('Test error');
      expect(logOutput.error.stack).toBeDefined();
    });

    test('debug() logs at DEBUG level', () => {
      const logger = new Logger({ minLevel: 'DEBUG', formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.debug('Debug message', context);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('DEBUG');
      expect(logOutput.message).toBe('Debug message');
    });
  });

  describe('Log Level Filtering', () => {
    test('DEBUG level logs all messages', () => {
      const logger = new Logger({ minLevel: 'DEBUG' });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.debug('Debug', context);
      logger.info('Info', context);
      logger.warn('Warn', context);
      logger.error('Error', new Error(), context);

      const totalCalls =
        consoleDebugSpy.mock.calls.length +
        consoleLogSpy.mock.calls.length +
        consoleWarnSpy.mock.calls.length +
        consoleErrorSpy.mock.calls.length;

      expect(totalCalls).toBe(4);
    });

    test('INFO level filters out DEBUG', () => {
      const logger = new Logger({ minLevel: 'INFO' });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.debug('Debug', context);
      logger.info('Info', context);
      logger.warn('Warn', context);
      logger.error('Error', new Error(), context);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('WARN level filters out DEBUG and INFO', () => {
      const logger = new Logger({ minLevel: 'WARN' });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.debug('Debug', context);
      logger.info('Info', context);
      logger.warn('Warn', context);
      logger.error('Error', new Error(), context);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('ERROR level only logs errors', () => {
      const logger = new Logger({ minLevel: 'ERROR' });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.debug('Debug', context);
      logger.info('Info', context);
      logger.warn('Warn', context);
      logger.error('Error', new Error(), context);

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('JSON Formatting', () => {
    test('formats logs as JSON when formatJson is true', () => {
      const logger = new Logger({ formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.info('Test', context);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('message');
      expect(parsed).toHaveProperty('requestId');
    });

    test('formats logs as human-readable when formatJson is false', () => {
      const logger = new Logger({ formatJson: false });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.info('Test message', context);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(typeof output).toBe('string');
      expect(output).toContain('test-123');
      expect(output).toContain('INFO');
      expect(output).toContain('Test message');
      expect(output).toContain('test-op');
    });

    test('formats error logs with stack trace in human-readable format', () => {
      const logger = new Logger({ formatJson: false });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };
      const error = new Error('Test error');

      logger.error('Error occurred', error, context);

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('Error occurred');
      expect(output).toContain('Error: Test error');
      expect(output).toContain(error.stack || '');
    });

    test('formats logs with additional context in human-readable format', () => {
      const logger = new Logger({ formatJson: false });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
        customField: 'custom-value',
      };

      logger.info('Test message', context);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Context:');
      expect(output).toContain('customField');
      expect(output).toContain('custom-value');
    });
  });

  describe('Context Handling', () => {
    test('includes required context fields in log output', () => {
      const logger = new Logger({ formatJson: true });
      const context: LogContext = {
        requestId: 'req-456',
        userId: 'user-789',
        operation: 'query-data',
        duration: 150,
      };

      logger.info('Operation complete', context);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-456');
      expect(logOutput.userId).toBe('user-789');
      expect(logOutput.operation).toBe('query-data');
      expect(logOutput.duration).toBe(150);
    });

    test('handles optional context fields', () => {
      const logger = new Logger({ formatJson: true });
      const context: LogContext = {
        requestId: 'req-456',
        operation: 'query-data',
      };

      logger.info('Operation complete', context);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-456');
      expect(logOutput.operation).toBe('query-data');
      expect(logOutput.userId).toBeUndefined();
      expect(logOutput.duration).toBeUndefined();
    });

    test('extracts additional context fields', () => {
      const logger = new Logger({ formatJson: true });
      const context: LogContext = {
        requestId: 'req-456',
        operation: 'query-data',
        customField: 'custom-value',
        anotherField: 123,
      };

      logger.info('Test', context);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.context).toHaveProperty('customField', 'custom-value');
      expect(logOutput.context).toHaveProperty('anotherField', 123);
    });
  });

  describe('Timestamp', () => {
    test('includes valid ISO timestamp', () => {
      const logger = new Logger({ formatJson: true });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.info('Test', context);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.timestamp).toBeDefined();

      // Verify it's a valid ISO string
      const date = new Date(logOutput.timestamp);
      expect(date.toISOString()).toBe(logOutput.timestamp);
    });
  });

  describe('Console Output Disabled', () => {
    test('does not output to console when enableConsole is false', () => {
      const logger = new Logger({ enableConsole: false });
      const context: LogContext = {
        requestId: 'test-123',
        operation: 'test-op',
      };

      logger.info('Test', context);
      logger.warn('Test', context);
      logger.error('Test', new Error(), context);
      logger.debug('Test', context);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });
});
