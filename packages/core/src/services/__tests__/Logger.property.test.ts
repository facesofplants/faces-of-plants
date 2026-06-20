/**
 * Property-based tests for Logger service
 * Feature: production-readiness, Property 11: Structured logging includes request IDs
 * Validates: Requirements 6.3
 */

import fc from 'fast-check';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Logger, type LogLevel, type LogContext } from '../Logger';

describe('Logger Property Tests', () => {
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

  /**
   * Property 11: Structured logging includes request IDs
   * For any log entry, the output should be valid JSON containing a requestId field
   */
  test('all log entries include requestId in JSON format', () => {
    fc.assert(
      fc.property(
        // Generate random log contexts
        fc.record({
          requestId: fc.uuid(),
          userId: fc.option(fc.uuid(), { nil: undefined }),
          operation: fc.constantFrom('query', 'auth', 'cache', 'provider-call', 'validation'),
          duration: fc.option(fc.integer({ min: 1, max: 10000 }), {
            nil: undefined,
          }),
        }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom<LogLevel>('ERROR', 'WARN', 'INFO', 'DEBUG'),
        (context: LogContext, message: string, level: LogLevel) => {
          // Create logger with JSON formatting enabled
          const logger = new Logger({
            minLevel: 'DEBUG',
            enableConsole: true,
            formatJson: true,
          });

          // Clear previous calls
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();
          consoleWarnSpy.mockClear();
          consoleDebugSpy.mockClear();

          // Log based on level
          switch (level) {
            case 'ERROR':
              logger.error(message, new Error('Test error'), context);
              break;
            case 'WARN':
              logger.warn(message, context);
              break;
            case 'INFO':
              logger.info(message, context);
              break;
            case 'DEBUG':
              logger.debug(message, context);
              break;
          }

          // Get the logged output
          let loggedOutput: string | undefined;
          if (level === 'ERROR' && consoleErrorSpy.mock.calls.length > 0) {
            loggedOutput = consoleErrorSpy.mock.calls[0][0];
          } else if (level === 'WARN' && consoleWarnSpy.mock.calls.length > 0) {
            loggedOutput = consoleWarnSpy.mock.calls[0][0];
          } else if (level === 'DEBUG' && consoleDebugSpy.mock.calls.length > 0) {
            loggedOutput = consoleDebugSpy.mock.calls[0][0];
          } else if (consoleLogSpy.mock.calls.length > 0) {
            loggedOutput = consoleLogSpy.mock.calls[0][0];
          }

          // Verify output exists
          expect(loggedOutput).toBeDefined();

          // Parse as JSON
          const logEntry = JSON.parse(loggedOutput!);

          // Verify required fields exist
          expect(logEntry).toHaveProperty('requestId');
          expect(logEntry).toHaveProperty('timestamp');
          expect(logEntry).toHaveProperty('level');
          expect(logEntry).toHaveProperty('message');
          expect(logEntry).toHaveProperty('operation');
          expect(logEntry).toHaveProperty('context');

          // Verify requestId matches input
          expect(logEntry.requestId).toBe(context.requestId);

          // Verify level matches
          expect(logEntry.level).toBe(level);

          // Verify message matches
          expect(logEntry.message).toBe(message);

          // Verify operation matches
          expect(logEntry.operation).toBe(context.operation);

          // Verify optional fields
          if (context.userId) {
            expect(logEntry.userId).toBe(context.userId);
          }

          if (context.duration !== undefined) {
            expect(logEntry.duration).toBe(context.duration);
          }

          // Verify timestamp is valid ISO string
          expect(() => new Date(logEntry.timestamp)).not.toThrow();
          expect(new Date(logEntry.timestamp).toISOString()).toBe(logEntry.timestamp);

          // For ERROR level, verify error object exists
          if (level === 'ERROR') {
            expect(logEntry).toHaveProperty('error');
            expect(logEntry.error).toHaveProperty('name');
            expect(logEntry.error).toHaveProperty('message');
            expect(logEntry.error).toHaveProperty('stack');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log level filtering works correctly
   * For any log level configuration, only logs at or above that level should be output
   */
  test('log level filtering respects minimum level', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>('ERROR', 'WARN', 'INFO', 'DEBUG'),
        fc.uuid(),
        (minLevel: LogLevel, requestId: string) => {
          const logger = new Logger({
            minLevel,
            enableConsole: true,
            formatJson: true,
          });

          const context: LogContext = {
            requestId,
            operation: 'test',
          };

          // Clear previous calls
          consoleLogSpy.mockClear();
          consoleErrorSpy.mockClear();
          consoleWarnSpy.mockClear();
          consoleDebugSpy.mockClear();

          // Try logging at all levels
          logger.debug('Debug message', context);
          logger.info('Info message', context);
          logger.warn('Warn message', context);
          logger.error('Error message', new Error('Test'), context);

          // Count total calls
          const totalCalls =
            consoleLogSpy.mock.calls.length +
            consoleErrorSpy.mock.calls.length +
            consoleWarnSpy.mock.calls.length +
            consoleDebugSpy.mock.calls.length;

          // Verify correct number of logs based on min level
          switch (minLevel) {
            case 'DEBUG':
              expect(totalCalls).toBe(4); // All levels
              break;
            case 'INFO':
              expect(totalCalls).toBe(3); // INFO, WARN, ERROR
              expect(consoleDebugSpy.mock.calls.length).toBe(0);
              break;
            case 'WARN':
              expect(totalCalls).toBe(2); // WARN, ERROR
              expect(consoleDebugSpy.mock.calls.length).toBe(0);
              expect(consoleLogSpy.mock.calls.length).toBe(0);
              break;
            case 'ERROR':
              expect(totalCalls).toBe(1); // ERROR only
              expect(consoleDebugSpy.mock.calls.length).toBe(0);
              expect(consoleLogSpy.mock.calls.length).toBe(0);
              expect(consoleWarnSpy.mock.calls.length).toBe(0);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Additional context fields are preserved
   * For any additional context fields, they should appear in the context object
   */
  test('additional context fields are preserved in log output', () => {
    fc.assert(
      fc.property(
        fc.record({
          requestId: fc.uuid(),
          operation: fc.string({ minLength: 1 }),
          customField1: fc.string(),
          customField2: fc.integer(),
          customField3: fc.boolean(),
        }),
        (context: LogContext) => {
          const logger = new Logger({
            minLevel: 'INFO',
            enableConsole: true,
            formatJson: true,
          });

          consoleLogSpy.mockClear();

          logger.info('Test message', context);

          const loggedOutput = consoleLogSpy.mock.calls[0][0];
          const logEntry = JSON.parse(loggedOutput);

          // Verify standard fields
          expect(logEntry.requestId).toBe(context.requestId);
          expect(logEntry.operation).toBe(context.operation);

          // Verify additional fields are in context
          expect(logEntry.context).toHaveProperty('customField1');
          expect(logEntry.context).toHaveProperty('customField2');
          expect(logEntry.context).toHaveProperty('customField3');
          expect(logEntry.context.customField1).toBe(context.customField1);
          expect(logEntry.context.customField2).toBe(context.customField2);
          expect(logEntry.context.customField3).toBe(context.customField3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error details are captured correctly
   * For any error logged, the error name, message, and stack should be included
   */
  test('error details are captured in error logs', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (requestId: string, errorName: string, errorMessage: string) => {
          const logger = new Logger({
            minLevel: 'ERROR',
            enableConsole: true,
            formatJson: true,
          });

          const context: LogContext = {
            requestId,
            operation: 'test-error',
          };

          const error = new Error(errorMessage);
          error.name = errorName;

          consoleErrorSpy.mockClear();

          logger.error('An error occurred', error, context);

          const loggedOutput = consoleErrorSpy.mock.calls[0][0];
          const logEntry = JSON.parse(loggedOutput);

          // Verify error object exists and has correct structure
          expect(logEntry).toHaveProperty('error');
          expect(logEntry.error).toHaveProperty('name');
          expect(logEntry.error).toHaveProperty('message');
          expect(logEntry.error).toHaveProperty('stack');

          // Verify error details match
          expect(logEntry.error.name).toBe(errorName);
          expect(logEntry.error.message).toBe(errorMessage);
          expect(typeof logEntry.error.stack).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});
