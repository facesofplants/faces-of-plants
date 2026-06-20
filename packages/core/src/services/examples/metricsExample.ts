/**
 * Example usage of the MetricsService
 * Demonstrates CloudWatch metrics emission for observability
 */

import { MetricsService, metricsService, type MetricData } from '../MetricsService';

// Example 1: Using the default metrics service
export function exampleDefaultMetrics() {
  // Record an API request
  metricsService.recordRequest('/api/query', 'POST', 200, 150);

  // Record cache operations
  metricsService.recordCacheHit('gbif');
  metricsService.recordCacheMiss('inaturalist');

  // Record provider calls
  metricsService.recordProviderCall('gbif', 250, true);
  metricsService.recordProviderCall('eol', 500, false);

  // Record errors
  metricsService.recordError('VALIDATION_ERROR', '/api/query');
}

// Example 2: Lambda function with metrics
export async function exampleLambdaWithMetrics(event: any) {
  const startTime = Date.now();
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = { success: true };

    // Record successful request
    const duration = Date.now() - startTime;
    metricsService.recordRequest(path, method, 200, duration);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Record failed request
    metricsService.recordRequest(path, method, 500, duration);
    metricsService.recordError('INTERNAL_ERROR', path);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Example 3: Metrics middleware
export function exampleMetricsMiddleware() {
  return (handler: any) => {
    return async (event: any) => {
      const startTime = Date.now();
      const path = event.path;
      const method = event.httpMethod;

      try {
        const result = await handler(event);
        const duration = Date.now() - startTime;

        metricsService.recordRequest(path, method, result.statusCode, duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        metricsService.recordRequest(path, method, 500, duration);
        metricsService.recordError('UNHANDLED_ERROR', path);

        throw error;
      }
    };
  };
}

// Example 4: Cache with metrics
export class ExampleCachedService {
  private cache: Map<string, any> = new Map();

  async getData(key: string): Promise<any> {
    // Check cache
    if (this.cache.has(key)) {
      metricsService.recordCacheHit('example-service');
      return this.cache.get(key);
    }

    // Cache miss
    metricsService.recordCacheMiss('example-service');

    // Fetch data
    const startTime = Date.now();
    try {
      const data = await this.fetchFromSource(key);
      const duration = Date.now() - startTime;

      metricsService.recordProviderCall('example-source', duration, true);

      // Cache the result
      this.cache.set(key, data);

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordProviderCall('example-source', duration, false);
      throw error;
    }
  }

  private async fetchFromSource(key: string): Promise<any> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { key, data: 'example' };
  }
}

// Example 5: Custom metrics
export function exampleCustomMetrics() {
  // User signup metric
  const signupMetric: MetricData = {
    name: 'UserSignup',
    value: 1,
    unit: 'Count',
    dimensions: {
      Source: 'web',
      Plan: 'free',
    },
  };
  metricsService.putMetric(signupMetric);

  // Database query performance
  const queryMetric: MetricData = {
    name: 'DatabaseQueryDuration',
    value: 45,
    unit: 'Milliseconds',
    dimensions: {
      Table: 'users',
      Operation: 'scan',
    },
  };
  metricsService.putMetric(queryMetric);

  // Business metric
  const revenueMetric: MetricData = {
    name: 'Revenue',
    value: 99.99,
    unit: 'None',
    dimensions: {
      Currency: 'USD',
      Plan: 'premium',
    },
  };
  metricsService.putMetric(revenueMetric);
}

// Example 6: Creating environment-specific metrics services
export function exampleEnvironmentSpecificMetrics() {
  // Development metrics (logs only)
  const devMetrics = new MetricsService({
    namespace: 'FacesOfPlants-Dev',
    enabled: true,
    environment: 'development',
  });

  devMetrics.recordRequest('/test', 'GET', 200, 50);

  // Production metrics (CloudWatch)
  const prodMetrics = new MetricsService({
    namespace: 'FacesOfPlants',
    enabled: true,
    environment: 'production',
  });

  prodMetrics.recordRequest('/api/query', 'POST', 200, 150);

  // Disabled metrics (for testing)
  const noMetrics = new MetricsService({
    enabled: false,
  });

  noMetrics.recordRequest('/test', 'GET', 200, 50); // No-op
}

// Example 7: Multi-provider query with metrics
export async function exampleMultiProviderQuery(query: string) {
  const providers = ['gbif', 'inaturalist', 'eol'];
  const results = [];

  for (const provider of providers) {
    const startTime = Date.now();

    try {
      // Simulate provider call
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
      const data = { provider, results: [] };

      const duration = Date.now() - startTime;
      metricsService.recordProviderCall(provider, duration, true);

      results.push(data);
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordProviderCall(provider, duration, false);
      metricsService.recordError('PROVIDER_ERROR', `/query/${provider}`);
    }
  }

  return results;
}

// Example 8: Error handling with metrics
export async function exampleErrorHandling() {
  try {
    // Simulate operation that might fail
    const random = Math.random();
    if (random < 0.3) {
      throw new Error('Validation failed');
    } else if (random < 0.6) {
      throw new Error('Database error');
    }

    return { success: true };
  } catch (error) {
    const errorMessage = (error as Error).message;

    if (errorMessage.includes('Validation')) {
      metricsService.recordError('VALIDATION_ERROR', '/api/operation');
    } else if (errorMessage.includes('Database')) {
      metricsService.recordError('DATABASE_ERROR', '/api/operation');
    } else {
      metricsService.recordError('UNKNOWN_ERROR', '/api/operation');
    }

    throw error;
  }
}

// Example 9: Batch processing with metrics
export async function exampleBatchProcessing(items: any[]) {
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (const item of items) {
    try {
      await processItem(item);
      successCount++;
    } catch (error) {
      errorCount++;
      metricsService.recordError('BATCH_ITEM_ERROR', '/batch/process');
    }
  }

  const duration = Date.now() - startTime;

  // Record batch metrics
  metricsService.putMetric({
    name: 'BatchProcessed',
    value: items.length,
    unit: 'Count',
    dimensions: {
      Status: 'completed',
    },
  });

  metricsService.putMetric({
    name: 'BatchSuccessRate',
    value: (successCount / items.length) * 100,
    unit: 'Percent',
  });

  metricsService.putMetric({
    name: 'BatchDuration',
    value: duration,
    unit: 'Milliseconds',
  });

  return { successCount, errorCount, duration };
}

async function processItem(item: any): Promise<void> {
  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, 10));
}

// Example 10: Graceful shutdown with metrics flush
export async function exampleGracefulShutdown() {
  // Perform cleanup operations
  console.log('Shutting down...');

  // Flush any pending metrics
  await metricsService.flush();

  console.log('Metrics flushed, shutdown complete');
}
