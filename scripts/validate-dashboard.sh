#!/bin/bash

# Validation script for CloudWatch Dashboard
# Verifies that the dashboard is properly deployed and configured

set -e

STAGE="${1:-dev}"
DASHBOARD_NAME="faces-of-plants-${STAGE}-monitoring-dashboard"
REGION="${AWS_REGION:-eu-central-1}"

echo "🔍 Validating CloudWatch Dashboard for stage: ${STAGE}"
echo "Dashboard name: ${DASHBOARD_NAME}"
echo "Region: ${REGION}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    exit 1
fi

# Check if dashboard exists
echo "1. Checking if dashboard exists..."
if aws cloudwatch get-dashboard \
    --dashboard-name "${DASHBOARD_NAME}" \
    --region "${REGION}" \
    --output json > /dev/null 2>&1; then
    echo "✅ Dashboard exists"
else
    echo "❌ Dashboard not found"
    echo "   Run 'pnpm sst deploy --stage ${STAGE}' to create it"
    exit 1
fi

# Get dashboard details
echo ""
echo "2. Retrieving dashboard details..."
DASHBOARD_JSON=$(aws cloudwatch get-dashboard \
    --dashboard-name "${DASHBOARD_NAME}" \
    --region "${REGION}" \
    --output json)

# Count widgets
WIDGET_COUNT=$(echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | jq '.widgets | length')
echo "✅ Dashboard has ${WIDGET_COUNT} widgets"

# Expected widget count
EXPECTED_WIDGETS=13
if [ "${WIDGET_COUNT}" -eq "${EXPECTED_WIDGETS}" ]; then
    echo "✅ Widget count matches expected (${EXPECTED_WIDGETS})"
else
    echo "⚠️  Widget count (${WIDGET_COUNT}) differs from expected (${EXPECTED_WIDGETS})"
fi

# Verify key metrics are present
echo ""
echo "3. Verifying key metrics..."

# Check for request metrics
if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "RequestCount"; then
    echo "✅ Request metrics configured"
else
    echo "❌ Request metrics missing"
fi

# Check for error metrics
if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "ErrorCount"; then
    echo "✅ Error metrics configured"
else
    echo "❌ Error metrics missing"
fi

# Check for provider metrics
if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "ProviderCallCount"; then
    echo "✅ Provider metrics configured"
else
    echo "❌ Provider metrics missing"
fi

# Check for cache metrics
if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "CacheHit"; then
    echo "✅ Cache metrics configured"
else
    echo "❌ Cache metrics missing"
fi

# Check for latency metrics
if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "Latency"; then
    echo "✅ Latency metrics configured"
else
    echo "❌ Latency metrics missing"
fi

# Verify namespaces
echo ""
echo "4. Verifying metric namespaces..."

if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "FacesOfPlants"; then
    echo "✅ FacesOfPlants namespace found"
else
    echo "❌ FacesOfPlants namespace missing"
fi

if echo "${DASHBOARD_JSON}" | jq -r '.DashboardBody' | grep -q "AWS/ApiGateway"; then
    echo "✅ AWS/ApiGateway namespace found"
else
    echo "❌ AWS/ApiGateway namespace missing"
fi

# Check if metrics are being published
echo ""
echo "5. Checking if metrics are being published..."

# Check for FacesOfPlants metrics
CUSTOM_METRICS=$(aws cloudwatch list-metrics \
    --namespace "FacesOfPlants" \
    --region "${REGION}" \
    --output json | jq '.Metrics | length')

if [ "${CUSTOM_METRICS}" -gt 0 ]; then
    echo "✅ Found ${CUSTOM_METRICS} custom metrics in FacesOfPlants namespace"
else
    echo "⚠️  No custom metrics found yet (this is normal for new deployments)"
    echo "   Metrics will appear after API receives traffic"
fi

# Check for API Gateway metrics
API_METRICS=$(aws cloudwatch list-metrics \
    --namespace "AWS/ApiGateway" \
    --region "${REGION}" \
    --output json | jq '.Metrics | length')

if [ "${API_METRICS}" -gt 0 ]; then
    echo "✅ Found ${API_METRICS} API Gateway metrics"
else
    echo "⚠️  No API Gateway metrics found"
fi

# Generate dashboard URL
echo ""
echo "6. Dashboard Access Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
DASHBOARD_URL="https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
echo "Dashboard URL:"
echo "${DASHBOARD_URL}"
echo ""
echo "Or via AWS CLI:"
echo "aws cloudwatch get-dashboard --dashboard-name ${DASHBOARD_NAME} --region ${REGION}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Dashboard validation complete!"
echo ""
echo "Next steps:"
echo "1. Open the dashboard URL in your browser"
echo "2. Generate some API traffic to populate metrics"
echo "3. Verify widgets are displaying data"
echo "4. Check alarm status widget for any active alarms"
echo ""
echo "For more information, see: docs/cloudwatch-dashboard.md"
