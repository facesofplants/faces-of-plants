import {
  type DataSourceProvider,
  type DataSourceCapability,
  type HealthStatus,
  UnifiedOccurrence,
} from './types';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private providers: Map<string, DataSourceProvider> = new Map();
  private capabilities: Map<string, DataSourceCapability[]> = new Map();
  private healthStatus: Map<string, HealthStatus> = new Map();
  private lastHealthCheck = new Date();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a data source provider
   */
  register(provider: DataSourceProvider): void {
    this.providers.set(provider.id, provider);
    this.capabilities.set(provider.id, provider.capabilities);

    console.log(`[ServiceRegistry] Registered provider: ${provider.name} (${provider.id})`);
  }

  /**
   * Unregister a data source provider
   */
  unregister(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      this.providers.delete(providerId);
      this.capabilities.delete(providerId);
      this.healthStatus.delete(providerId);
      console.log(`[ServiceRegistry] Unregistered provider: ${provider.name} (${providerId})`);
    }
  }

  /**
   * Get a specific provider by ID
   */
  getProvider(id: string): DataSourceProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  getProviders(): DataSourceProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support specific capabilities
   */
  getCapabilities(providerId: string): DataSourceCapability[] {
    return this.capabilities.get(providerId) || [];
  }

  /**
   * Find providers that support a specific capability type
   */
  findProvidersWithCapability(capabilityType: string): DataSourceProvider[] {
    return this.getProviders().filter((provider) =>
      provider.capabilities.some((cap) => cap.type === capabilityType)
    );
  }

  /**
   * Find providers that support a specific operation
   */
  findProvidersWithOperation(operation: string): DataSourceProvider[] {
    return this.getProviders().filter((provider) =>
      provider.capabilities.some((cap) => cap.operations.some((op) => op.name === operation))
    );
  }

  /**
   * Get provider statistics
   */
  getProviderStats(providerId: string): ProviderStats | undefined {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return undefined;
    }

    const health = this.healthStatus.get(providerId);

    return {
      id: providerId,
      name: provider.name,
      version: provider.version,
      capabilities: provider.capabilities.length,
      healthy: health?.healthy ?? false,
      lastCheck: health?.lastCheck ?? 'Never',
      responseTime: health?.responseTime ?? 0,
    };
  }

  /**
   * Get all provider statistics
   */
  getAllProviderStats(): ProviderStats[] {
    return this.getProviders()
      .map((provider) => this.getProviderStats(provider.id))
      .filter(Boolean) as ProviderStats[];
  }

  /**
   * Perform health check on all providers
   */
  async healthCheck(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};

    const healthChecks = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      const startTime = Date.now();

      try {
        // Try to perform a health check if available
        let health: HealthStatus;

        if (provider.client.healthCheck) {
          health = await provider.client.healthCheck();
        } else {
          // Fallback: try a simple search query
          await provider.client.search({ limit: 1 });
          health = {
            healthy: true,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
          };
        }

        results[id] = health;
        this.healthStatus.set(id, health);
      } catch (error) {
        const health: HealthStatus = {
          healthy: false,
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        };

        results[id] = health;
        this.healthStatus.set(id, health);
      }
    });

    await Promise.all(healthChecks);
    this.lastHealthCheck = new Date();

    return results;
  }

  /**
   * Get cached health status
   */
  getHealthStatus(): Record<string, HealthStatus> {
    const results: Record<string, HealthStatus> = {};

    for (const [id, health] of this.healthStatus) {
      results[id] = health;
    }

    return results;
  }

  /**
   * Get registry metadata
   */
  getRegistryInfo(): RegistryInfo {
    const providers = this.getProviders();
    const healthData = this.getHealthStatus();

    return {
      totalProviders: providers.length,
      healthyProviders: Object.values(healthData).filter((h) => h.healthy).length,
      lastHealthCheck: this.lastHealthCheck.toISOString(),
      capabilities: this.summarizeCapabilities(),
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        capabilities: p.capabilities.map((c) => c.type),
      })),
    };
  }

  /**
   * Summarize all capabilities across providers
   */
  private summarizeCapabilities(): CapabilitySummary {
    const allCapabilities = Array.from(this.capabilities.values()).flat();
    const capabilityCount = new Map<string, number>();

    allCapabilities.forEach((cap) => {
      capabilityCount.set(cap.type, (capabilityCount.get(cap.type) || 0) + 1);
    });

    return {
      occurrence: capabilityCount.get('occurrence') || 0,
      taxonomy: capabilityCount.get('taxonomy') || 0,
      images: capabilityCount.get('images') || 0,
      traits: capabilityCount.get('traits') || 0,
      conservation: capabilityCount.get('conservation') || 0,
    };
  }

  /**
   * Validate a provider before registration
   */
  validateProvider(provider: DataSourceProvider): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!provider.id) {
      errors.push('Provider ID is required');
    }
    if (!provider.name) {
      errors.push('Provider name is required');
    }
    if (!provider.version) {
      errors.push('Provider version is required');
    }
    if (!provider.capabilities || provider.capabilities.length === 0) {
      errors.push('At least one capability is required');
    }
    if (!provider.client) {
      errors.push('Client implementation is required');
    }

    // Check for duplicate ID
    if (this.providers.has(provider.id)) {
      errors.push(`Provider with ID '${provider.id}' already exists`);
    }

    // Validate capabilities
    provider.capabilities?.forEach((cap, index) => {
      if (!cap.type) {
        errors.push(`Capability ${index} is missing type`);
      }
      if (!cap.operations || cap.operations.length === 0) {
        errors.push(`Capability ${index} has no operations`);
      }
    });

    // Rate limit warnings
    if (!provider.rateLimit) {
      warnings.push('No rate limit specified - consider adding rate limiting');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Types for registry operations
export interface ProviderStats {
  id: string;
  name: string;
  version: string;
  capabilities: number;
  healthy: boolean;
  lastCheck: string;
  responseTime: number;
}

export interface RegistryInfo {
  totalProviders: number;
  healthyProviders: number;
  lastHealthCheck: string;
  capabilities: CapabilitySummary;
  providers: ProviderSummary[];
}

export interface ProviderSummary {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}

export interface CapabilitySummary {
  occurrence: number;
  taxonomy: number;
  images: number;
  traits: number;
  conservation: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
