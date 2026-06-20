import { type RateLimitRepository } from '../repository/RateLimitRepository';

/**
 * Rate limiting result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number; // in seconds
}

/**
 * RateLimiter service implementing token bucket algorithm
 *
 * The token bucket algorithm maintains a bucket of tokens that refills at a constant rate.
 * Each request consumes one token. If no tokens are available, the request is rate limited.
 */
export class RateLimiter {
  private readonly repository: RateLimitRepository;
  private readonly config: RateLimiterConfig;

  constructor(repository: RateLimitRepository, config: RateLimiterConfig) {
    this.repository = repository;
    this.config = config;
  }

  /**
   * Check if a request is allowed under the rate limit
   * @param key - The rate limit key (IP address or user ID)
   * @param limit - The maximum number of requests allowed (defaults to config capacity)
   * @param window - The time window in seconds (defaults to config refillInterval)
   * @returns RateLimitResult indicating if the request is allowed
   */
  async checkLimit(key: string, limit?: number, window?: number): Promise<RateLimitResult> {
    const capacity = limit || this.config.capacity;
    const refillInterval = window || this.config.refillInterval;

    // Get remaining tokens
    const remaining = await this.repository.getRemainingTokens(
      key,
      capacity,
      this.config.refillRate,
      refillInterval
    );

    // Calculate reset time
    const entry = await this.repository.getLimit(key);
    const now = Math.floor(Date.now() / 1000);
    const lastRefill = entry?.lastRefill || now;
    const timeSinceLastRefill = now - lastRefill;
    const intervalsElapsed = Math.floor(timeSinceLastRefill / refillInterval);
    const nextRefillTime = lastRefill + (intervalsElapsed + 1) * refillInterval;
    const resetAt = new Date(nextRefillTime * 1000);

    // Check if request is allowed
    if (remaining < 1) {
      const retryAfter = nextRefillTime - now;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1, // Account for the token that will be consumed
      resetAt,
    };
  }

  /**
   * Consume a token from the bucket
   * @param key - The rate limit key (IP address or user ID)
   * @returns true if token was consumed, false if rate limit exceeded
   */
  async consumeToken(key: string): Promise<boolean> {
    const result = await this.repository.consumeTokens(
      key,
      1, // Consume 1 token
      this.config.capacity,
      this.config.refillRate,
      this.config.refillInterval
    );

    return result !== null;
  }

  /**
   * Get the number of remaining tokens for a key
   * @param key - The rate limit key (IP address or user ID)
   * @returns The number of remaining tokens
   */
  async getRemainingTokens(key: string): Promise<number> {
    return this.repository.getRemainingTokens(
      key,
      this.config.capacity,
      this.config.refillRate,
      this.config.refillInterval
    );
  }
}
