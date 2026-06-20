import { ServiceRegistry } from '@faces-of-plants/core/src/services/registry';

import { EOLProvider } from '../eol/provider';
import { GBIFProvider } from '../gbif/provider';
import { iNaturalistProvider } from '../inaturalist/provider';

// Global registry instance
export const serviceRegistry = ServiceRegistry.getInstance();

/**
 * Initialize and register all data source providers
 */
export async function initializeProviders(): Promise<void> {
  console.log('[ServiceRegistry] Initializing providers...');

  try {
    // Register GBIF provider
    const gbifProvider = new GBIFProvider();
    serviceRegistry.register(gbifProvider);

    // Register iNaturalist provider
    const inatProvider = new iNaturalistProvider();
    serviceRegistry.register(inatProvider);

    // Register EOL provider
    const eolProvider = new EOLProvider();
    serviceRegistry.register(eolProvider);

    console.log('[ServiceRegistry] All providers registered successfully');

    // Perform initial health checks
    await performHealthChecks();
  } catch (error) {
    console.error('[ServiceRegistry] Failed to initialize providers:', error);
    throw error;
  }
}

/**
 * Perform health checks on all registered providers
 */
export async function performHealthChecks(): Promise<void> {
  console.log('[ServiceRegistry] Running health checks...');

  const healthResults = await serviceRegistry.healthCheck();

  const healthyCount = Object.values(healthResults).filter((h) => h.healthy).length;
  const totalCount = Object.keys(healthResults).length;

  console.log(
    `[ServiceRegistry] Health checks completed: ${healthyCount}/${totalCount} providers healthy`
  );

  // Log individual results
  Object.entries(healthResults).forEach(([providerId, health]) => {
    const provider = serviceRegistry.getProvider(providerId);
    const status = health.healthy ? 'HEALTHY' : 'UNHEALTHY';
    console.log(
      `[ServiceRegistry] ${provider?.name || providerId}: ${status} (${health.responseTime}ms)`
    );

    if (health.errors) {
      health.errors.forEach((error) => console.error(`  Error: ${error}`));
    }
  });
}

/**
 * Get registry statistics
 */
export function getRegistryStats() {
  const providers = serviceRegistry.getProviders();
  const capabilities = providers.flatMap((p) => p.capabilities);
  const healthStatuses = serviceRegistry.getHealthStatus();

  return {
    providersCount: providers.length,
    providerNames: providers.map((p) => p.name),
    capabilityTypes: [...new Set(capabilities.map((c) => c.type))],
    healthyProviders: Object.values(healthStatuses).filter((h) => h.healthy).length,
    totalProviders: providers.length,
    registryInfo: serviceRegistry.getRegistryInfo(),
  };
}

/**
 * Search across all providers for debugging
 */
export async function testMultiSourceSearch(query: string) {
  console.log(`[ServiceRegistry] Testing multi-source search: "${query}"`);

  const providers = serviceRegistry.getProviders();
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      try {
        const result = await provider.client.search({
          query,
          limit: 5,
        });
        return {
          providerId: provider.id,
          providerName: provider.name,
          count: result.count,
          totalCount: result.totalCount,
          executionTime: result.metadata?.executionTime || 0,
          success: true,
        };
      } catch (error) {
        return {
          providerId: provider.id,
          providerName: provider.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        };
      }
    })
  );

  return results.map((result) => (result.status === 'fulfilled' ? result.value : result.reason));
}
