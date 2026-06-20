#!/bin/bash

# Infrastructure Validation Script for Faces of Plants
# This script validates that all resources follow the new naming convention

set -e

echo "🔍 Faces of Plants Infrastructure Validation Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_header() {
    echo -e "${BLUE}🔎 $1${NC}"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Get the current stage if provided
STAGE=${1:-"dev"}
print_info "Validating resources for stage: $STAGE"
echo ""

# Expected prefix for all resources
EXPECTED_PREFIX="faces-of-plants-$STAGE-"

print_header "Checking DynamoDB Tables"
echo "Expected prefix: $EXPECTED_PREFIX"
echo ""

# Check DynamoDB tables
TABLES=$(aws dynamodb list-tables --query 'TableNames' --output text)
VALID_TABLES=0
INVALID_TABLES=0

for table in $TABLES; do
    if [[ $table == *"$EXPECTED_PREFIX"* ]]; then
        print_success "✓ $table"
        ((VALID_TABLES++))
    elif [[ $table == *"faces-of-plants"* ]] || [[ $table == *"FacesOfPlants"* ]]; then
        print_error "✗ $table (incorrect naming)"
        ((INVALID_TABLES++))
    fi
done

echo ""
print_header "Checking Cognito User Pools"
echo ""

# Check Cognito User Pools
POOLS=$(aws cognito-idp list-user-pools --max-results 60 --query 'UserPools[].Name' --output text)
VALID_POOLS=0
INVALID_POOLS=0

for pool in $POOLS; do
    if [[ $pool == *"$EXPECTED_PREFIX"* ]]; then
        print_success "✓ $pool"
        ((VALID_POOLS++))
    elif [[ $pool == *"faces-of-plants"* ]] || [[ $pool == *"FacesOfPlants"* ]]; then
        print_error "✗ $pool (incorrect naming)"
        ((INVALID_POOLS++))
    fi
done

echo ""
print_header "Checking API Gateways"
echo ""

# Check API Gateways
APIS=$(aws apigatewayv2 get-apis --query 'Items[].Name' --output text)
VALID_APIS=0
INVALID_APIS=0

for api in $APIS; do
    if [[ $api == *"$EXPECTED_PREFIX"* ]]; then
        print_success "✓ $api"
        ((VALID_APIS++))
    elif [[ $api == *"faces-of-plants"* ]] || [[ $api == *"FacesOfPlants"* ]]; then
        print_error "✗ $api (incorrect naming)"
        ((INVALID_APIS++))
    fi
done

echo ""
print_header "Checking CloudFront Distributions"
echo ""

# Check CloudFront distributions (this is more complex as they don't have direct naming)
DISTRIBUTIONS=$(aws cloudfront list-distributions --query 'DistributionList.Items[].Origins.Items[0].DomainName' --output text 2>/dev/null || echo "")
VALID_DISTRIBUTIONS=0
INVALID_DISTRIBUTIONS=0

for dist in $DISTRIBUTIONS; do
    if [[ $dist == *"$EXPECTED_PREFIX"* ]]; then
        print_success "✓ CloudFront distribution with origin: $dist"
        ((VALID_DISTRIBUTIONS++))
    fi
done

echo ""
print_header "Validation Summary"
echo "=================="
echo ""

TOTAL_VALID=$((VALID_TABLES + VALID_POOLS + VALID_APIS + VALID_DISTRIBUTIONS))
TOTAL_INVALID=$((INVALID_TABLES + INVALID_POOLS + INVALID_APIS + INVALID_DISTRIBUTIONS))

print_info "Resources with correct naming:"
echo "  - DynamoDB Tables: $VALID_TABLES"
echo "  - Cognito User Pools: $VALID_POOLS"
echo "  - API Gateways: $VALID_APIS"
echo "  - CloudFront Distributions: $VALID_DISTRIBUTIONS"
echo ""

if [ $TOTAL_INVALID -gt 0 ]; then
    print_error "Resources with incorrect naming:"
    echo "  - DynamoDB Tables: $INVALID_TABLES"
    echo "  - Cognito User Pools: $INVALID_POOLS"
    echo "  - API Gateways: $INVALID_APIS"
    echo ""
    print_error "❌ Validation failed. Please clean up incorrectly named resources."
    exit 1
else
    print_success "🎉 All resources follow the correct naming convention!"
    echo ""
    print_info "All resources are properly prefixed with: $EXPECTED_PREFIX"
    echo ""
fi

echo ""
print_header "Resource URLs (if available)"
echo "============================"
echo ""

# Try to get some useful URLs
if [ $VALID_APIS -gt 0 ]; then
    API_URL=$(aws apigatewayv2 get-apis --query "Items[?contains(Name, '$EXPECTED_PREFIX')].ApiEndpoint" --output text 2>/dev/null || echo "")
    if [ ! -z "$API_URL" ]; then
        print_info "API Gateway URL: $API_URL"
    fi
fi

if [ $VALID_DISTRIBUTIONS -gt 0 ]; then
    DIST_DOMAIN=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '$EXPECTED_PREFIX')].DomainName" --output text 2>/dev/null || echo "")
    if [ ! -z "$DIST_DOMAIN" ]; then
        print_info "CloudFront Distribution: https://$DIST_DOMAIN"
    fi
fi

echo ""
print_success "✅ Validation completed successfully!"
