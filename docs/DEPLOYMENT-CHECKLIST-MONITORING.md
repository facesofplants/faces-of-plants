# CloudWatch Monitoring Deployment Checklist

Use this checklist when deploying the CloudWatch monitoring infrastructure to any environment.

## Pre-Deployment

### 1. Environment Configuration

- [ ] Set `ALARM_EMAIL` environment variable
  ```bash
  export ALARM_EMAIL="ops-team@example.com"
  ```

- [ ] Verify AWS credentials are configured
  ```bash
  aws sts get-caller-identity
  ```

- [ ] Confirm deployment stage
  ```bash
  echo $SST_STAGE  # Should be: dev, staging, or production
  ```

### 2. Code Validation

- [ ] Run validation script
  ```bash
  ./scripts/validate-monitoring.sh
  ```

- [ ] Check TypeScript compilation
  ```bash
  pnpm tsc --noEmit
  ```

- [ ] Review infrastructure changes
  ```bash
  git diff infra/monitoring.ts sst.config.ts
  ```

## Deployment

### 3. Deploy Infrastructure

- [ ] Deploy to target environment
  ```bash
  pnpm sst deploy --stage <stage>
  ```

- [ ] Verify deployment succeeded
  - Check CloudFormation stack status
  - Verify no errors in deployment logs

- [ ] Note the SNS topic ARN from outputs
  ```bash
  # Example output:
  # monitoring.alarmTopicArn: arn:aws:sns:eu-central-1:123456789:...
  ```

## Post-Deployment

### 4. Email Subscription

- [ ] Check email inbox for AWS SNS confirmation
  - Subject: "AWS Notification - Subscription Confirmation"
  - From: no-reply@sns.amazonaws.com

- [ ] Click "Confirm subscription" link in email

- [ ] Verify subscription in AWS Console
  ```bash
  aws sns list-subscriptions-by-topic \
    --topic-arn <topic-arn-from-deployment>
  ```

### 5. Alarm Verification

- [ ] Verify alarms exist in CloudWatch Console
  - Navigate to: CloudWatch → Alarms
  - Should see 4 alarms with prefix matching your stage

- [ ] Check alarm states (should be "Insufficient data" or "OK")
  ```bash
  aws cloudwatch describe-alarms \
    --alarm-name-prefix "faces-of-plants-${SST_STAGE}-monitoring"
  ```

- [ ] Verify alarm actions are configured
  - Each alarm should have SNS topic ARN in "Actions"

### 6. Test Alarms (Optional but Recommended)

- [ ] Test error rate alarm
  ```bash
  aws cloudwatch set-alarm-state \
    --alarm-name "faces-of-plants-${SST_STAGE}-monitoring-error-rate-gt-5-percent" \
    --state-value ALARM \
    --state-reason "Deployment test"
  ```

- [ ] Verify email notification received
  - Subject should contain "ALARM"
  - Check spam folder if not in inbox

- [ ] Reset alarm to OK state
  ```bash
  aws cloudwatch set-alarm-state \
    --alarm-name "faces-of-plants-${SST_STAGE}-monitoring-error-rate-gt-5-percent" \
    --state-value OK \
    --state-reason "Test complete"
  ```

- [ ] Verify OK notification received

### 7. Monitoring Dashboard (if Task 26 complete)

- [ ] Verify dashboard exists
- [ ] Check alarm widgets display correctly
- [ ] Verify metrics are being collected

## Validation

### 8. Smoke Tests

- [ ] Generate test traffic to API
  ```bash
  curl https://<api-url>/v1/health
  ```

- [ ] Check CloudWatch Logs for entries
  - Navigate to: CloudWatch → Log groups
  - Find: `/aws/apigateway/<api-name>`

- [ ] Verify metrics are being published
  - Navigate to: CloudWatch → Metrics
  - Check namespace: `FacesOfPlants/API`
  - Should see: ErrorCount, RequestCount

- [ ] Wait 5-10 minutes for metrics to populate

### 9. Documentation

- [ ] Update deployment documentation with:
  - SNS topic ARN
  - Alarm names
  - Log group name
  - Any environment-specific notes

- [ ] Share alarm notification email with team

- [ ] Document any issues encountered

## Rollback (If Needed)

### 10. Rollback Procedure

If deployment fails or causes issues:

- [ ] Identify the issue
  ```bash
  # Check CloudFormation events
  aws cloudformation describe-stack-events \
    --stack-name faces-of-plants-${SST_STAGE}
  ```

- [ ] Rollback deployment
  ```bash
  pnpm sst remove --stage <stage>
  git checkout <previous-commit>
  pnpm sst deploy --stage <stage>
  ```

- [ ] Verify rollback succeeded

- [ ] Document rollback reason

## Environment-Specific Notes

### Development

- [ ] Alarms may show "Insufficient data" due to low traffic
- [ ] Consider using test scripts to generate metrics
- [ ] Email notifications may be noisy during testing

### Staging

- [ ] Use staging-specific email (e.g., staging-alerts@example.com)
- [ ] Test alarm thresholds before production
- [ ] Verify alarm behavior under load testing

### Production

- [ ] Use production ops email or distribution list
- [ ] Consider adding PagerDuty/OpsGenie integration
- [ ] Set up on-call rotation for alarm responses
- [ ] Document escalation procedures
- [ ] Schedule regular alarm review meetings

## Troubleshooting

### Common Issues

#### Email Not Received

- [ ] Check spam/junk folder
- [ ] Verify email address is correct
- [ ] Check SNS subscription status
- [ ] Resend confirmation email:
  ```bash
  aws sns subscribe \
    --topic-arn <topic-arn> \
    --protocol email \
    --notification-endpoint <email>
  ```

#### Alarms Not Triggering

- [ ] Verify metrics are being published
- [ ] Check alarm threshold and evaluation period
- [ ] Review "Treat missing data" setting
- [ ] Check alarm actions are enabled

#### Metrics Not Appearing

- [ ] Verify API Gateway logging is enabled
- [ ] Check log group exists and has data
- [ ] Verify metric filters are configured
- [ ] Wait 5-10 minutes for metrics to populate

#### High Costs

- [ ] Review log retention period (reduce if needed)
- [ ] Check metric filter efficiency
- [ ] Consider reducing alarm count
- [ ] Review CloudWatch pricing dashboard

## Success Criteria

Deployment is successful when:

- ✅ All 4 alarms are created and visible in CloudWatch
- ✅ SNS topic is created with confirmed email subscription
- ✅ Test alarm notification is received via email
- ✅ Metrics are being published to CloudWatch
- ✅ Log group is receiving API Gateway logs
- ✅ Validation script passes all checks
- ✅ Documentation is updated

## Next Steps

After successful deployment:

1. Monitor alarms for false positives over next 24-48 hours
2. Adjust thresholds if needed based on actual traffic patterns
3. Set up additional integrations (Slack, PagerDuty, etc.)
4. Create runbooks for each alarm type
5. Schedule team training on alarm response procedures
6. Proceed to Task 25: Create health check endpoint
7. Proceed to Task 26: Create CloudWatch dashboard

## Support

For issues or questions:

- Review: `docs/cloudwatch-alarms.md`
- Check: `infra/examples/monitoring-example.md`
- Run: `./scripts/validate-monitoring.sh`
- Contact: DevOps team or infrastructure lead

---

**Last Updated**: December 4, 2024  
**Version**: 1.0  
**Related Tasks**: Task 24 (Complete), Task 25 (Next), Task 26 (Future)
