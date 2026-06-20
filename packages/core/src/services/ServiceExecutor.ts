import { type ServiceRequest, type ServiceResponse } from '../types';
import { type ServiceRegistry } from './ServiceRegistry';

export type ServiceHandler = (
  capabilityId: string,
  parameters: Record<string, any>
) => Promise<any>;

export class ServiceExecutor {
  private handlers = new Map<string, ServiceHandler>();

  constructor(private registry: ServiceRegistry) {}

  registerHandler(serviceId: string, handler: ServiceHandler): void {
    this.handlers.set(serviceId, handler);
  }

  async execute<T>(request: ServiceRequest): Promise<ServiceResponse<T>> {
    const startTime = Date.now();
    try {
      const provider = this.registry.getProvider(request.serviceId);
      if (!provider) {
        throw new Error(`Service not found: ${request.serviceId}`);
      }
      const capability = this.registry.getCapability(request.serviceId, request.capabilityId);
      if (!capability) {
        throw new Error(`Capability not found: ${request.capabilityId}`);
      }
      const handler = this.handlers.get(request.serviceId);
      if (!handler) {
        throw new Error(`No handler registered for service: ${request.serviceId}`);
      }
      const result = await handler(request.capabilityId, request.parameters);
      return {
        success: true,
        data: result,
        metadata: {
          requestId: request.metadata?.requestId || 'unknown',
          executionTime: Date.now() - startTime,
          serviceVersion: capability.version,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          requestId: request.metadata?.requestId || 'unknown',
          executionTime: Date.now() - startTime,
          serviceVersion: 'unknown',
        },
      };
    }
  }
}