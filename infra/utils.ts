/// <reference path="../.sst/platform/config.d.ts" />

/**
 * Utility functions for consistent resource naming across the infrastructure
 */

export interface ResourceNamingConfig {
  projectName: string;
  stage: string;
  component: string;
  resourceType: string;
}

/**
 * Generate a consistent resource name with the pattern:
 * faces-of-plants-{stage}-{component}-{resourceType}
 */
export function generateResourceName(config: ResourceNamingConfig): string {
  const { projectName, stage, component, resourceType } = config;
  return `${projectName}-${stage}-${component}-${resourceType}`;
}

/**
 * Generate a consistent resource name for the current SST context
 */
export function createResourceName(component: string, resourceType: string): string {
  return generateResourceName({
    projectName: "faces-of-plants",
    stage: $app.stage,
    component,
    resourceType,
  });
}

/**
 * Get the current stage from SST context
 */
export function getCurrentStage(): string {
  return $app.stage;
}

/**
 * Check if we're in production stage
 */
export function isProduction(): boolean {
  return getCurrentStage() === "production";
}

/**
 * Get environment-specific configuration
 */
export function getStageConfig() {
  const stage = getCurrentStage();
  
  return {
    stage,
    isProduction: isProduction(),
    domainName: stage === "production" 
      ? "facesofplants.org" 
      : `${stage}.facesofplants.org`,
    // Resource retention policy
    removal: stage === "production" ? "retain" : "remove",
    // Log retention (shorter for non-prod)
    logRetention: stage === "production" ? 30 : 7,
  };
}

/**
 * Get domain configuration for the current stage
 */
export function getDomainConfig() {
  const stage = getCurrentStage();
  
  if (stage === "production") {
    return {
      domainName: "facesofplants.org",
      hostedZone: "facesofplants.org",
      hasDomain: true,
    };
  } else if (stage === "staging") {
    return {
      domainName: "staging.facesofplants.org",
      hostedZone: "facesofplants.org",
      hasDomain: true,
    };
  } else {
    // Dev and other stages use default domains
    return {
      domainName: null,
      hostedZone: null,
      hasDomain: false,
    };
  }
}

/**
 * Generate consistent tags for AWS resources
 */
export function getResourceTags(): Record<string, string> {
  const stage = getCurrentStage();
  
  return {
    Project: "faces-of-plants",
    Stage: stage,
    Environment: stage,
    ManagedBy: "SST",
    CreatedAt: new Date().toISOString(),
  };
}
