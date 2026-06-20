# Service Integration Layer

This module provides a service integration layer for orchestrating and extending service providers and capabilities in the Faces of Plants platform.

## Features
- **Service Registration:** Register and discover service providers and their capabilities.
- **Unified Execution:** Execute service requests in a decoupled, extensible way via registered handlers.
- **Plugin Support:** Register providers via plugins/extensions.

## Usage

```ts
import { ServiceRegistry } from './ServiceRegistry';
import { ServiceExecutor } from './ServiceExecutor';

const registry = new ServiceRegistry();
const executor = new ServiceExecutor(registry);

executor.registerHandler('gbif', async (capabilityId, parameters) => {
  const { GBIFClient } = await import('@faces-of-plants/functions/gbif/client');
  const gbif = new GBIFClient();
  return gbif.searchOccurrences(parameters);
});

await registry.registerProvider({
  id: 'gbif',
  name: 'Global Biodiversity Information Facility',
  capabilities: [{ id: 'species_search', name: 'Species Search', ... }]
});

const result = await executor.execute({
  serviceId: 'gbif',
  capabilityId: 'species_search',
  parameters: { q: 'Quercus' }
});
```

## Extending
- Add new providers by implementing the `ServiceProvider` interface.
- Register handlers for each service via `executor.registerHandler()`.

## See Also
- `ServiceRegistry.ts`
- `ServiceExecutor.ts`
- `types.ts`
