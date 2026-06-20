#!/bin/bash

# Validation script for CloudWatch monitoring infrastructure
# This script checks that all monitoring components are properly configured

set -e

echo "🔍 Validating CloudWatch Monitoring Configuration..."
echo ""

# Check if monitoring.ts exists
if [ ! -f "infra/monitoring.ts" ]; then
    echo "❌ Error: infra/monitoring.ts not found"
    exit 1
fi
echo "✅ monitoring.ts exists"

# Check if monitoring is imported in sst.config.ts
if ! grep -q "createMonitoring" sst.config.ts; then
    echo "❌ Error: createMonitoring not imported in sst.config.ts"
    exit 1
fi
echo "✅ createMonitoring imported in sst.config.ts"

# Check if monitoring is called in sst.config.ts
if ! grep -q "createMonitoring({" sst.config.ts; then
    echo "❌ Error: createMonitoring not called in sst.config.ts"
    exit 1
fi
echo "✅ createMonitoring called in sst.config.ts"

# Check for required alarm configurations
echo ""
echo "🔍 Checking alarm configurations..."

# Error rate alarm
if ! grep -q "error-rate-gt-5-percent" infra/monitoring.ts; then
    echo "❌ Error: Error rate alarm not configured"
    exit 1
fi
echo "✅ Error rate alarm configured"

# Latency alarm
if ! grep -q "p95-latency-gt-5s" infra/monitoring.ts; then
    echo "❌ Error: P95 latency alarm not configured"
    exit 1
fi
echo "✅ P95 latency alarm configured"

# SNS topic
if ! grep -q "aws.sns.Topic" infra/monitoring.ts; then
    echo "❌ Error: SNS topic not configured"
    exit 1
fi
echo "✅ SNS topic configured"

# Email subscription
if ! grep -q "aws.sns.TopicSubscription" infra/monitoring.ts; then
    echo "❌ Error: SNS email subscription not configured"
    exit 1
fi
echo "✅ SNS email subscription configured"

# Check documentation
echo ""
echo "🔍 Checking documentation..."

if [ ! -f "docs/cloudwatch-alarms.md" ]; then
    echo "❌ Error: CloudWatch alarms documentation not found"
    exit 1
fi
echo "✅ CloudWatch alarms documentation exists"

if [ ! -f "infra/README.md" ]; then
    echo "❌ Error: Infrastructure README not found"
    exit 1
fi
echo "✅ Infrastructure README exists"

if [ ! -f "infra/examples/monitoring-example.md" ]; then
    echo "❌ Error: Monitoring examples not found"
    exit 1
fi
echo "✅ Monitoring examples exist"

# Check TypeScript compilation
echo ""
echo "🔍 Checking TypeScript compilation..."

if command -v tsc &> /dev/null; then
    if tsc --noEmit infra/monitoring.ts 2>&1 | grep -q "error TS"; then
        echo "❌ Error: TypeScript compilation errors in monitoring.ts"
        exit 1
    fi
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  Warning: TypeScript compiler not found, skipping compilation check"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All monitoring configuration checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "1. Set ALARM_EMAIL environment variable:"
echo "   export ALARM_EMAIL=\"your-email@example.com\""
echo ""
echo "2. Deploy the infrastructure:"
echo "   pnpm sst deploy"
echo ""
echo "3. Confirm email subscription:"
echo "   Check your email for AWS SNS confirmation link"
echo ""
echo "4. Test alarms (optional):"
echo "   aws cloudwatch set-alarm-state \\"
echo "     --alarm-name \"faces-of-plants-dev-monitoring-error-rate-gt-5-percent\" \\"
echo "     --state-value ALARM \\"
echo "     --state-reason \"Testing\""
echo ""
echo "📚 Documentation:"
echo "   - docs/cloudwatch-alarms.md"
echo "   - infra/README.md"
echo "   - infra/examples/monitoring-example.md"
echo ""
