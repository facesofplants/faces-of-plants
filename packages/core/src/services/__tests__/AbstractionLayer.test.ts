import { describe, it, expect } from 'vitest';

import { type ServiceProvider, type ServiceRequest } from '../../types';
import { AbstractionLayer } from '../AbstractionLayer';

describe('AbstractionLayer', () => {
  const mockProvider: ServiceProvider = {
    id: 'mock',
    name: 'Mock Service',
    capabilities: [
      {
        id: 'mock_cap',
        name: 'Mock Capability',
        description: 'A mock capability',
        inputSchema: {},
        outputSchema: {},
        version: '1.0.0',
      },
    ],
  };

  it('registers and lists capabilities', async () => {
    const layer = new AbstractionLayer();
    await layer.registerProvider(mockProvider);
    const caps = layer.getAllCapabilities();
    expect(caps.length).toBe(1);
    expect(caps[0].id).toBe('mock_cap');
  });

  it('executes a registered capability (mock)', async () => {
    const layer = new AbstractionLayer();
    await layer.registerProvider(mockProvider);
    // Patch executor for test
    (layer as any).executor.execute = async () => ({ success: true, data: 'ok' });
    const req: ServiceRequest = {
      serviceId: 'mock',
      capabilityId: 'mock_cap',
      parameters: {},
    };
    const res = await layer.execute(req);
    expect(res.success).toBe(true);
    expect(res.data).toBe('ok');
  });

  it('runs a workflow and stops on failure', async () => {
    const layer = new AbstractionLayer();
    await layer.registerProvider(mockProvider);
    (layer as any).executor.execute = async (req: any) =>
      req.capabilityId === 'fail'
        ? { success: false, error: 'fail' }
        : { success: true, data: 'ok' };
    const reqs: ServiceRequest[] = [
      { serviceId: 'mock', capabilityId: 'mock_cap', parameters: {} },
      { serviceId: 'mock', capabilityId: 'fail', parameters: {} },
      { serviceId: 'mock', capabilityId: 'mock_cap', parameters: {} },
    ];
    const results = await layer.runWorkflow(reqs);
    expect(results.length).toBe(2);
    expect(results[1].success).toBe(false);
  });
});
