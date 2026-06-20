# MetricsService

## Overview

The MetricsService provides CloudWatch metrics emission for production-ready observability. It implements the monitoring requirements from the production readiness specification (Requirement 6.1).

## Features

- **Request Metrics**: Track request count, duration, and error rates
- **Cache Metrics**: Monitor cache hit/miss rates
- **Provider Metrics**: Track external API call performance
- **Error Metrics**: Record error occurrences by type and location
- **Custom Metrics**: Support for application-specific metrics
- **Environment-Aware**: Logs metrics in development, emits to CloudWatch in production
- **Non-Blocking**: Metrics failures never break the application

## Installation

The MetricsService is part of the `@faces-of-plants/core` package:

```typescript
import { MetricsService, metricsService } from '@faces-of-plants/core';
```

## Usage

### Basic Usage with Default Service

```typescript
import { metricsService } from '@faces-of-plants/core';

// Record an API request
metricsService.recordRequest('/api/query', 'POST', 200, 150);

// Record cache operations
metricsService.recordCacheHit('gbif');
metricsService.recordCacheMiss('inaturalist');

// Record provider API calls
metricsService.recordProviderCall('gbif', 250, true);  // success
metricsService.recordProviderCall('eol', 500, false);  // failure

// Record errors
metricsService.recordError('VALIDATION_ERROR', '/api/query');
```

### Creating Custom MetricsService

```typescript
import { MetricsService } from '@faces-of-plants/core';

// Development metrics (logs only)
const devMetrics = new MetricsService({
  namespace: 'FacesOfPlants-Dev',
  enabled: true,
  environment: 'development',
});

// Production metrics (CloudWatch)
const prodMetrics = new MetricsService({
  namespace: 'FacesOfPlants',
  enabled: true,
  environment: 'production',
});

// Disabled metrics
const noMetrics = new MetricsService({
  enabled: false,
});
```

### Lambda Function Integration

```typescript
import { metricsService, logger } from '@faces-of-plants/core';

export const handler = async (event: any) => {
  const startTime = Date.now();
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Process request
    const result = await processRequest(event);
    
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

    throw error;
  }
};
```

### Middleware Integration

```typescript
import { metricsService } from '@faces-of-plants/core';

export const metricsMiddleware = (handler: any) => {
  return async (event: any) => {
    const startTime = Date.now();
    const path = event.path;
    const method = event.httpMethod;

    try {
      const result = await handler(event);
      const duration = Date.now() - startTime;

      metricsService.recordRequest(
        path,
        method,
        result.statusCode,
        duration
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      metricsService.recordRequest(path, method, 500, duration);
      metricsService.recordError('UNHANDLED_ERROR', path);

      throw error;
    }
  };
};
```

### Cache Integration

```typescript
import { metricsService, CacheService } from '@faces-of-plants/core';

class CachedProviderClient {
  async fetchData(query: string): Promise<any> {
    const cacheKey = `provider:${query}`;
    
    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      metricsService.recordCacheHit('provider');
      return cached;
    }

    // Cache miss
    metricsService.recordCacheMiss('provider');
    
    // Fetch from provider
    const startTime = Date.now();
    try {
      const data = await this.callProvider(query);
      const duration = Date.now() - startTime;
      
      metricsService.recordProviderCall('provider', duration, true);
      
      // Cache the result
      await cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordProviderCall('provider', duration, false);
      throw error;
    }
  }
}
```

### Custom Metrics

```typescript
import { metricsService, MetricData } from '@faces-of-plants/core';

// Put a custom metric
const customMetric: MetricData = {
  name: 'UserSignups',
  value: 1,
  unit: 'Count',
  dimensions: {
    Source: 'web',
    Plan: 'free',
  },
};

metricsService.putMetric(customMetric);

// With custom timestamp
const historicalMetric: MetricData = {
  name: 'BatchProcessed',
  value: 100,
  unit: 'Count',
  timestamp: new Date('2024-01-01T00:00:00Z'),
  dimensions: {
    BatchType: 'import',
  },
};

metricsService.putMetric(historicalMetric);
```

## Metric Types

### Request Metrics

**RequestCount**: Number of API requests
- Dimensions: Path, Method, StatusCode, Environment
- Unit: Count

**RequestDuration**: API request duration
- Dimensions: Path, Method, Environment
- Unit: Milliseconds

**ErrorCount**: Number of failed requests (4xx, 5xx)
- Dimensions: Path, Method, StatusCode, Environment
- Unit: Count

### Cache Metrics

**CacheHit**: Number of cache hits
- Dimensions: Provider, Environment
- Unit: Count

**CacheMiss**: Number of cache misses
- Dimensions: Provider, Environment
- Unit: Count

### Provider Metrics

**ProviderCallCount**: Number of provider API calls
- Dimensions: Provider, Success, Environment
- Unit: Count

**ProviderCallDuration**: Provider API call duration
- Dimensions: Provider, Environment
- Unit: Milliseconds

**ProviderErrorCount**: Number of provider API failures
- Dimensions: Provider, Environment
- Unit: Count

### Error Metrics

**ErrorOccurrence**: Error occurrences by type
- Dimensions: ErrorCode, Path, Environment
- Unit: Count

## Metric Units

The service supports the following CloudWatch metric units:

- `Seconds`: Time in seconds
- `Microseconds`: Time in microseconds
- `Milliseconds`: Time in milliseconds
- `Count`: Discrete count
- `Percent`: Percentage (0-100)
- `None`: Unitless value

## Environment Behavior

### Development/Test
- Metrics are logged to console as JSON
- No CloudWatch API calls are made
- Useful for debugging and testing

### Production/Staging
- Metrics are emitted to CloudWatch (when AWS SDK is configured)
- Falls back to logging if CloudWatch is unavailable
- Non-blocking: failures don't break the application

## Configuration

### Environment Variables

```bash
# Enable/disable metrics
METRICS_ENABLED=true

# Set environment
NODE_ENV=production
```

### Configuration Options

```typescript
interface MetricsConfig {
  namespace?: string;      // CloudWatch namespace (default: 'FacesOfPlants')
  enabled?: boolean;       // Enable metrics (default: true)
  environment?: string;    // Environment name (default: NODE_ENV)
}
```

## CloudWatch Integration

### Namespace

All metrics are emitted to the configured CloudWatch namespace (default: `FacesOfPlants`).

### Dimensions

Dimensions allow filtering and grouping metrics:

```typescript
// Filter by environment
Environment: 'production'

// Filter by provider
Provider: 'gbif'

// Filter by path
Path: '/api/query'

// Filter by status code
StatusCode: '500'
```

### CloudWatch Insights Queries

```sql
-- Average request duration by path
SELECT AVG(RequestDuration) as avg_duration, Path
FROM SCHEMA("FacesOfPlants", Path, Method)
WHERE MetricName = 'RequestDuration'
GROUP BY Path
ORDER BY avg_duration DESC

-- Cache hit rate by provider
SELECT 
  SUM(CacheHit) / (SUM(CacheHit) + SUM(CacheMiss)) * 100 as hit_rate,
  Provider
FROM SCHEMA("FacesOfPlants", Provider)
WHERE MetricName IN ('CacheHit', 'CacheMiss')
GROUP BY Provider

-- Error rate by path
SELECT 
  SUM(ErrorCount) / SUM(RequestCount) * 100 as error_rate,
  Path
FROM SCHEMA("FacesOfPlants", Path)
WHERE MetricName IN ('ErrorCount', 'RequestCount')
GROUP BY Path
ORDER BY error_rate DESC

-- Provider performance
SELECT 
  AVG(ProviderCallDuration) as avg_duration,
  SUM(ProviderErrorCount) / SUM(ProviderCallCount) * 100 as error_rate,
  Provider
FROM SCHEMA("FacesOfPlants", Provider)
GROUP BY Provider
```

## Best Practices

1. **Record All Requests**: Use middleware to automatically record all API requests
2. **Track Cache Performance**: Record cache hits/misses to optimize caching strategy
3. **Monitor Provider Health**: Track provider call duration and error rates
4. **Use Dimensions Wisely**: Add dimensions for filtering, but avoid high cardinality
5. **Non-Blocking**: Metrics should never break your application
6. **Consistent Naming**: Use consistent metric names across the application
7. **Meaningful Dimensions**: Add dimensions that help with troubleshooting

## Testing

The MetricsService includes comprehensive tests:

- **27 unit tests** covering all functionality

Run tests:

```bash
npm test -- MetricsService --run
```

## API Reference

### MetricsService Class

#### Constructor

```typescript
new MetricsService(config?: MetricsConfig)
```

#### Methods

- `recordRequest(path: string, method: string, statusCode: number, duration: number): void`
- `recordCacheHit(provider: string): void`
- `recordCacheMiss(provider: string): void`
- `recordProviderCall(provider: string, duration: number, success: boolean): void`
- `recordError(errorCode: string, path: string): void`
- `putMetric(metric: MetricData): void`
- `flush(): Promise<void>`

### MetricData Interface

```typescript
interface MetricData {
  name: string;                      // Metric name
  value: number;                     // Metric value
  unit: MetricUnit;                  // Metric unit
  dimensions?: Record<string, string>; // Optional dimensions
  timestamp?: Date;                  // Optional timestamp
}
```

## Future Enhancements

- [ ] Add AWS CloudWatch SDK integration for production
- [ ] Implement metric batching for efficiency
- [ ] Add metric aggregation (sum, avg, min, max)
- [ ] Support for metric alarms
- [ ] Metric retention policies
- [ ] Dashboard generation

## Related Documentation

- [Production Readiness Requirements](/.kiro/specs/production-readiness/requirements.md)
- [Production Readiness Design](/.kiro/specs/production-readiness/design.md)
- [Logger Service](/packages/core/src/services/README-LOGGER.md)

