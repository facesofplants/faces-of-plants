# CloudWatch Monitoring Example

This document provides examples of how the CloudWatch monitoring infrastructure works.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
│  - Receives requests                                        │
│  - Logs to CloudWatch                                       │
│  - Emits metrics                                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudWatch Logs                            │
│  - Stores API Gateway logs                                  │
│  - Metric filters extract metrics                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudWatch Metrics                         │
│  - ErrorCount                                               │
│  - RequestCount                                             │
│  - Latency (P95)                                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudWatch Alarms                          │
│  - Error Rate > 5%                                          │
│  - P95 Latency > 5s                                         │
│  - High Error Count                                         │
│  - Server Errors                                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     SNS Topic                               │
│  - Receives alarm notifications                             │
│  - Distributes to subscribers                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Email Notifications                        │
│  - Ops team receives alerts                                 │
└─────────────────────────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Normal Operation

**Situation**: System is healthy, all metrics within thresholds

**Metrics**:
- Error Rate: 1.2%
- P95 Latency: 850ms
- Request Count: 1000/5min
- Error Count: 12/5min

**Alarm States**:
- Error Rate Alarm: OK
- Latency Alarm: OK
- High Error Count Alarm: OK
- Server Error Alarm: OK

**Actions**: None - system operating normally

### Scenario 2: High Error Rate

**Situation**: External provider API is down, causing elevated errors

**Metrics**:
- Error Rate: 8.5% (exceeds 5% threshold)
- P95 Latency: 1200ms
- Request Count: 1000/5min
- Error Count: 85/5min

**Alarm States**:
- Error Rate Alarm: ALARM (triggered)
- Latency Alarm: OK
- High Error Count Alarm: ALARM (triggered)
- Server Error Alarm: OK

**Notification Email**:
```
Subject: ALARM: "faces-of-plants-dev-monitoring-error-rate-gt-5-percent" in EU (Frankfurt)

You are receiving this email because your Amazon CloudWatch Alarm 
"faces-of-plants-dev-monitoring-error-rate-gt-5-percent" in the 
EU (Frankfurt) region has entered the ALARM state.

Alarm Details:
- Name: faces-of-plants-dev-monitoring-error-rate-gt-5-percent
- Description: Triggers when API error rate exceeds 5% over 10 minutes
- State Change: OK -> ALARM
- Reason: Threshold Crossed: 2 datapoints [8.5, 7.2] were greater than 
  the threshold (5.0)
- Timestamp: 2024-12-04 10:15:00 UTC

View this alarm in the AWS Console:
https://console.aws.amazon.com/cloudwatch/...
```

**Response Actions**:
1. Check provider status pages
2. Review error logs for patterns
3. Consider enabling graceful degradation
4. Update status page for users

### Scenario 3: High Latency

**Situation**: Database performance degradation causing slow responses

**Metrics**:
- Error Rate: 2.1%
- P95 Latency: 6800ms (exceeds 5000ms threshold)
- Request Count: 800/5min
- Error Count: 17/5min

**Alarm States**:
- Error Rate Alarm: OK
- Latency Alarm: ALARM (triggered)
- High Error Count Alarm: OK
- Server Error Alarm: OK

**Notification Email**:
```
Subject: ALARM: "faces-of-plants-dev-monitoring-p95-latency-gt-5s" in EU (Frankfurt)

Alarm Details:
- Name: faces-of-plants-dev-monitoring-p95-latency-gt-5s
- Description: Triggers when API P95 latency exceeds 5 seconds
- State Change: OK -> ALARM
- Reason: Threshold Crossed: 2 datapoints [6800, 6200] were greater than 
  the threshold (5000)
```

**Response Actions**:
1. Check DynamoDB metrics for throttling
2. Review Lambda cold start metrics
3. Check cache hit rate
4. Consider increasing provisioned capacity

### Scenario 4: Traffic Spike

**Situation**: Sudden traffic increase causing high absolute errors

**Metrics**:
- Error Rate: 3.8% (below 5% threshold)
- P95 Latency: 2100ms
- Request Count: 2500/5min (2.5x normal)
- Error Count: 95/5min (exceeds 50 threshold)

**Alarm States**:
- Error Rate Alarm: OK (percentage still acceptable)
- Latency Alarm: OK
- High Error Count Alarm: ALARM (triggered)
- Server Error Alarm: OK

**Response Actions**:
1. Verify traffic is legitimate (not DDoS)
2. Check rate limiting effectiveness
3. Monitor Lambda concurrency limits
4. Consider scaling resources

### Scenario 5: Server Errors

**Situation**: Application bug causing 500 errors

**Metrics**:
- Error Rate: 4.2%
- P95 Latency: 1500ms
- Request Count: 500/5min
- 5xx Error Count: 15/5min (exceeds 10 threshold)

**Alarm States**:
- Error Rate Alarm: OK (just below threshold)
- Latency Alarm: OK
- High Error Count Alarm: OK
- Server Error Alarm: ALARM (triggered)

**Response Actions**:
1. Review recent deployments
2. Check Lambda error logs
3. Identify failing code path
4. Consider rollback if needed

## Testing Alarms

### Manual Alarm Testing

Test alarm notifications without affecting production:

```bash
# Set alarm to ALARM state
aws cloudwatch set-alarm-state \
  --alarm-name "faces-of-plants-dev-monitoring-error-rate-gt-5-percent" \
  --state-value ALARM \
  --state-reason "Testing alarm notification system"

# Wait for email notification

# Reset alarm to OK state
aws cloudwatch set-alarm-state \
  --alarm-name "faces-of-plants-dev-monitoring-error-rate-gt-5-percent" \
  --state-value OK \
  --state-reason "Test complete"
```

### Simulating High Error Rate

Generate errors to trigger the error rate alarm:

```bash
# Send requests that will fail (invalid endpoint)
for i in {1..100}; do
  curl -X POST https://your-api.execute-api.eu-central-1.amazonaws.com/v1/invalid-endpoint
done
```

### Simulating High Latency

Create slow requests to trigger latency alarm:

```bash
# Send requests with large result sets
for i in {1..50}; do
  curl -X POST https://your-api.execute-api.eu-central-1.amazonaws.com/v1/query \
    -H "Content-Type: application/json" \
    -d '{"query": "species", "limit": 10000}'
done
```

## Monitoring Dashboard Queries

### View Error Rate Over Time

```bash
aws cloudwatch get-metric-statistics \
  --namespace FacesOfPlants/API \
  --metric-name ErrorCount \
  --start-time 2024-12-04T00:00:00Z \
  --end-time 2024-12-04T23:59:59Z \
  --period 300 \
  --statistics Sum
```

### View P95 Latency

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiId,Value=your-api-id \
  --start-time 2024-12-04T00:00:00Z \
  --end-time 2024-12-04T23:59:59Z \
  --period 300 \
  --statistics p95
```

### Check Alarm History

```bash
aws cloudwatch describe-alarm-history \
  --alarm-name "faces-of-plants-dev-monitoring-error-rate-gt-5-percent" \
  --max-records 10
```

## Integration with Incident Response

### Alarm Runbook Template

When an alarm triggers, follow this runbook:

1. **Acknowledge**: Confirm receipt of alarm notification
2. **Assess**: Check CloudWatch dashboard for context
3. **Investigate**: Review logs and metrics for root cause
4. **Mitigate**: Take action to resolve the issue
5. **Document**: Record findings and actions taken
6. **Follow-up**: Implement preventive measures

### Example Runbook: Error Rate Alarm

```markdown
## Error Rate Alarm Runbook

### 1. Acknowledge (< 5 minutes)
- [ ] Confirm alarm notification received
- [ ] Check alarm details in CloudWatch console
- [ ] Notify team in incident channel

### 2. Assess (< 10 minutes)
- [ ] Check current error rate percentage
- [ ] Review error distribution (4xx vs 5xx)
- [ ] Check if multiple alarms are triggered
- [ ] Verify traffic patterns (spike or steady)

### 3. Investigate (< 20 minutes)
- [ ] Review CloudWatch Logs for error patterns
- [ ] Check external provider status pages
- [ ] Review recent deployments (last 24 hours)
- [ ] Check DynamoDB metrics for throttling
- [ ] Verify Lambda function health

### 4. Mitigate (< 30 minutes)
- [ ] If provider issue: Enable graceful degradation
- [ ] If deployment issue: Rollback to previous version
- [ ] If capacity issue: Increase provisioned resources
- [ ] If bug: Apply hotfix or disable feature

### 5. Document (< 60 minutes)
- [ ] Create incident report
- [ ] Document root cause
- [ ] Record actions taken
- [ ] Note time to resolution

### 6. Follow-up (< 7 days)
- [ ] Implement monitoring improvements
- [ ] Add preventive measures
- [ ] Update runbook with learnings
- [ ] Schedule post-mortem if needed
```

## Cost Analysis

### Monthly Costs (Estimated)

**CloudWatch Alarms**:
- 4 standard alarms × $0.10 = $0.40/month

**CloudWatch Logs**:
- Ingestion: $0.50/GB
- Storage: $0.03/GB/month
- Estimated: ~$5-10/month for moderate traffic

**SNS Notifications**:
- First 1,000 emails: Free
- Additional: $2.00 per 100,000 emails
- Estimated: $0/month (well under free tier)

**Total Estimated Cost**: $5-11/month

### Cost Optimization Tips

1. **Adjust log retention**: Reduce from 30 days to 7 days if not needed
2. **Use metric filters efficiently**: Minimize number of filters
3. **Batch notifications**: Consider aggregating alarms
4. **Use composite alarms**: Reduce alarm count by combining conditions

## Related Resources

- [CloudWatch Alarms Documentation](../../docs/cloudwatch-alarms.md)
- [MetricsService Implementation](../../packages/core/src/services/MetricsService.ts)
- [Infrastructure Configuration](../monitoring.ts)
