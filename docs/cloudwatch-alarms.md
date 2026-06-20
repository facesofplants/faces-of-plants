# CloudWatch Alarms Configuration

This document describes the CloudWatch alarms configured for the Faces of Plants platform to monitor system health and performance.

## Overview

CloudWatch alarms are configured to monitor critical metrics and send notifications when thresholds are breached. This implements **Requirement 6.2** from the production readiness specification.

## Alarm Configuration

### 1. Error Rate Alarm

**Alarm Name**: `error-rate-gt-5-percent`

**Description**: Triggers when API error rate exceeds 5% over 10 minutes

**Metric**: Error Rate (calculated as `(ErrorCount / RequestCount) * 100`)

**Threshold**: 5%

**Evaluation Period**: 2 consecutive 5-minute periods (10 minutes total)

**Actions**:
- Sends notification to SNS topic when alarm state changes to ALARM
- Sends notification when alarm state returns to OK

**Use Case**: Detects when the system is experiencing elevated error rates, indicating potential issues with the application, dependencies, or infrastructure.

### 2. P95 Latency Alarm

**Alarm Name**: `p95-latency-gt-5s`

**Description**: Triggers when API P95 latency exceeds 5 seconds over 10 minutes

**Metric**: API Gateway Latency (95th percentile)

**Threshold**: 5000 milliseconds (5 seconds)

**Evaluation Period**: 2 consecutive 5-minute periods (10 minutes total)

**Actions**:
- Sends notification to SNS topic when alarm state changes to ALARM
- Sends notification when alarm state returns to OK

**Use Case**: Detects when the system is experiencing performance degradation, which could indicate:
- Database performance issues
- External provider API slowness
- Lambda cold starts
- Resource constraints

### 3. High Error Count Alarm

**Alarm Name**: `high-error-count`

**Description**: Triggers when absolute error count exceeds 50 in a 5-minute period

**Metric**: ErrorCount (custom metric from log filters)

**Threshold**: 50 errors

**Evaluation Period**: 1 period of 5 minutes

**Actions**:
- Sends notification to SNS topic when alarm state changes to ALARM
- Sends notification when alarm state returns to OK

**Use Case**: Catches scenarios where the error rate might be low percentage-wise but the absolute number of errors is concerning (e.g., during high traffic).

### 4. Server Error Alarm

**Alarm Name**: `server-errors`

**Description**: Triggers when 5xx error count exceeds 10 in a 5-minute period

**Metric**: API Gateway 5XXError

**Threshold**: 10 errors

**Evaluation Period**: 1 period of 5 minutes

**Actions**:
- Sends notification to SNS topic when alarm state changes to ALARM
- Sends notification when alarm state returns to OK

**Use Case**: Specifically monitors server-side errors (5xx status codes), which indicate issues with the application code or infrastructure rather than client errors.

## SNS Topic Configuration

**Topic Name**: `faces-of-plants-monitoring-alarms`

**Purpose**: Receives alarm notifications and distributes them to subscribers

**Subscriptions**:
- Email subscription (configured via `ALARM_EMAIL` environment variable)
- Can be extended to include:
  - SMS notifications
  - Lambda functions for automated remediation
  - PagerDuty/OpsGenie integrations
  - Slack/Teams webhooks

## Setup Instructions

### 1. Configure Email Notifications

Set the `ALARM_EMAIL` environment variable before deployment:

```bash
export ALARM_EMAIL="ops-team@example.com"
```

Or add it to your `.env.local` file:

```
ALARM_EMAIL=ops-team@example.com
```

### 2. Deploy Infrastructure

Deploy the monitoring infrastructure with SST:

```bash
pnpm sst deploy
```

### 3. Confirm Email Subscription

After deployment, AWS will send a confirmation email to the specified address. Click the confirmation link to start receiving alarm notifications.

### 4. Test Alarms

You can manually test alarms using the AWS CLI:

```bash
# Set alarm to ALARM state for testing
aws cloudwatch set-alarm-state \
  --alarm-name "faces-of-plants-dev-monitoring-error-rate-gt-5-percent" \
  --state-value ALARM \
  --state-reason "Testing alarm notification"
```

## Monitoring Dashboard

The alarms integrate with CloudWatch dashboards (see Task 26) to provide visual monitoring of:
- Current alarm states
- Historical alarm triggers
- Metric trends leading to alarms

## Alarm Response Procedures

### Error Rate Alarm

When the error rate alarm triggers:

1. **Check CloudWatch Logs**: Review recent error logs to identify patterns
2. **Check Provider Status**: Verify external provider APIs are operational
3. **Review Recent Deployments**: Check if alarm correlates with recent code changes
4. **Check Database Health**: Verify DynamoDB is not throttling requests
5. **Scale Resources**: Consider increasing Lambda concurrency or provisioned capacity

### Latency Alarm

When the latency alarm triggers:

1. **Check Lambda Metrics**: Review Lambda duration and cold start metrics
2. **Check Cache Hit Rate**: Verify cache is functioning properly
3. **Check Provider Response Times**: Monitor external API latency
4. **Check Database Performance**: Review DynamoDB read/write capacity
5. **Review Query Patterns**: Identify slow queries or inefficient operations

## Alarm Tuning

Alarm thresholds can be adjusted based on operational experience:

### Adjusting Error Rate Threshold

Edit `infra/monitoring.ts`:

```typescript
threshold: 5, // Change to desired percentage (e.g., 3 for 3%)
```

### Adjusting Latency Threshold

Edit `infra/monitoring.ts`:

```typescript
threshold: 5000, // Change to desired milliseconds (e.g., 3000 for 3s)
```

### Adjusting Evaluation Periods

Edit `infra/monitoring.ts`:

```typescript
evaluationPeriods: 2, // Change to desired number of periods
```

## Cost Considerations

CloudWatch alarm costs:
- **Standard Alarms**: $0.10 per alarm per month
- **High-Resolution Alarms**: $0.30 per alarm per month
- **SNS Notifications**: First 1,000 email notifications free, then $2.00 per 100,000 notifications

Current configuration: 4 standard alarms = $0.40/month

## Integration with CI/CD

Alarms are automatically deployed as part of the infrastructure:

```yaml
# GitHub Actions example
- name: Deploy with monitoring
  run: |
    export ALARM_EMAIL="${{ secrets.ALARM_EMAIL }}"
    pnpm sst deploy --stage production
```

## Troubleshooting

### Alarm Not Triggering

1. Verify metrics are being published to CloudWatch
2. Check alarm configuration in AWS Console
3. Verify evaluation period and threshold settings
4. Check "Treat missing data" setting

### Not Receiving Notifications

1. Verify email subscription is confirmed
2. Check SNS topic subscription status
3. Check spam/junk folder
4. Verify alarm actions are enabled

### False Positives

1. Review alarm threshold and evaluation period
2. Consider adjusting "Treat missing data" setting
3. Add anomaly detection for dynamic thresholds
4. Implement composite alarms for multiple conditions

## Related Documentation

- [Monitoring and Observability](./monitoring.md)
- [MetricsService Documentation](../packages/core/src/services/README-METRICS.md)
- [Production Readiness Specification](../.kiro/specs/production-readiness/requirements.md)

## References

- [AWS CloudWatch Alarms Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [AWS SNS Documentation](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)
- [CloudWatch Metrics Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
