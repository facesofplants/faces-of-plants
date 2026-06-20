#!/bin/bash

# Infrastructure Cleanup Script for Faces of Plants
# This script helps clean up old resources before deploying with new naming conventions

set -e

echo "🧹 Faces of Plants Infrastructure Cleanup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if SST CLI is installed
if ! command -v sst &> /dev/null; then
    print_error "SST CLI is not installed. Please install it first."
    exit 1
fi

print_info "Checking current AWS profile and region..."
aws sts get-caller-identity
echo ""

# Get the current stage if provided
STAGE=${1:-"dev"}
print_info "Working with stage: $STAGE"
echo ""

print_warning "This script will help you clean up old resources that don't follow the new naming convention."
print_warning "Make sure you have backups of any important data before proceeding."
echo ""

read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cleanup cancelled."
    exit 0
fi

print_info "Step 1: Removing old SST deployment (if exists)"
echo "This will remove all resources created by the old SST configuration..."
echo ""

# Try to remove the old SST deployment
if sst remove --stage $STAGE; then
    print_info "✅ Old SST deployment removed successfully"
else
    print_warning "SST remove failed or no existing deployment found"
fi

echo ""
print_info "Step 2: Checking for orphaned resources"
echo "Looking for resources that might have been missed..."
echo ""

# Check for Cognito User Pools with old naming
print_info "Checking for Cognito User Pools..."
OLD_POOLS=$(aws cognito-idp list-user-pools --max-results 60 --query 'UserPools[?contains(Name, `FacesOfPlants`) && !contains(Name, `faces-of-plants`)].Name' --output text)
if [ ! -z "$OLD_POOLS" ]; then
    print_warning "Found old Cognito User Pools: $OLD_POOLS"
    print_warning "These should be removed manually from AWS Console if no longer needed"
fi

# Check for DynamoDB tables with old naming
print_info "Checking for DynamoDB tables..."
OLD_TABLES=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `FacesOfPlants`) && !contains(@, `faces-of-plants`)]' --output text)
if [ ! -z "$OLD_TABLES" ]; then
    print_warning "Found old DynamoDB tables: $OLD_TABLES"
    print_warning "These should be removed manually from AWS Console if no longer needed"
fi

# Check for API Gateways with old naming
print_info "Checking for API Gateways..."
OLD_APIS=$(aws apigatewayv2 get-apis --query 'Items[?contains(Name, `FacesOfPlants`) && !contains(Name, `faces-of-plants`)].Name' --output text)
if [ ! -z "$OLD_APIS" ]; then
    print_warning "Found old API Gateways: $OLD_APIS"
    print_warning "These should be removed manually from AWS Console if no longer needed"
fi

echo ""
print_info "Step 3: Cleaning up SST state and cache"
echo "Removing local SST state and cache files..."

# Remove SST state directory
if [ -d ".sst" ]; then
    rm -rf .sst
    print_info "✅ Removed .sst directory"
fi

# Remove node_modules to ensure clean dependencies
if [ -d "node_modules" ]; then
    print_info "Removing node_modules for clean install..."
    rm -rf node_modules
    print_info "✅ Removed node_modules"
fi

# Remove package-lock.json if it exists
if [ -f "package-lock.json" ]; then
    rm package-lock.json
    print_info "✅ Removed package-lock.json"
fi

echo ""
print_info "Step 4: Reinstalling dependencies"
echo "Installing fresh dependencies..."

# Install dependencies
if command -v pnpm &> /dev/null; then
    pnpm install
    print_info "✅ Dependencies installed with pnpm"
elif command -v npm &> /dev/null; then
    npm install
    print_info "✅ Dependencies installed with npm"
else
    print_error "Neither pnpm nor npm found. Please install dependencies manually."
    exit 1
fi

echo ""
print_info "🎉 Cleanup completed!"
echo ""
print_info "Next steps:"
echo "1. Set your secrets (if not already set):"
echo "   sst secret set FACES_OF_PLANTS_${STAGE^^}_SECRETS_LLM_API_KEY \"your-llm-api-key\" --stage $STAGE"
echo "   sst secret set FACES_OF_PLANTS_${STAGE^^}_SECRETS_GOOGLE_CLIENT_SECRET \"your-google-client-secret\" --stage $STAGE"
echo ""
echo "2. Deploy the new infrastructure:"
echo "   sst deploy --stage $STAGE"
echo ""
echo "3. Verify all resources are named correctly in AWS Console"
echo "   All resources should have the prefix 'faces-of-plants-$STAGE-'"
echo ""
print_warning "Remember to manually remove any remaining old resources from AWS Console if needed."
