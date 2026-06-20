#!/bin/bash

# Complete Deployment Script for Faces of Plants
# This script orchestrates the complete deployment process

set -e

echo "🚀 Faces of Plants - Complete Deployment Script"
echo "==============================================="
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
    echo -e "${BLUE}🔧 $1${NC}"
}

# Check if required tools are installed
check_tools() {
    print_header "Checking required tools..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v sst &> /dev/null; then
        print_error "SST CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null && ! command -v npm &> /dev/null; then
        print_error "Neither pnpm nor npm is installed. Please install one of them."
        exit 1
    fi
    
    print_success "All required tools are installed"
    echo ""
}

# Get deployment configuration
get_config() {
    print_header "Deployment Configuration"
    
    # Get stage from command line argument or prompt
    if [ -z "$1" ]; then
        echo "Available stages: dev, staging, production"
        read -p "Enter deployment stage [dev]: " STAGE
        STAGE=${STAGE:-dev}
    else
        STAGE=$1
    fi
    
    # Validate stage
    if [[ ! "$STAGE" =~ ^(dev|staging|production)$ ]]; then
        print_error "Invalid stage '$STAGE'. Must be dev, staging, or production."
        exit 1
    fi
    
    print_info "Deployment stage: $STAGE"
    
    # Check if this is a cleanup deployment
    if [ "$2" = "--cleanup" ]; then
        CLEANUP=true
        print_warning "Cleanup mode enabled - will remove old resources first"
    else
        CLEANUP=false
    fi
    
    echo ""
}

# Cleanup old resources if requested
cleanup_resources() {
    if [ "$CLEANUP" = true ]; then
        print_header "Cleaning up old resources..."
        
        if [ -f "./scripts/cleanup-infrastructure.sh" ]; then
            ./scripts/cleanup-infrastructure.sh "$STAGE"
        else
            print_warning "Cleanup script not found, skipping cleanup"
        fi
        
        echo ""
    fi
}

# Check and set secrets
check_secrets() {
    print_header "Checking secrets configuration..."
    
    # Secret names based on new naming convention
    LLM_SECRET_NAME="FACES_OF_PLANTS_$(echo "$STAGE" | tr '[:lower:]' '[:upper:]')_SECRETS_LLM_API_KEY"
    GOOGLE_SECRET_NAME="FACES_OF_PLANTS_$(echo "$STAGE" | tr '[:lower:]' '[:upper:]')_SECRETS_GOOGLE_CLIENT_SECRET"
    
    print_info "Checking for required secrets..."
    
    # Check if secrets exist
    if ! sst secret list --stage "$STAGE" | grep -q "$LLM_SECRET_NAME"; then
        print_error "Secret $LLM_SECRET_NAME not found"
        print_info "Set it with: sst secret set $LLM_SECRET_NAME \"your-api-key\" --stage $STAGE"
        exit 1
    fi
    
    if ! sst secret list --stage "$STAGE" | grep -q "$GOOGLE_SECRET_NAME"; then
        print_error "Secret $GOOGLE_SECRET_NAME not found"
        print_info "Set it with: sst secret set $GOOGLE_SECRET_NAME \"your-client-secret\" --stage $STAGE"
        exit 1
    fi
    
    print_success "All required secrets are configured"
    echo ""
}

# Deploy infrastructure
deploy_infrastructure() {
    print_header "Deploying infrastructure..."
    
    print_info "Running: sst deploy --stage $STAGE"
    
    if sst deploy --stage "$STAGE"; then
        print_success "Infrastructure deployed successfully!"
    else
        print_error "Infrastructure deployment failed"
        exit 1
    fi
    
    echo ""
}

# Validate deployment
validate_deployment() {
    print_header "Validating deployment..."
    
    if [ -f "./scripts/validate-infrastructure.sh" ]; then
        ./scripts/validate-infrastructure.sh "$STAGE"
    else
        print_warning "Validation script not found, skipping validation"
    fi
    
    echo ""
}

# Get deployment outputs
get_outputs() {
    print_header "Deployment Outputs"
    
    print_info "Getting deployment information..."
    
    # Try to get SST outputs
    if sst env --stage "$STAGE" > /dev/null 2>&1; then
        print_success "SST environment is ready"
        
        # You can add specific output commands here
        # For example:
        # API_URL=$(sst env --stage "$STAGE" | grep API_URL | cut -d'=' -f2)
        # if [ ! -z "$API_URL" ]; then
        #     print_info "API URL: $API_URL"
        # fi
    else
        print_warning "Could not retrieve SST environment information"
    fi
    
    echo ""
}

# Manual configuration steps
manual_steps() {
    print_header "Manual Configuration Steps"
    
    print_warning "The following steps need to be completed manually:"
    echo ""
    
    echo "1. 🌐 Custom Domain Setup (if using staging/production):"
    echo "   - Ensure Route 53 hosted zone exists for facesofplants.org"
    echo "   - Create ACM certificates in us-east-1 (for CloudFront) and eu-central-1 (for API Gateway)"
    echo ""
    
    echo "2. 🔐 Cognito Domain Setup:"
    echo "   - Go to AWS Cognito Console"
    echo "   - Find your User Pool: faces-of-plants-$STAGE-auth-user-pool"
    echo "   - Configure the domain name: faces-of-plants-$STAGE-auth"
    echo ""
    
    echo "3. 🔍 Verify Resources:"
    echo "   - Check AWS Console to ensure all resources are properly named"
    echo "   - Test authentication flow"
    echo "   - Verify API endpoints are working"
    echo ""
    
    print_info "For detailed instructions, see DEPLOYMENT.md"
    echo ""
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    echo ""
    
    # Check prerequisites
    check_tools
    
    # Get configuration
    get_config "$1" "$2"
    
    # Cleanup if requested
    cleanup_resources
    
    # Check secrets
    check_secrets
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Validate deployment
    validate_deployment
    
    # Get outputs
    get_outputs
    
    # Show manual steps
    manual_steps
    
    print_success "🎉 Deployment completed successfully!"
    print_info "Stage: $STAGE"
    print_info "All resources are prefixed with: faces-of-plants-$STAGE-"
    echo ""
    print_info "Next steps:"
    echo "1. Complete the manual configuration steps above"
    echo "2. Test your application thoroughly"
    echo "3. Monitor AWS CloudWatch for any issues"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    -h|--help)
        echo "Usage: $0 [STAGE] [OPTIONS]"
        echo ""
        echo "STAGE: dev, staging, or production (default: dev)"
        echo ""
        echo "OPTIONS:"
        echo "  --cleanup    Clean up old resources before deployment"
        echo "  -h, --help   Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Deploy to dev stage"
        echo "  $0 staging            # Deploy to staging stage"
        echo "  $0 production         # Deploy to production stage"
        echo "  $0 dev --cleanup      # Clean up and deploy to dev stage"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
