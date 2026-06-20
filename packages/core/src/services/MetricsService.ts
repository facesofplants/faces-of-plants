/**
 * Metrics service for CloudWatch metrics emission
 * Implements monitoring requirements from production readiness specification (Requirement 6.1)
 */

export interface MetricsConfig {
  namespace?: string;
  enabled?: boolean;
  environment?: string;
}

export interface MetricData {
  name: string;
  value: number;
  unit: MetricUnit;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export type MetricUnit = 'Seconds' | 'Microseconds' | 'Milliseconds' | 'Count' | 'Percent' | 'None';

/**
 * MetricsService provides CloudWatch metrics emission for observability
 *
 * In production, this will emit metrics to CloudWatch.
 * In development/test, metrics are logged but not sent to CloudWatch.
 */
export class MetricsService {
  private config: Required<MetricsConfig>;
  private cloudWatchClient: any; // Will be CloudWatchClient in production

  constructor(config: MetricsConfig = {}) {
    this.config = {
      namespace: config.namespace || 'FacesOfPlants',
      enabled: config.enabled !== false,
      environment: config.environment || process.env.NODE_ENV || 'development',
    };

    // Initialize CloudWatch client only in production/staging
    if (this.config.enabled && this.shouldEmitToCloudWatch()) {
      this.initializeCloudWatchClient();
    }
  }

  /**
   * Record an API request with status code and duration
   */
  recordRequest(path: string, method: string, statusCode: number, duration: number): void {
    // Record request count
    this.putMetric({
      name: 'RequestCount',
      value: 1,
      unit: 'Count',
      dimensions: {
        Path: path,
        Method: method,
        StatusCode: statusCode.toString(),
        Environment: this.config.environment,
      },
    });

    // Record request duration
    this.putMetric({
      name: 'RequestDuration',
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        Path: path,
        Method: method,
        Environment: this.config.environment,
      },
    });

    // Record error rate if status code indicates error
    if (statusCode >= 400) {
      this.putMetric({
        name: 'ErrorCount',
        value: 1,
        unit: 'Count',
        dimensions: {
          Path: path,
          Method: method,
          StatusCode: statusCode.toString(),
          Environment: this.config.environment,
        },
      });
    }
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(provider: string): void {
    this.putMetric({
      name: 'CacheHit',
      value: 1,
      unit: 'Count',
      dimensions: {
        Provider: provider,
        Environment: this.config.environment,
      },
    });
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(provider: string): void {
    this.putMetric({
      name: 'CacheMiss',
      value: 1,
      unit: 'Count',
      dimensions: {
        Provider: provider,
        Environment: this.config.environment,
      },
    });
  }

  /**
   * Record a provider API call with duration and success status
   */
  recordProviderCall(provider: string, duration: number, success: boolean): void {
    // Record provider call count
    this.putMetric({
      name: 'ProviderCallCount',
      value: 1,
      unit: 'Count',
      dimensions: {
        Provider: provider,
        Success: success.toString(),
        Environment: this.config.environment,
      },
    });

    // Record provider call duration
    this.putMetric({
      name: 'ProviderCallDuration',
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        Provider: provider,
        Environment: this.config.environment,
      },
    });

    // Record provider errors
    if (!success) {
      this.putMetric({
        name: 'ProviderErrorCount',
        value: 1,
        unit: 'Count',
        dimensions: {
          Provider: provider,
          Environment: this.config.environment,
        },
      });
    }
  }

  /**
   * Record an error occurrence
   */
  recordError(errorCode: string, path: string): void {
    this.putMetric({
      name: 'ErrorOccurrence',
      value: 1,
      unit: 'Count',
      dimensions: {
        ErrorCode: errorCode,
        Path: path,
        Environment: this.config.environment,
      },
    });
  }

  /**
   * Put a custom metric
   */
  putMetric(metric: MetricData): void {
    if (!this.config.enabled) {
      return;
    }

    // In development/test, just log the metric
    if (!this.shouldEmitToCloudWatch()) {
      this.logMetric(metric);
      return;
    }

    // In production, emit to CloudWatch
    this.emitToCloudWatch(metric);
  }

  /**
   * Determine if metrics should be sent to CloudWatch
   */
  private shouldEmitToCloudWatch(): boolean {
    return this.config.environment === 'production' || this.config.environment === 'staging';
  }

  /**
   * Initialize CloudWatch client for production use
   */
  private initializeCloudWatchClient(): void {
    // This will be implemented when AWS SDK is added
    // For now, we'll use a placeholder that logs
    this.cloudWatchClient = null;
  }

  /**
   * Emit metric to CloudWatch
   */
  private async emitToCloudWatch(metric: MetricData): Promise<void> {
    if (!this.cloudWatchClient) {
      // If CloudWatch client is not available, fall back to logging
      this.logMetric(metric);
      return;
    }

    try {
      // This will be implemented when AWS SDK is added
      // const command = new PutMetricDataCommand({
      //   Namespace: this.config.namespace,
      //   MetricData: [
      //     {
      //       MetricName: metric.name,
      //       Value: metric.value,
      //       Unit: metric.unit,
      //       Timestamp: metric.timestamp || new Date(),
      //       Dimensions: metric.dimensions
      //         ? Object.entries(metric.dimensions).map(([Name, Value]) => ({
      //             Name,
      //             Value,
      //           }))
      //         : undefined,
      //     },
      //   ],
      // });
      // await this.cloudWatchClient.send(command);
    } catch (error) {
      // Log error but don't throw - metrics should not break the application
      console.error('Failed to emit metric to CloudWatch:', error);
    }
  }

  /**
   * Log metric to console (for development/testing)
   */
  private logMetric(metric: MetricData): void {
    const logEntry = {
      type: 'metric',
      namespace: this.config.namespace,
      metric: metric.name,
      value: metric.value,
      unit: metric.unit,
      dimensions: metric.dimensions,
      timestamp: metric.timestamp || new Date(),
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Flush any pending metrics (for graceful shutdown)
   */
  async flush(): Promise<void> {
    // Placeholder for future implementation if we batch metrics
    return Promise.resolve();
  }
}

/**
 * Default metrics service instance for application-wide use
 */
export const metricsService = new MetricsService({
  namespace: 'FacesOfPlants',
  enabled: process.env.METRICS_ENABLED !== 'false',
  environment: process.env.NODE_ENV || 'development',
});
