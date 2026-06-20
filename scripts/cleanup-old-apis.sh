#!/bin/bash

# Manual cleanup script for old API Gateway resources
# This script will remove specific old API Gateway resources that don't follow the new naming convention

set -e

echo "🧹 Manual API Gateway Cleanup"
echo "============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

print_info "Checking for old API Gateway resources..."

# Get all API Gateway resources that don't follow the new naming convention
OLD_APIS=$(aws apigatewayv2 get-apis --query 'Items[?contains(Name, `faces-of-plants`) && !contains(Name, `faces-of-plants-dev-`) && !contains(Name, `faces-of-plants-staging-`) && !contains(Name, `faces-of-plants-production-`)].{Name:Name,ApiId:ApiId}' --output json)

if [ "$OLD_APIS" = "[]" ]; then
    print_success "No old API Gateway resources found with incorrect naming."
    exit 0
fi

echo "Found the following API Gateway resources with incorrect naming:"
echo "$OLD_APIS" | jq -r '.[] | "- Name: \(.Name), ID: \(.ApiId)"'
echo ""

print_warning "These resources will be deleted. This action cannot be undone."
echo ""

read -p "Do you want to proceed with deletion? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cleanup cancelled."
    exit 0
fi

# Delete each old API Gateway
echo "$OLD_APIS" | jq -r '.[] | .ApiId' | while read -r API_ID; do
    API_NAME=$(echo "$OLD_APIS" | jq -r --arg id "$API_ID" '.[] | select(.ApiId == $id) | .Name')
    print_info "Deleting API Gateway: $API_NAME (ID: $API_ID)"
    
    if aws apigatewayv2 delete-api --api-id "$API_ID"; then
        print_success "✅ Deleted API Gateway: $API_NAME"
    else
        print_error "❌ Failed to delete API Gateway: $API_NAME"
    fi
done

print_success "🎉 API Gateway cleanup completed!"
print_info "You can now deploy fresh resources with the correct naming convention."
