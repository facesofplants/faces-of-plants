import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let serviceExecutor: any = null;

async function ensureExecutor() {
  if (!serviceExecutor) {
    const { ServiceRegistry } = await import('@faces-of-plants/core/src/services/ServiceRegistry');
    const { ServiceExecutor } = await import('@faces-of-plants/core/src/services/ServiceExecutor');

    const registry = new ServiceRegistry();
    const executor = new ServiceExecutor(registry);

    executor.registerHandler('gbif', async (capabilityId: string, parameters: any) => {
      if (capabilityId !== 'species_search') {
        throw new Error(`Unknown GBIF capability: ${capabilityId}`);
      }
      const { GBIFClient } = await import('@faces-of-plants/functions/gbif/client');
      const gbif = new GBIFClient();
      return gbif.searchOccurrences(parameters);
    });

    await registry.registerProvider({
      id: 'gbif',
      name: 'Global Biodiversity Information Facility',
      capabilities: [
        {
          id: 'species_search',
          name: 'Species Search',
          description: 'Search for plant species using GBIF API.',
          inputSchema: {},
          outputSchema: {},
          version: '1.0.0',
        },
      ],
    });

    serviceExecutor = executor;
  }
  return serviceExecutor;
}

export async function POST(req: NextRequest) {
  try {
    const executor = await ensureExecutor();
    const { question } = await req.json();
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: "Missing or invalid 'question' field." }, { status: 400 });
    }
    console.log('[API/chat] Received question:', question);
    const result = await executor.execute({
      serviceId: 'gbif',
      capabilityId: 'species_search',
      parameters: { q: question },
      metadata: { requestId: Date.now().toString() },
    });
    console.log('[API/chat] Service executor result:', JSON.stringify(result, null, 2));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[API/chat] Error:', err);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}