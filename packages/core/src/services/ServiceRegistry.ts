import { type ServiceProvider, type ServiceCapability } from '../types';

export class ServiceRegistry {
  private providers = new Map<string, ServiceProvider>();
  private capabilities = new Map<string, ServiceCapability>();

  async registerProvider(provider: ServiceProvider): Promise<void> {
    if (provider.discover) {
      const discoveredCapabilities = await provider.discover();
      provider.capabilities = [...provider.capabilities, ...discoveredCapabilities];
    }
    this.providers.set(provider.id, provider);
    provider.capabilities.forEach((capability) => {
      this.capabilities.set(`${provider.id}:${capability.id}`, capability);
    });
  }

  getProvider(id: string): ServiceProvider | undefined {
    return this.providers.get(id);
  }

  getCapability(serviceId: string, capabilityId: string): ServiceCapability | undefined {
    return this.capabilities.get(`${serviceId}:${capabilityId}`);
  }

  getAllCapabilities(): ServiceCapability[] {
    return Array.from(this.capabilities.values());
  }

  async discoverServices(): Promise<ServiceProvider[]> {
    return Array.from(this.providers.values());
  }
}
