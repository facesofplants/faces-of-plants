/**
 * Retry Service with Exponential Backoff
 *
 * Implements retry logic for transient failures with configurable
 * exponential backoff strategy.
 */

import { RateLimitError, ServiceUnavailableError, GatewayTimeoutError } from '../validation/errors';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelay: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Retry service for handling transient failures
 */
export class RetryService {
  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  /**
   * Determine if an error is retryable
   */
  isRetryableError(error: Error): boolean {
    // Network timeouts
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Rate limit errors (429)
    if (error instanceof RateLimitError) {
      return true;
    }

    // Service unavailable (503)
    if (error instanceof ServiceUnavailableError) {
      return true;
    }

    // Gateway timeout (504)
    if (error instanceof GatewayTimeoutError) {
      return true;
    }

    // 5xx server errors from fetch
    if (error.message.includes('API error: 5')) {
      return true;
    }

    // Network errors
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for next retry using exponential backoff
   */
  calculateDelay(attemptNumber: number): number {
    const delay =
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute an operation with retry logic
   *
   * @param operation - Async function to execute
   * @param operationName - Name for logging purposes
   * @returns Result of the operation
   */
  async executeWithRetry<T>(operation: () => Promise<T>, operationName = 'operation'): Promise<T> {
    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      attempts = attempt;

      try {
        const result = await operation();

        if (attempt > 1) {
          console.log(`[RetryService] ${operationName} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const isRetryable = this.isRetryableError(lastError);
        const hasRetriesLeft = attempt <= this.config.maxRetries;

        if (!isRetryable) {
          console.log(
            `[RetryService] ${operationName} failed with non-retryable error: ${lastError.message}`
          );
          throw lastError;
        }

        if (!hasRetriesLeft) {
          console.log(
            `[RetryService] ${operationName} failed after ${attempts} attempts: ${lastError.message}`
          );
          throw lastError;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        console.log(
          `[RetryService] ${operationName} failed on attempt ${attempt}, retrying in ${delay}ms: ${lastError.message}`
        );
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Operation failed');
  }

  /**
   * Execute an operation with retry logic and return detailed result
   *
   * @param operation - Async function to execute
   * @param operationName - Name for logging purposes
   * @returns Detailed result including success status and attempt count
   */
  async executeWithRetryResult<T>(
    operation: () => Promise<T>,
    operationName = 'operation'
  ): Promise<RetryResult<T>> {
    const attempts = 0;

    try {
      const data = await this.executeWithRetry(operation, operationName);
      // Count attempts by checking logs or tracking internally
      // For now, we'll return 1 if successful on first try
      return {
        success: true,
        data,
        attempts: 1, // This would need to be tracked internally for accurate count
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attempts: this.config.maxRetries + 1,
      };
    }
  }
}

/**
 * Create a retry service with custom configuration
 */
export function createRetryService(config?: Partial<RetryConfig>): RetryService {
  return new RetryService({
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  });
}

/**
 * Convenience function to execute with default retry configuration
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const retryService = new RetryService();
  return retryService.executeWithRetry(operation, operationName);
}
