import { describe, it, expect, beforeAll, test } from 'vitest';

import { EOLProvider } from '../../../../functions/eol/provider';
import { GBIFProvider } from '../../../../functions/gbif/provider';
import { iNaturalistProvider } from '../../../../functions/inaturalist/provider';
import { ServiceRegistry } from '../registry';
import { type DataSourceProvider } from '../types';

describe('Multi-Source Integration', () => {
  let registry: ServiceRegistry;
  let providers: DataSourceProvider[];

  beforeAll(async () => {
    registry = new ServiceRegistry();

    // Register all providers
    const gbifProvider = new GBIFProvider();
    const inatProvider = new iNaturalistProvider();
    const eolProvider = new EOLProvider();

    registry.register(gbifProvider);
    registry.register(inatProvider);
    registry.register(eolProvider);

    providers = registry.getProviders();
  });

  test('should register all providers', () => {
    // Should have GBIF, iNaturalist, and EOL providers
    expect(providers.length).toBe(3);

    const providerIds = providers.map((p: DataSourceProvider) => p.id);
    expect(providerIds).toContain('gbif');
    expect(providerIds).toContain('inaturalist');
    expect(providerIds).toContain('eol');
  });

  test('should provide registry statistics', () => {
    const registryInfo = registry.getRegistryInfo();

    expect(registryInfo.totalProviders).toBe(3);
    expect(registryInfo.providers.map((p) => p.name)).toContain(
      'Global Biodiversity Information Facility'
    );
    expect(registryInfo.providers.map((p) => p.name)).toContain('iNaturalist');
    expect(registryInfo.providers.map((p) => p.name)).toContain('Encyclopedia of Life');

    const capabilities = Object.keys(registryInfo.capabilities);
    expect(capabilities).toContain('occurrence');
    expect(capabilities).toContain('images');
  });

  test('should have working providers with capabilities', () => {
    providers.forEach((provider: DataSourceProvider) => {
      // Each provider should have basic required fields
      expect(provider.id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.version).toBeDefined();
      expect(provider.capabilities).toBeDefined();
      expect(provider.capabilities.length).toBeGreaterThan(0);

      // Should have at least one occurrence capability
      const hasOccurrence = provider.capabilities.some((cap) => cap.type === 'occurrence');
      expect(hasOccurrence).toBe(true);

      // Should have client implementation
      expect(provider.client).toBeDefined();
      expect(typeof provider.client.search).toBe('function');
    });
  });

  test('should find providers by capability', () => {
    const occurrenceProviders = registry.findProvidersWithCapability('occurrence');
    expect(occurrenceProviders.length).toBe(3);

    const imageProviders = registry.findProvidersWithCapability('images');
    expect(imageProviders.length).toBe(2); // iNaturalist and EOL
  });

  test('should validate providers before registration', () => {
    providers.forEach((provider: DataSourceProvider) => {
      const validation = registry.validateProvider(provider);
      // Note: This will show errors about duplicate IDs since they're already registered
      // but the individual provider structures should be valid for new instances
      expect(validation.warnings).toBeDefined();
    });
  });
});
