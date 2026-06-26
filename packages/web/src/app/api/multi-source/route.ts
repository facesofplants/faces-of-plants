import { type NextRequest, NextResponse } from 'next/server';

import { resolvePlantQuery } from '@faces-of-plants/core/src/services/plantNameResolver';
import { ServiceRegistry } from '@faces-of-plants/core/src/services/registry';
import { MultiSourceQueryEngine } from '@faces-of-plants/core/src/services/queryEngine';

import { GBIFProvider } from '../../../../../functions/gbif/provider';
import { iNaturalistProvider } from '../../../../../functions/inaturalist/provider';
import { EOLProvider } from '../../../../../functions/eol/provider';
import { getSystemSettings } from '../../../lib/system-settings';

// Initialize registry and engine (singleton pattern for serverless)
let engine: MultiSourceQueryEngine | null = null;

async function getEngine(): Promise<MultiSourceQueryEngine> {
  const registry = ServiceRegistry.getInstance();
  const settings = await getSystemSettings([
    'api:gbif_user_agent',
    'api:inaturalist_user_agent',
    'api:eol',
  ]);

  const gbifUserAgent = settings['api:gbif_user_agent']?.trim() || undefined;
  const inaturalistUserAgent = settings['api:inaturalist_user_agent']?.trim() || undefined;
  const eolApiKey = settings['api:eol']?.trim() || undefined;

  registry.unregister('gbif');
  registry.unregister('inaturalist');
  registry.unregister('eol');

  registry.register(new GBIFProvider(undefined, { userAgent: gbifUserAgent }));
  registry.register(new iNaturalistProvider({ userAgent: inaturalistUserAgent }));
  registry.register(new EOLProvider({ apiKey: eolApiKey }));

  if (!engine) {
    engine = new MultiSourceQueryEngine(registry);
  }

  console.log('[MULTI-SOURCE] Registry refreshed with system settings overrides');
  return engine;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('species') || '';
    const sources = searchParams.get('sources')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const mergeStrategy = (searchParams.get('merge') || 'union') as 'union' | 'intersection' | 'priority';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter (q or species) is required' },
        { status: 400 },
      );
    }

    // Resolve the plant name
    const resolved = await resolvePlantQuery(query);
    const scientificName = resolved.plantName?.scientificName || query;

    console.log(`[MULTI-SOURCE] Query: "${query}" → Resolved: "${scientificName}" (source: ${resolved.plantName?.source})`);

    // Execute multi-source query
    const queryEngine = await getEngine();
    const result = await queryEngine.execute({
      query: scientificName,
      sources,
      filters: {
        hasCoordinate: true,
        ...(resolved.country ? { country: resolved.country } : {}),
      },
      options: {
        maxResults: limit,
        timeout: 15000,
        mergeStrategy,
        deduplication: true,
      },
    });

    const executionTime = Date.now() - startTime;

    console.log(`[MULTI-SOURCE] Completed in ${executionTime}ms: ${result.metadata.sourcesSuccessful}/${result.metadata.sourcesQueried} sources, ${result.results.length} results`);

    return NextResponse.json({
      success: true,
      data: {
        results: result.results,
        totalCount: result.metadata.totalCount,
        sources: result.sources.map((s) => ({
          source: s.source,
          success: s.success,
          count: s.count,
          executionTime: s.executionTime,
          error: s.error,
        })),
        metadata: {
          ...result.metadata,
          resolver: {
            originalQuery: query,
            resolvedName: scientificName,
            source: resolved.plantName?.source,
            country: resolved.country,
          },
        },
      },
    });
  } catch (error) {
    console.error('[MULTI-SOURCE] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
