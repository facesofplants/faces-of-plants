/// <reference path="../.sst/platform/config.d.ts" />

import { createResourceName } from "./utils";

export function createSecrets() {
  // Secret for LLM API key (set with `sst secret set LLM_API_KEY ... --stage <stage>`)
  const llmApiKey = new sst.Secret(
    createResourceName("secrets", "llm-api-key").toUpperCase().replace(/-/g, "_")
  );
  
  // Google OAuth Client Secret for authentication
  const googleClientSecret = new sst.Secret(
    createResourceName("secrets", "google-client-secret").toUpperCase().replace(/-/g, "_")
  );

  // Google OAuth Client ID (public identifier, stored as secret for deploy convenience)
  const googleClientId = new sst.Secret(
    createResourceName("secrets", "google-client-id").toUpperCase().replace(/-/g, "_")
  );

  // Secret for NextAuth.js (set with `sst secret set AUTH_SECRET ... --stage <stage>`)
  const authSecret = new sst.Secret(
    createResourceName("secrets", "auth-secret").toUpperCase().replace(/-/g, "_")
  );

  // GitHub OAuth Client ID
  const githubClientId = new sst.Secret(
    createResourceName("secrets", "github-client-id").toUpperCase().replace(/-/g, "_")
  );

  // GitHub OAuth Client Secret
  const githubClientSecret = new sst.Secret(
    createResourceName("secrets", "github-client-secret").toUpperCase().replace(/-/g, "_")
  );

  // From address used for automatic admin invite emails
  const adminInviteFromEmail = new sst.Secret(
    createResourceName("secrets", "admin-invite-from-email").toUpperCase().replace(/-/g, "_")
  );

  return {
    llmApiKey,
    googleClientSecret,
    googleClientId,
    authSecret,
    githubClientId,
    githubClientSecret,
    adminInviteFromEmail,
  };
}
