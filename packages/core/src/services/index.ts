// Services layer exports
export { RateLimiter } from './RateLimiter';
export type { RateLimitResult, RateLimiterConfig } from './RateLimiter';

export { CacheService } from './CacheService';

export { rateLimitMiddleware, tieredRateLimitMiddleware } from './rateLimitMiddleware';
export type { RateLimitMiddlewareConfig } from './rateLimitMiddleware';

export {
  extractUserTier,
  extractUserContext,
  getTierRateLimit,
  generateRateLimitKey,
  TIER_RATE_LIMITS,
} from './tieredRateLimiting';
export type { UserTier, TierRateLimitConfig, UserContext } from './tieredRateLimiting';

export { ServiceRegistry } from './ServiceRegistry';
export { ServiceExecutor } from './ServiceExecutor';
export type { ServiceHandler } from './ServiceExecutor';
export { LLMClient } from './llm';
export type { LLMRequest, LLMResponse } from './llm';
export { MultiSourceQueryEngine } from './queryEngine';
export type { MultiSourceQuery, MultiSourceResult, SourceExecutionResult } from './queryEngine';

export { ErrorHandler, ErrorResponseBuilder, errorHandler } from './ErrorHandler';
export type { ErrorContext } from './ErrorHandler';

export { RetryService, createRetryService, withRetry, DEFAULT_RETRY_CONFIG } from './RetryService';
export type { RetryConfig, RetryResult } from './RetryService';

export {
  TimeoutHandler,
  timeoutHandler,
  getRemainingTime,
  isApproachingTimeout,
} from './TimeoutHandler';
export type { TimeoutConfig } from './TimeoutHandler';

export { Logger, logger } from './Logger';
export type { LogLevel, LogContext, LogEntry, LoggerConfig } from './Logger';

export { MetricsService, metricsService } from './MetricsService';
export type { MetricsConfig, MetricData, MetricUnit } from './MetricsService';

export type * from './types';
