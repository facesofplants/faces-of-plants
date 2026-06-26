#!/bin/bash
# Invalidate CloudFront cache for the frontend distribution
# Usage: ./scripts/invalidate-cloudfront.sh [paths]
# Example: ./scripts/invalidate-cloudfront.sh "/tools" "/tools/*"
# Without arguments, invalidates everything: /*

set -e

# Get the CloudFront distribution ID (main site only, not console.*)
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?@=='facesofplants.org']].Id | [0]" --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
  echo "Error: Could not find CloudFront distribution for facesofplants.org"
  echo "Make sure your AWS credentials are configured correctly."
  exit 1
fi

echo "Found CloudFront distribution: $DISTRIBUTION_ID"

# Default to invalidating everything
PATHS="${@:-/*}"

echo "Invalidating paths: $PATHS"

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths $PATHS

echo "Invalidation created successfully. It may take a few minutes to propagate."
