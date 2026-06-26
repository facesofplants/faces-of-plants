# Deployment Guide

## Overview

This guide covers deployment options, configuration, and best practices for the Faces of Plants platform. The platform is designed to run on AWS using SST (Serverless Stack Toolkit) for infrastructure as code.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Custom Domain Configuration](#custom-domain-configuration)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- **Node.js**: Version 18 or higher
- **pnpm**: Package manager (preferred over npm/yarn)
- **AWS CLI**: Version 2.x configured with credentials
- **Git**: Version control

### AWS Requirements
- **AWS Account**: With appropriate permissions
- **AWS CLI**: Configured with credentials
- **IAM Permissions**: Administrator access or specific SST permissions
- **Budget Alerts**: Set up for cost monitoring

### Environment Variables
- **LLM_API_KEY**: OpenAI API key for natural language processing
- **Custom Domain**: Optional domain name for hosting

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/facesofplants/faces-of-plants.git
cd faces-of-plants
```

### 2. Install Dependencies
```bash
# Install all workspace dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

### 3. AWS Configuration
```bash
# Configure AWS CLI
aws configure

# Verify configuration
aws sts get-caller-identity
```

### 4. Environment Variables
Create environment files for different stages:

**`.env.local`** (Local development only):
```bash
LLM_API_KEY=your-openai-api-key
DEBUG=true
```

**SST Secrets** (For Lambda functions):
```bash
# Set secrets for each stage
sst secret set LLM_API_KEY "your-openai-api-key" --stage dev
sst secret set LLM_API_KEY "your-openai-api-key" --stage staging
sst secret set LLM_API_KEY "your-openai-api-key" --stage production
```

---

## Local Development

### Start Development Environment
```bash
# Start SST development stack
pnpm run dev

# In another terminal, start the web application
cd packages/web
pnpm run dev
```

### Development URLs
- **Web Application**: `http://localhost:3000`
- **API Gateway**: Provided by SST (usually `https://xxx.execute-api.region.amazonaws.com`)
- **SST Console**: `https://console.sst.dev`

### Development Features
- **Hot Reload**: Automatic code reloading
- **Live Lambda**: Real Lambda environment for testing
- **Local Database**: DynamoDB Local for development
- **Debug Mode**: Enhanced logging and error reporting

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test -- --watch

# Run type checking
pnpm run type-check
```

---

## Staging Deployment

### 1. Deploy Staging Environment
```bash
# Deploy to staging
pnpm run deploy --stage staging

# Set staging secrets
sst secret set LLM_API_KEY "your-staging-api-key" --stage staging
```

### 2. Verify Deployment
```bash
# Check deployment status
sst status --stage staging

# View logs
sst logs --stage staging

# Test API endpoints
curl https://your-staging-api.com/api/multi-source?query=oak
```

### 3. Staging Configuration
```typescript
// sst.config.ts - Staging-specific configuration
if (app.stage === 'staging') {
  return {
    name: 'faces-of-plants-staging',
    region: 'us-east-1',
    // Staging-specific settings
  };
}
```

---

## Production Deployment

### 1. Pre-deployment Checklist
- [ ] All tests passing
- [ ] Type checking clean
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Documentation updated
- [ ] Backup strategy in place
- [ ] Rollback plan prepared

### 2. Deploy Production Environment
```bash
# Deploy to production
pnpm run deploy --stage production

# Set production secrets
sst secret set LLM_API_KEY "your-production-api-key" --stage production
```

### 3. Post-deployment Verification
```bash
# Health checks
curl https://your-api.com/health

# Monitor logs
sst logs --stage production --tail

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Lambda" \
  --metric-name "Duration" \
  --dimensions Name=FunctionName,Value=your-function-name \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --period 300 \
  --statistics Average
```

### 4. Production Configuration
```typescript
// sst.config.ts - Production-specific configuration
if (app.stage === 'production') {
  return {
    name: 'faces-of-plants',
    region: 'us-east-1',
    // Production-specific settings
    removal: app.stage === 'production' ? 'retain' : 'remove',
  };
}
```

---

## Custom Domain Configuration

### 1. Domain Prerequisites
- **Domain Registration**: Register domain with Route53 or external registrar
- **SSL Certificate**: Request ACM certificate
- **DNS Management**: Configure DNS records

### 2. Certificate Setup
```bash
# Request certificate in us-east-1 (for CloudFront)
aws acm request-certificate \
  --domain-name facesofplants.org \
  --subject-alternative-names "*.facesofplants.org" \
  --validation-method DNS \
  --region us-east-1

# Request certificate in deployment region (for API Gateway)
aws acm request-certificate \
  --domain-name api.facesofplants.org \
  --validation-method DNS \
  --region eu-central-1
```

### 3. SST Configuration
```typescript
// sst.config.ts - Custom domain configuration
export default {
  config() {
    return {
      name: 'faces-of-plants',
      region: 'eu-central-1',
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new NextjsSite(stack, 'site', {
        customDomain: {
          domainName: 'facesofplants.org',
          domainAlias: 'www.facesofplants.org',
          hostedZone: 'facesofplants.org',
        },
      });
      
      const api = new Api(stack, 'api', {
        customDomain: {
          domainName: 'api.facesofplants.org',
          hostedZone: 'facesofplants.org',
        },
      });
    });
  },
};
```

### 4. DNS Configuration
```bash
# Create Route53 hosted zone (if using Route53)
aws route53 create-hosted-zone \
  --name facesofplants.org \
  --caller-reference "$(date +%s)"

# Create A record for CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1D633PJN98FT9 \
  --change-batch file://change-batch.json
```

---

## Monitoring and Observability

### 1. CloudWatch Configuration
```typescript
// Add CloudWatch alarms
const alarm = new Alarm(stack, 'ApiErrorAlarm', {
  metric: api.metricClientError(),
  threshold: 10,
  evaluationPeriods: 2,
});

// Add dashboard
const dashboard = new Dashboard(stack, 'Dashboard', {
  widgets: [
    new GraphWidget({
      title: 'API Requests',
      left: [api.metricCount()],
      right: [api.metricClientError()],
    }),
  ],
});
```

### 2. Logging Configuration
```typescript
// Enable detailed logging
const logGroup = new LogGroup(stack, 'ApiLogs', {
  retention: RetentionDays.ONE_MONTH,
});

// Add structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'API request processed',
  requestId: context.awsRequestId,
  duration: Date.now() - startTime,
}));
```

### 3. Health Checks
```typescript
// Implement health check endpoint
export async function healthCheck(event: APIGatewayProxyEvent) {
  const health = await checkSystemHealth();
  
  return {
    statusCode: health.status === 'healthy' ? 200 : 503,
    body: JSON.stringify({
      status: health.status,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION,
      providers: health.providers,
    }),
  };
}
```

### 4. Metrics and Alerts
```bash
# Set up CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "HighErrorRate" \
  --alarm-description "API error rate too high" \
  --metric-name "4XXError" \
  --namespace "AWS/ApiGateway" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 2
```

---

## Security Best Practices

### 1. IAM Roles and Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/faces-of-plants-*"
    }
  ]
}
```

### 2. API Security
```typescript
// Add API Gateway authentication
const api = new Api(stack, 'api', {
  authorizers: {
    jwt: {
      type: 'user_pools',
      userPoolIds: [userPool.userPoolId],
    },
  },
  defaults: {
    authorizer: 'jwt',
  },
});

// Add CORS configuration
const corsConfig = {
  allowCredentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowOrigins: ['https://facesofplants.org'],
};
```

### 3. Secret Management
```bash
# Use AWS Secrets Manager for sensitive data
aws secretsmanager create-secret \
  --name "faces-of-plants/api-keys" \
  --description "API keys for external services" \
  --secret-string '{
    "openai_api_key": "sk-...",
    "other_api_key": "..."
  }'
```

### 4. Security Headers
```typescript
// Add security headers
export function addSecurityHeaders(response: APIGatewayProxyResult) {
  response.headers = {
    ...response.headers,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  };
  
  return response;
}
```

---

## Performance Optimization

### 1. Lambda Configuration
```typescript
// Optimize Lambda functions
const lambda = new Function(stack, 'api', {
  handler: 'functions/api.handler',
  runtime: 'nodejs18.x',
  memorySize: 1024,
  timeout: 30,
  environment: {
    NODE_ENV: 'production',
    NODE_OPTIONS: '--enable-source-maps',
  },
  bundling: {
    minify: true,
    sourceMap: true,
    target: 'es2020',
  },
});
```

### 2. Caching Strategy
```typescript
// Add CloudFront caching
const distribution = new Distribution(stack, 'cdn', {
  defaultBehavior: {
    origin: new S3Origin(bucket),
    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
    originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
  },
  additionalBehaviors: {
    '/api/*': {
      origin: new HttpOrigin('api.facesofplants.org'),
      cachePolicy: CachePolicy.CACHING_DISABLED,
    },
  },
});
```

### 3. Database Optimization
```typescript
// Optimize DynamoDB
const table = new Table(stack, 'table', {
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  globalSecondaryIndexes: [
    {
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },
    },
  ],
});
```

---

## Backup and Disaster Recovery

### 1. Database Backup
```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name faces-of-plants-table \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create manual backup
aws dynamodb create-backup \
  --table-name faces-of-plants-table \
  --backup-name "faces-of-plants-backup-$(date +%Y%m%d)"
```

### 2. Code Backup
```bash
# Ensure code is backed up in version control
git push origin main

# Tag releases
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

### 3. Infrastructure Backup
```bash
# Export CloudFormation templates
aws cloudformation get-template \
  --stack-name faces-of-plants-production \
  --template-stage Processed > infrastructure-backup.json
```

---

## Troubleshooting

### Common Deployment Issues

#### 1. Certificate Issues
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012

# Resend validation emails
aws acm resend-validation-email \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012 \
  --domain facesofplants.org
```

#### 2. API Gateway Issues
```bash
# Check API Gateway logs
aws logs filter-log-events \
  --log-group-name /aws/apigateway/your-api-id \
  --start-time 1640995200000

# Test API Gateway directly
aws apigateway test-invoke-method \
  --rest-api-id your-api-id \
  --resource-id your-resource-id \
  --http-method GET
```

#### 3. Lambda Function Issues
```bash
# Check Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/your-function-name \
  --start-time 1640995200000

# Test Lambda function directly
aws lambda invoke \
  --function-name your-function-name \
  --payload '{"test": "data"}' \
  output.json
```

### Performance Issues
1. **Check CloudWatch metrics**
2. **Monitor Lambda cold starts**
3. **Optimize bundle size**
4. **Implement caching**
5. **Use connection pooling**

### Recovery Procedures
1. **Rollback deployment**: `sst remove --stage production && sst deploy --stage production`
2. **Restore database**: Use point-in-time recovery
3. **Switch to backup region**: Update DNS records
4. **Emergency contacts**: Maintain contact list for critical issues

---

## Cost Optimization

### 1. Resource Optimization
- **Lambda**: Use appropriate memory settings
- **DynamoDB**: Use on-demand billing for variable workloads
- **S3**: Use appropriate storage classes
- **CloudWatch**: Set log retention policies

### 2. Cost Monitoring
```bash
# Set up budget alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://budget.json
```

### 3. Resource Cleanup
```bash
# Clean up unused resources
aws s3 rm s3://your-bucket --recursive
aws logs delete-log-group --log-group-name /aws/lambda/old-function
```

---

## CI/CD Integration

### 1. GitHub Actions
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm run deploy --stage production
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### 2. Environment Promotion
```bash
# Promote from staging to production
sst deploy --stage production --config staging-config.json
```

This comprehensive deployment guide should help you successfully deploy and manage the Faces of Plants platform in various environments.
