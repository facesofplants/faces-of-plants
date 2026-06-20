# CloudWatch Dashboard

This document describes the CloudWatch dashboard configured for the Faces of Plants platform to visualize system metrics and performance.

## Overview

The CloudWatch dashboard provides real-time visualization of critical system metrics across six key areas:
1. Request metrics
2. Error rates
3. Provider health
4. Cache performance
5. Alarm status
6. Latency metrics

This implements **Requirement 6.5** from the production readiness specification.

## Dashboard Layout

The dashboard is organized into 6 rows with multiple widgets:

### Row 1: Request Metrics (Y: 0-6)

#### Widget 1: API Request Count (X: 0-12)
- **Metrics**:
  - AWS/ApiGateway Count (Total Requests)
  - FacesOfPlants/API RequestCount (Custom Request Count)
- **Purpose**: Monitor overall API traffic volume
- **Period**: 5 minutes
- **Use Case**: Identify traffic patterns, detect unusual spikes or drops

#### Widget 2: API Request Latency (X: 12-24)
- **Metrics**:
  - P50 (median latency)
  - P95 (95th percentile)
  - P99 (99th percentile)
  - Average latency
- **Purpose**: Monitor API response time performance
- **Period**: 5 minutes
- **Use Case**: Detect performance degradation, identify slow requests

### Row 2: Error Rates (Y: 6-12)

#### Widget 3: Error Rate Percentage (X: 0-8)
- **Metrics**:
  - Calculated error rate: (ErrorCount / RequestCount) * 100
- **Annotations**: 5% threshold line (alarm trigger point)
- **Purpose**: Monitor overall system error rate
- **Period**: 5 minutes
- **Use Case**: Quickly identify when error rates exceed acceptable thresholds

#### Widget 4: Error Count by Type (X: 8-16)
- **Metrics**:
  - 4xx Errors (client errors)
  - 5xx Errors (server errors)
  - Total Errors
- **Purpose**: Distinguish between client and server errors
- **Period**: 5 minutes
- **Use Case**: Identify whether errors are due to client issues or system problems

#### Widget 5: Alarm Status (X: 16-24)
- **Metrics**:
  - Error Rate Alarm state
  - Latency Alarm state
  - High Error Count Alarm state
  - Server Errors Alarm state
- **View**: Single value
- **Purpose**: Quick visual check of alarm states
- **Use Case**: Immediate awareness of active alarms

### Row 3: Provider Health - Call Metrics (Y: 12-18)

#### Widget 6: Provider API Call Count (X: 0-12)
- **Metrics**:
  - GBIF call count
  - iNaturalist call count
  - EOL call count
- **Purpose**: Monitor provider API usage distribution
- **Period**: 5 minutes
- **Use Case**: Identify which providers are being used most, detect provider-specific issues

#### Widget 7: Provider API Response Time (X: 12-24)
- **Metrics**:
  - GBIF Average & P95
  - iNaturalist Average & P95
  - EOL Average & P95
- **Purpose**: Monitor provider API performance
- **Period**: 5 minutes
- **Use Case**: Identify slow providers, detect provider performance degradation

### Row 4: Provider Health - Errors & Success (Y: 18-24)

#### Widget 8: Provider Error Count (X: 0-12)
- **Metrics**:
  - GBIF errors
  - iNaturalist errors
  - EOL errors
- **View**: Stacked area chart
- **Purpose**: Monitor provider-specific error rates
- **Period**: 5 minutes
- **Use Case**: Identify problematic providers, detect provider outages

#### Widget 9: Provider Success Rate (X: 12-24)
- **Metrics**:
  - GBIF success rate percentage
  - iNaturalist success rate percentage
  - EOL success rate percentage
- **Purpose**: Monitor provider reliability
- **Period**: 5 minutes
- **Use Case**: Track provider health over time, identify reliability trends

### Row 5: Cache Performance - Overall (Y: 24-30)

#### Widget 10: Cache Hit vs Miss Count (X: 0-12)
- **Metrics**:
  - Cache Hits
  - Cache Misses
- **Purpose**: Monitor cache effectiveness
- **Period**: 5 minutes
- **Use Case**: Identify cache usage patterns, detect cache issues

#### Widget 11: Cache Hit Rate Percentage (X: 12-24)
- **Metrics**:
  - Calculated hit rate: (CacheHits / (CacheHits + CacheMisses)) * 100
- **Annotations**: 50% target line
- **Purpose**: Monitor cache efficiency
- **Period**: 5 minutes
- **Use Case**: Ensure cache is providing value, identify opportunities for optimization

### Row 6: Cache Performance - By Provider (Y: 30-36)

#### Widget 12: Cache Hits by Provider (X: 0-12)
- **Metrics**:
  - GBIF cache hits
  - iNaturalist cache hits
  - EOL cache hits
- **View**: Stacked area chart
- **Purpose**: Monitor cache effectiveness per provider
- **Period**: 5 minutes
- **Use Case**: Identify which providers benefit most from caching

#### Widget 13: Cache Misses by Provider (X: 12-24)
- **Metrics**:
  - GBIF cache misses
  - iNaturalist cache misses
  - EOL cache misses
- **View**: Stacked area chart
- **Purpose**: Monitor cache miss patterns per provider
- **Period**: 5 minutes
- **Use Case**: Identify providers with poor cache hit rates

## Accessing the Dashboard

### Via AWS Console

1. Navigate to CloudWatch in the AWS Console
2. Select "Dashboards" from the left menu
3. Find the dashboard named: `faces-of-plants-{stage}-monitoring-dashboard`
   - Example: `faces-of-plants-dev-monitoring-dashboard`

### Via AWS CLI

```bash
# Get dashboard details
aws cloudwatch get-dashboard \
  --dashboard-name faces-of-plants-dev-monitoring-dashboard

# List all dashboards
aws cloudwatch list-dashboards
```

### Via Direct URL

After deployment, the dashboard URL follows this pattern:
```
https://console.aws.amazon.com/cloudwatch/home?region=eu-central-1#dashboards:name=faces-of-plants-{stage}-monitoring-dashboard
```

## Dashboard Deployment

The dashboard is automatically deployed as part of the infrastructure:

```bash
# Deploy with monitoring
pnpm sst deploy

# Deploy to specific stage
pnpm sst deploy --stage production
```

The dashboard configuration is defined in `infra/monitoring.ts` and uses Pulumi to create the CloudWatch dashboard resource.

## Customizing the Dashboard

### Adding New Widgets

Edit `infra/monitoring.ts` and add new widget definitions to the `widgets` array:

```typescript
{
  type: "metric",
  x: 0,  // X position (0-24)
  y: 36, // Y position (next row)
  width: 12,
  height: 6,
  properties: {
    title: "Your Widget Title",
    metrics: [
      ["Namespace", "MetricName", { stat: "Sum", label: "Label" }]
    ],
    view: "timeSeries",
    region: "eu-central-1",
    period: 300,
  }
}
```

### Adjusting Time Periods

Change the `period` property in widget definitions:
- 60 = 1 minute
- 300 = 5 minutes (default)
- 3600 = 1 hour

### Changing Widget Layout

Adjust `x`, `y`, `width`, and `height` properties:
- Dashboard width: 24 units
- Each row typically: 6 units high
- Position widgets using grid coordinates

## Monitoring Best Practices

### Daily Checks

1. **Error Rate**: Should be < 2% under normal conditions
2. **Latency**: P95 should be < 2 seconds
3. **Provider Success Rate**: Should be > 95% for all providers
4. **Cache Hit Rate**: Should be > 50%

### Weekly Reviews

1. Review error trends over the past week
2. Analyze provider performance patterns
3. Evaluate cache effectiveness
4. Check for any alarm triggers

### Monthly Analysis

1. Identify long-term performance trends
2. Evaluate capacity planning needs
3. Review and adjust alarm thresholds
4. Optimize cache strategies based on hit rates

## Troubleshooting

### Dashboard Not Showing Data

1. **Verify metrics are being emitted**:
   ```bash
   aws cloudwatch list-metrics --namespace FacesOfPlants
   ```

2. **Check time range**: Ensure you're viewing a time range with data

3. **Verify metric names**: Ensure metric names match those in MetricsService

### Missing Provider Metrics

1. Verify provider calls are being made
2. Check that MetricsService is properly integrated
3. Ensure provider code is calling `metricsService.recordProviderCall()`

### Cache Metrics Not Appearing

1. Verify CacheService is being used
2. Check that cache operations call `metricsService.recordCacheHit/Miss()`
3. Ensure cache is enabled in configuration

## Integration with Alarms

The dashboard includes an Alarm Status widget that shows the current state of all configured alarms:

- **Green (OK)**: Alarm is not triggered
- **Red (ALARM)**: Alarm threshold has been breached
- **Gray (INSUFFICIENT_DATA)**: Not enough data to evaluate

When an alarm triggers, you can:
1. Click on the alarm in the dashboard
2. View the alarm history
3. Navigate to related metrics
4. Investigate the root cause

## Cost Considerations

CloudWatch Dashboard costs:
- **First 3 dashboards**: Free
- **Additional dashboards**: $3.00 per dashboard per month
- **Custom metrics**: $0.30 per metric per month (first 10,000 metrics)

Current configuration: 1 dashboard with ~20 custom metrics = ~$6.00/month

## Related Documentation

- [CloudWatch Alarms](./cloudwatch-alarms.md)
- [MetricsService Documentation](../packages/core/src/services/README-METRICS.md)
- [Monitoring Infrastructure](../infra/monitoring.ts)
- [Production Readiness Specification](../.kiro/specs/production-readiness/requirements.md)

## References

- [AWS CloudWatch Dashboards Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html)
- [CloudWatch Dashboard Body Structure](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/CloudWatch-Dashboard-Body-Structure.html)
- [CloudWatch Metrics Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
