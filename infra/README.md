# Infrastructure Configuration

This directory contains the infrastructure-as-code configuration for the Faces of Plants platform using SST (Serverless Stack Toolkit).

## Files

### `api.ts`
Configures API Gateway and Lambda function routes for the REST API.

**Key Components**:
- API Gateway HTTP API
- Lambda function handlers for endpoints
- Route versioning (v1)
- Timeout configurations
- IAM permissions for DynamoDB access

### `database.ts`
Configures DynamoDB tables for data persistence.

**Tables**:
- `user-collections`: User collection data
- `query-history`: Query history tracking
- `data-sources`: External data source metadata
- `auth-js`: NextAuth.js session and user data
- `login-history`: User login tracking
- `rate-limits`: Rate limiting state (with TTL)
- `cache`: API response cache (with TTL)

### `frontend.ts`
Configures the Next.js frontend deployment.

**Key Components**:
- Next.js site deployment
- Environment variable injection
- Static asset handling

### `secrets.ts`
Manages sensitive configuration using SST secrets.

**Secrets**:
- LLM API keys
- External provider credentials

### `monitoring.ts`
Configures CloudWatch alarms, dashboard, and SNS notifications for system monitoring.

**Key Components**:
- SNS topic for alarm notifications
- CloudWatch alarms for error rate and latency
- CloudWatch dashboard for metrics visualization
- Log groups and metric filters
- Email subscription for alerts

**Alarms**:
1. **Error Rate Alarm**: Triggers when error rate > 5%
2. **P95 Latency Alarm**: Triggers when P95 latency > 5 seconds
3. **High Error Count Alarm**: Triggers when absolute errors > 50 in 5 minutes
4. **Server Error Alarm**: Triggers when 5xx errors > 10 in 5 minutes

**Dashboard**:
- 13 widgets across 6 rows
- Request metrics and latency visualization
- Error rate tracking with threshold annotations
- Provider health monitoring (call count, response time, success rate)
- Cache performance metrics (hit rate, hits/misses by provider)
- Real-time alarm status display

See [CloudWatch Alarms Documentation](../docs/cloudwatch-alarms.md) and [CloudWatch Dashboard Documentation](../docs/cloudwatch-dashboard.md) for details.

### `versioning.ts`
Provides API versioning utilities.

**Functions**:
- `versionRoute()`: Adds version prefix to routes
- Version constants and configuration

### `utils.ts`
Shared utility functions for infrastructure code.

**Functions**:
- `createResourceName()`: Generates consistent resource names
- `getResourceTags()`: Returns standard resource tags

## Environment Variables

### Required

- `AWS_ACCOUNT_ID`: AWS account ID for deployment
- `AWS_REGION`: AWS region (default: eu-central-1)
- `SST_STAGE`: Deployment stage (dev, staging, production)

### Optional

- `ALARM_EMAIL`: Email address for CloudWatch alarm notifications
- `METRICS_ENABLED`: Enable/disable metrics emission (default: true)

## Deployment

### Development

```bash
# Start local development
pnpm sst dev

# Deploy to dev stage
pnpm sst deploy --stage dev
```

### Staging

```bash
# Deploy to staging
export ALARM_EMAIL="ops-team@example.com"
pnpm sst deploy --stage staging
```

### Production

```bash
# Deploy to production
export ALARM_EMAIL="ops-team@example.com"
pnpm sst deploy --stage production
```

## Resource Naming Convention

Resources follow the pattern: `{app-name}-{stage}-{module}-{resource-type}`

Example: `faces-of-plants-dev-database-user-collections`

This ensures:
- Unique resource names across stages
- Easy identification of resources
- Consistent naming across the platform

## Monitoring Setup

### CloudWatch Alarms

To enable CloudWatch alarm notifications:

1. Set the `ALARM_EMAIL` environment variable:
   ```bash
   export ALARM_EMAIL="your-email@example.com"
   ```

2. Deploy the infrastructure:
   ```bash
   pnpm sst deploy
   ```

3. Confirm the email subscription:
   - Check your email for AWS SNS confirmation
   - Click the confirmation link

4. Alarms will now send notifications to the configured email

### CloudWatch Dashboard

The dashboard is automatically deployed with the monitoring infrastructure:

1. Deploy the infrastructure:
   ```bash
   pnpm sst deploy --stage dev
   ```

2. Access the dashboard:
   - Via AWS Console: CloudWatch → Dashboards → `faces-of-plants-{stage}-monitoring-dashboard`
   - Via validation script: `./scripts/validate-dashboard.sh dev`

3. Verify dashboard is working:
   ```bash
   ./scripts/validate-dashboard.sh dev
   ```

The dashboard includes:
- **Request Metrics**: API traffic volume and latency percentiles
- **Error Rates**: Error percentage and counts by type
- **Provider Health**: Call counts, response times, and success rates
- **Cache Performance**: Hit rates and efficiency by provider
- **Alarm Status**: Real-time view of all alarm states

See [CloudWatch Dashboard Documentation](../docs/cloudwatch-dashboard.md) for detailed widget descriptions.

## Cost Optimization

### DynamoDB
- Tables use on-demand billing by default
- TTL enabled for automatic cleanup of expired data
- Consider switching to provisioned capacity for predictable workloads

### Lambda
- Timeout configurations prevent runaway functions
- Consider provisioned concurrency for critical endpoints
- Monitor cold start metrics

### CloudWatch
- Log retention set to 30 days
- 4 standard alarms = $0.40/month
- Monitor metric filter costs for high-volume logs

## Security

### IAM Permissions
- Lambda functions have least-privilege IAM roles
- DynamoDB permissions scoped to specific operations
- No wildcard permissions in production

### Secrets Management
- Use SST secrets for sensitive values
- Never commit secrets to version control
- Rotate secrets regularly

### Network Security
- API Gateway with CORS configuration
- HTTPS enforced for all endpoints
- Consider adding WAF rules for production

## Troubleshooting

### Deployment Failures

Check CloudFormation stack events:
```bash
aws cloudformation describe-stack-events \
  --stack-name faces-of-plants-dev
```

### Resource Conflicts

If resources already exist:
```bash
# Remove existing stack
pnpm sst remove --stage dev

# Redeploy
pnpm sst deploy --stage dev
```

### Permission Errors

Verify AWS credentials:
```bash
aws sts get-caller-identity
```

Ensure IAM user/role has necessary permissions for:
- CloudFormation
- Lambda
- API Gateway
- DynamoDB
- CloudWatch
- SNS

## Related Documentation

- [SST Documentation](https://docs.sst.dev/)
- [CloudWatch Alarms](../docs/cloudwatch-alarms.md)
- [CloudWatch Dashboard](../docs/cloudwatch-dashboard.md)
- [API Versioning](../docs/API-VERSIONING.md)
- [Deployment Guide](../docs/deployment.md)
