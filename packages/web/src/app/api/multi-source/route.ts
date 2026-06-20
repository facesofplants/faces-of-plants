import { type NextRequest, NextResponse } from 'next/server';

import { MultiSourceQueryEngine } from '@faces-of-plants/core/src/services/queryEngine';
import { type DataSourceProvider, type DataSourceCapability } from '@faces-of-plants/core/src/services/types';
import { serviceRegistry, initializeProviders } from '@faces-of-plants/functions/registry/setup';

// Initialize the multi-source query engine
const queryEngine = new MultiSourceQueryEngine(serviceRegistry as any);

// Initialize providers once
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initializeProviders();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInitialized();

    const body = await request.json();
    const { query, sources, filters = {}, options = {} } = body;

    // Validate input
    if (!query && !filters) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either query or filters must be provided',
          data: null,
        },
        { status: 400 },
      );
    }

    // Build multi-source query
    const multiSourceQuery = {
      query,
      sources,
      filters,
      options: {
        maxResults: options.maxResults || 200,
        timeout: options.timeout || 30000,
        mergeStrategy: options.mergeStrategy || 'union',
        deduplication: options.deduplication !== false,
        requireAllSources: options.requireAllSources || false,
      },
    };

    console.log('[MULTI-SOURCE] Executing query:', {
      query: multiSourceQuery.query,
      sources: multiSourceQuery.sources || 'all',
      filterCount: Object.keys(multiSourceQuery.filters).length,
      options: multiSourceQuery.options,
    });

    // Execute multi-source query
    const result = await queryEngine.execute(multiSourceQuery);

    // Log execution summary
    console.log('[MULTI-SOURCE] Query completed:', {
      totalResults: result.results.length,
      sourcesQueried: result.metadata.sourcesQueried,
      sourcesSuccessful: result.metadata.sourcesSuccessful,
      executionTime: result.metadata.executionTime,
      deduplicationApplied: result.metadata.deduplicationApplied,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[MULTI-SOURCE] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      },
      { status: 500 },
    );
  }
}

// Add GET method for simple search queries
export async function GET(request: NextRequest) {
  try {
    await ensureInitialized();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle different actions
    switch (action) {
      case 'sources':
        return handleGetSources();
      case 'health':
        return handleHealthCheck();
      case 'stats':
        return handleGetStats();
      case 'info':
        return handleGetInfo();
      default:
        // Default to simple search
        return handleGetSearch(searchParams);
    }
  } catch (error) {
    console.error('[MULTI-SOURCE] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to handle request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

async function handleGetSearch(searchParams: URLSearchParams) {
  const query = searchParams.get('query');
  const sources = searchParams.get('sources')?.split(',') || [];
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query parameter is required for search',
      },
      { status: 400 },
    );
  }

  const multiSourceQuery = {
    query,
    sources: sources.length > 0 ? sources : undefined,
    filters: {},
    options: {
      maxResults: limit,
      timeout: 30000,
      mergeStrategy: 'union' as const,
      deduplication: true,
      requireAllSources: false,
    },
  };

  console.log('[MULTI-SOURCE] GET Search:', {
    query: multiSourceQuery.query,
    sources: multiSourceQuery.sources || 'all',
    limit,
    offset,
  });

  const result = await queryEngine.execute(multiSourceQuery);

  // Apply offset/limit to results
  const paginatedResults = result.results.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    data: {
      ...result,
      results: paginatedResults,
      pagination: {
        offset,
        limit,
        total: result.results.length,
        hasMore: offset + limit < result.results.length,
      },
    },
  });
}

async function handleGetSources() {
  const providers = serviceRegistry.getProviders();

  return NextResponse.json({
    success: true,
    data: {
      sources: providers.map((p: DataSourceProvider) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        baseUrl: p.baseUrl,
        capabilities: p.capabilities.map((c: DataSourceCapability) => ({
          type: c.type,
          operations: c.operations.map((op: { name: string }) => op.name),
          filters: c.filters.map((f: { name: string }) => f.name),
        })),
        rateLimit: p.rateLimit,
      })),
      totalSources: providers.length,
    },
  });
}

async function handleHealthCheck() {
  console.log('[MULTI-SOURCE] Performing health check...');

  const healthStatus = await serviceRegistry.healthCheck();
  const registryInfo = serviceRegistry.getRegistryInfo();

  return NextResponse.json({
    success: true,
    data: {
      overall: {
        status:
          registryInfo.healthyProviders === registryInfo.totalProviders ? 'healthy' : 'degraded',
        totalProviders: registryInfo.totalProviders,
        healthyProviders: registryInfo.healthyProviders,
        lastCheck: registryInfo.lastHealthCheck,
      },
      sources: healthStatus,
    },
  });
}

async function handleGetStats() {
  const stats = serviceRegistry.getAllProviderStats();
  const registryInfo = serviceRegistry.getRegistryInfo();

  return NextResponse.json({
    success: true,
    data: {
      registry: registryInfo,
      providers: stats,
    },
  });
}

async function handleGetInfo() {
  const registryInfo = serviceRegistry.getRegistryInfo();

  return NextResponse.json({
    success: true,
    data: {
      name: 'Multi-Source Biodiversity Data API',
      version: '1.0.0',
      description: 'Unified API for querying multiple biodiversity data sources',
      registry: registryInfo,
      endpoints: {
        query: 'POST /api/multi-source',
        sources: 'GET /api/multi-source?action=sources',
        health: 'GET /api/multi-source?action=health',
        stats: 'GET /api/multi-source?action=stats',
      },
    },
  });
}
