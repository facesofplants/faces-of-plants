#!/bin/bash
set -e

# Run OpenNext build
npx --yes open-next@latest build

# Hoist openid-client and its dependencies to the Lambda's top-level node_modules
LAMBDA_NM=".open-next/server-functions/default/node_modules"
OPENID_NM="$LAMBDA_NM/.pnpm/openid-client@5.7.1/node_modules"

if [ -d "$OPENID_NM/openid-client" ]; then
  echo "[build-open-next] Hoisting openid-client to $LAMBDA_NM/"
  rm -rf "$LAMBDA_NM/openid-client"
  cp -r "$OPENID_NM/openid-client" "$LAMBDA_NM/"
  for dep in jose lru-cache object-hash oidc-token-hash; do
    if [ -d "$OPENID_NM/$dep" ]; then
      rm -rf "$LAMBDA_NM/$dep"
      cp -r "$OPENID_NM/$dep" "$LAMBDA_NM/"
    fi
  done
  echo "[build-open-next] Done."
else
  echo "[build-open-next] WARNING: openid-client not found in $OPENID_NM"
fi
