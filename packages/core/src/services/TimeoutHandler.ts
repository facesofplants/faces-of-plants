import { type Context } from 'aws-lambda';

import { GatewayTimeoutError } from '../validation/errors';

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /**
   * Warning threshold in milliseconds (when to log warning)
   * Default: 80% of Lambda timeout
   */
  warningThreshold?: number;

  /**
   * Grace period before Lambda timeout in milliseconds
   * Default: 1000ms (1 second)
   */
  gracePeriod?: number;
}

/**
 * Timeout handler for Lambda functions
 */
export class TimeoutHandler {
  private readonly warningThreshold: number;
  private readonly gracePeriod: number;

  constructor(config: TimeoutConfig = {}) {
    this.gracePeriod = config.gracePeriod ?? 1000;
    this.warningThreshold = config.warningThreshold ?? 0.8;
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTime(context: Context): number {
    return context.getRemainingTimeInMillis();
  }

  /**
   * Check if we're approaching timeout
   */
  isApproachingTimeout(context: Context): boolean {
    const remaining = this.getRemainingTime(context);
    const timeout = this.getTimeoutDuration(context);
    const threshold = timeout * this.warningThreshold;

    return remaining <= timeout - threshold;
  }

  /**
   * Check if we should abort due to timeout
   */
  shouldAbort(context: Context): boolean {
    return this.getRemainingTime(context) <= this.gracePeriod;
  }

  /**
   * Get Lambda timeout duration in milliseconds
   */
  getTimeoutDuration(context: Context): number {
    // Extract timeout from function name or use default
    // Lambda context doesn't directly expose timeout, so we calculate it
    // from the initial remaining time on first call
    return 30000; // Default 30 seconds, should be configured per function
  }

  /**
   * Log timeout warning
   */
  logTimeoutWarning(context: Context, operation: string): void {
    const remaining = this.getRemainingTime(context);
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: 'Approaching Lambda timeout',
        requestId: context.awsRequestId,
        operation,
        remainingTimeMs: remaining,
        functionName: context.functionName,
      })
    );
  }

  /**
   * Log timeout error
   */
  logTimeout(context: Context, operation: string): void {
    const remaining = this.getRemainingTime(context);
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Lambda function timeout',
        requestId: context.awsRequestId,
        operation,
        remainingTimeMs: remaining,
        functionName: context.functionName,
      })
    );
  }

  /**
   * Throw timeout error
   */
  throwTimeoutError(context: Context, operation: string): never {
    this.logTimeout(context, operation);
    throw new GatewayTimeoutError('Request timeout - operation took too long to complete', {
      operation,
      requestId: context.awsRequestId,
      functionName: context.functionName,
    });
  }

  /**
   * Wrap an async operation with timeout detection
   */
  async withTimeout<T>(context: Context, operation: string, fn: () => Promise<T>): Promise<T> {
    // Check if we should abort before starting
    if (this.shouldAbort(context)) {
      this.throwTimeoutError(context, operation);
    }

    // Log warning if approaching timeout
    if (this.isApproachingTimeout(context)) {
      this.logTimeoutWarning(context, operation);
    }

    try {
      // Execute the operation
      const result = await fn();

      // Check again after operation completes
      if (this.shouldAbort(context)) {
        this.throwTimeoutError(context, operation);
      }

      return result;
    } catch (error) {
      // If it's already a timeout error, rethrow
      if (error instanceof GatewayTimeoutError) {
        throw error;
      }

      // Check if we timed out during the operation
      if (this.shouldAbort(context)) {
        this.throwTimeoutError(context, operation);
      }

      // Otherwise, rethrow the original error
      throw error;
    }
  }

  /**
   * Create a timeout-aware wrapper for Lambda handlers
   */
  wrapHandler<TEvent, TResult>(
    handler: (event: TEvent, context: Context) => Promise<TResult>
  ): (event: TEvent, context: Context) => Promise<TResult> {
    return async (event: TEvent, context: Context): Promise<TResult> => {
      try {
        return await this.withTimeout(context, 'handler', () => handler(event, context));
      } catch (error) {
        if (error instanceof GatewayTimeoutError) {
          // Return 504 response for API Gateway
          return {
            statusCode: 504,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(error.toJSON()),
          } as any;
        }
        throw error;
      }
    };
  }
}

/**
 * Default timeout handler instance
 */
export const timeoutHandler = new TimeoutHandler();

/**
 * Utility function to check remaining time
 */
export function getRemainingTime(context: Context): number {
  return context.getRemainingTimeInMillis();
}

/**
 * Utility function to check if approaching timeout
 */
export function isApproachingTimeout(context: Context, thresholdPercent = 0.8): boolean {
  const remaining = context.getRemainingTimeInMillis();
  // Estimate total timeout (this is approximate)
  const estimatedTotal = 30000; // 30 seconds default
  return remaining <= estimatedTotal * (1 - thresholdPercent);
}
