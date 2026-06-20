import { type ServiceRegistry } from './registry';
import {
  type UnifiedOccurrence,
  type DataSourceProvider,
  type SearchParams,
  SearchResult,
} from './types';

export interface MultiSourceQuery {
  query?: string;
  sources?: string[]; // If not specified, use all available
  filters?: Record<string, any>;
  options?: {
    maxResults?: number;
    timeout?: number;
    mergeStrategy?: 'union' | 'intersection' | 'priority';
    deduplication?: boolean;
    requireAllSources?: boolean;
  };
}

export interface MultiSourceResult {
  results: UnifiedOccurrence[];
  sources: SourceExecutionResult[];
  metadata: {
    totalCount: number;
    executionTime: number;
    sourcesQueried: number;
    sourcesSuccessful: number;
    deduplicationApplied: boolean;
    mergeStrategy: string;
    queryComplexity: number;
  };
}

export interface SourceExecutionResult {
  source: string;
  success: boolean;
  results: UnifiedOccurrence[];
  count: number;
  totalCount?: number;
  executionTime: number;
  error?: string;
  metadata?: {
    cacheHit: boolean;
    rateLimit?: boolean;
    queryTransformed?: boolean;
  };
}

export class MultiSourceQueryEngine {
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxConcurrentSources = 5;
  private registry: ServiceRegistry;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a multi-source query
   */
  async execute(query: MultiSourceQuery): Promise<MultiSourceResult> {
    const startTime = Date.now();

    try {
      // Validate query
      this.validateQuery(query);

      // Determine which sources to query
      const sources = this.selectSources(query.sources);

      if (sources.length === 0) {
        throw new Error('No available data sources found');
      }

      console.log(
        `[MultiSourceQueryEngine] Querying ${sources.length} sources:`,
        sources.map((s) => s.id)
      );

      // Execute queries in parallel with concurrency limit
      const sourceResults = await this.executeSourceQueries(sources, query);

      // Process and merge results
      const mergedResults = this.processResults(
        sourceResults,
        query.options?.mergeStrategy || 'union'
      );

      // Apply deduplication if requested
      let finalResults = mergedResults;
      if (query.options?.deduplication !== false) {
        finalResults = this.deduplicate(mergedResults);
      }

      // Apply result limits
      if (query.options?.maxResults) {
        finalResults = finalResults.slice(0, query.options.maxResults);
      }

      const executionTime = Date.now() - startTime;

      return {
        results: finalResults,
        sources: sourceResults,
        metadata: {
          totalCount: finalResults.length,
          executionTime,
          sourcesQueried: sources.length,
          sourcesSuccessful: sourceResults.filter((r) => r.success).length,
          deduplicationApplied: query.options?.deduplication !== false,
          mergeStrategy: query.options?.mergeStrategy || 'union',
          queryComplexity: this.calculateQueryComplexity(query),
        },
      };
    } catch (error) {
      console.error('[MultiSourceQueryEngine] Execution error:', error);
      throw error;
    }
  }

  /**
   * Execute queries across multiple sources with concurrency control
   *
   * Implements graceful degradation: if some providers fail, results from
   * successful providers are still returned. Provider status is tracked
   * in the response metadata for observability.
   *
   * @param sources - Array of data source providers to query
   * @param query - Multi-source query parameters
   * @returns Array of source execution results (both successful and failed)
   */
  private async executeSourceQueries(
    sources: DataSourceProvider[],
    query: MultiSourceQuery
  ): Promise<SourceExecutionResult[]> {
    const results: SourceExecutionResult[] = [];

    // Process sources in batches to respect concurrency limits
    for (let i = 0; i < sources.length; i += this.maxConcurrentSources) {
      const batch = sources.slice(i, i + this.maxConcurrentSources);

      // Use Promise.allSettled to handle partial failures gracefully
      const batchResults = await Promise.allSettled(
        batch.map((source) => this.querySource(source, query))
      );

      // Process batch results - include both successful and failed sources
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result for failed provider
          const source = batch[index];
          results.push({
            source: source.id,
            success: false,
            results: [],
            count: 0,
            executionTime: 0,
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    return results;
  }

  /**
   * Query a single source
   */
  private async querySource(
    source: DataSourceProvider,
    query: MultiSourceQuery
  ): Promise<SourceExecutionResult> {
    const startTime = Date.now();

    try {
      // Check if source supports occurrence queries
      const hasOccurrenceCapability = source.capabilities.some(
        (cap) => cap.type === 'occurrence' && cap.operations.some((op) => op.name === 'search')
      );

      if (!hasOccurrenceCapability) {
        throw new Error(`Source ${source.id} does not support occurrence search`);
      }

      // Transform query to source-specific format
      const sourceParams = this.transformQuery(query, source);

      // Apply timeout
      const timeout = query.options?.timeout || this.defaultTimeout;
      const searchPromise = source.client.search(sourceParams);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      );

      const result = await Promise.race([searchPromise, timeoutPromise]);

      return {
        source: source.id,
        success: true,
        results: result.results as UnifiedOccurrence[],
        count: result.count,
        totalCount: result.totalCount,
        executionTime: Date.now() - startTime,
        metadata: {
          cacheHit: result.metadata?.cacheHit || false,
          queryTransformed: true,
        },
      };
    } catch (error) {
      return {
        source: source.id,
        success: false,
        results: [],
        count: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform generic query to source-specific parameters
   */
  private transformQuery(query: MultiSourceQuery, source: DataSourceProvider): SearchParams {
    const params: SearchParams = {
      query: query.query,
      filters: { ...query.filters },
      limit: query.options?.maxResults || 100,
    };

    // Source-specific transformations could be added here
    // For now, pass through the parameters

    return params;
  }

  /**
   * Process and merge results from multiple sources
   *
   * Implements graceful degradation by only processing successful results.
   * If all providers fail, returns an empty array rather than throwing an error.
   *
   * @param sourceResults - Results from all queried sources (successful and failed)
   * @param mergeStrategy - Strategy for merging results from multiple sources
   * @returns Merged array of occurrences from successful providers
   */
  private processResults(
    sourceResults: SourceExecutionResult[],
    mergeStrategy: 'union' | 'intersection' | 'priority'
  ): UnifiedOccurrence[] {
    // Filter to only successful results - implements graceful degradation
    const successfulResults = sourceResults.filter((r) => r.success);

    // If all providers failed, return empty array (not an error)
    if (successfulResults.length === 0) {
      return [];
    }

    switch (mergeStrategy) {
      case 'union':
        return this.unionMerge(successfulResults);
      case 'intersection':
        return this.intersectionMerge(successfulResults);
      case 'priority':
        return this.priorityMerge(successfulResults);
      default:
        return this.unionMerge(successfulResults);
    }
  }

  /**
   * Union merge: combine all results
   */
  private unionMerge(results: SourceExecutionResult[]): UnifiedOccurrence[] {
    return results.flatMap((r) => r.results);
  }

  /**
   * Intersection merge: only results that appear in multiple sources
   */
  private intersectionMerge(results: SourceExecutionResult[]): UnifiedOccurrence[] {
    if (results.length < 2) {
      return results.flatMap((r) => r.results);
    }

    const recordMap = new Map<string, UnifiedOccurrence[]>();

    // Group records by similarity key
    results.forEach((result) => {
      result.results.forEach((record) => {
        const key = this.createSimilarityKey(record);
        if (!recordMap.has(key)) {
          recordMap.set(key, []);
        }
        recordMap.get(key)!.push(record);
      });
    });

    // Return only records that appear in multiple sources
    return Array.from(recordMap.values())
      .filter((records) => records.length > 1)
      .map((records) => this.selectBestRecord(records));
  }

  /**
   * Priority merge: use source priority for conflicts
   */
  private priorityMerge(results: SourceExecutionResult[]): UnifiedOccurrence[] {
    // Define source priority (could be configurable)
    const sourcePriority = ['gbif', 'eol', 'inaturalist', 'plantnet'];

    const recordMap = new Map<string, UnifiedOccurrence>();

    // Sort results by source priority
    const sortedResults = results.sort((a, b) => {
      const aPriority = sourcePriority.indexOf(a.source);
      const bPriority = sourcePriority.indexOf(b.source);
      return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
    });

    // Process in priority order
    sortedResults.forEach((result) => {
      result.results.forEach((record) => {
        const key = this.createSimilarityKey(record);
        if (!recordMap.has(key)) {
          recordMap.set(key, record);
        }
      });
    });

    return Array.from(recordMap.values());
  }

  /**
   * Remove duplicate records using intelligent matching
   */
  private deduplicate(results: UnifiedOccurrence[]): UnifiedOccurrence[] {
    const seen = new Map<string, UnifiedOccurrence>();

    for (const result of results) {
      const key = this.createDeduplicationKey(result);

      if (!seen.has(key)) {
        seen.set(key, result);
      } else {
        // Merge with existing record if confidence is higher
        const existing = seen.get(key)!;
        if (result.confidence > existing.confidence) {
          seen.set(key, result);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Create a similarity key for intersection merging
   */
  private createSimilarityKey(occurrence: UnifiedOccurrence): string {
    const taxon = occurrence.taxon.scientificName || 'unknown';
    const lat = occurrence.location.latitude?.toFixed(3) || 'unknown';
    const lon = occurrence.location.longitude?.toFixed(3) || 'unknown';

    return `${taxon}:${lat}:${lon}`;
  }

  /**
   * Create a deduplication key for exact matching
   */
  private createDeduplicationKey(occurrence: UnifiedOccurrence): string {
    const lat = occurrence.location.latitude?.toFixed(4) || 'unknown';
    const lon = occurrence.location.longitude?.toFixed(4) || 'unknown';
    const taxon = occurrence.taxon.scientificName || 'unknown';
    const date = occurrence.observation.eventDate || 'unknown';

    return `${taxon}:${lat}:${lon}:${date}`;
  }

  /**
   * Select the best record from a group of similar records
   */
  private selectBestRecord(records: UnifiedOccurrence[]): UnifiedOccurrence {
    return records.reduce((best, current) => {
      // Prefer records with higher confidence
      if (current.confidence > best.confidence) {
        return current;
      }

      // Prefer records with more complete data
      const currentCompleteness = this.calculateRecordCompleteness(current);
      const bestCompleteness = this.calculateRecordCompleteness(best);

      if (currentCompleteness > bestCompleteness) {
        return current;
      }

      return best;
    });
  }

  /**
   * Calculate how complete a record is (0-1 scale)
   */
  private calculateRecordCompleteness(record: UnifiedOccurrence): number {
    let score = 0;
    let maxScore = 0;

    // Location completeness
    maxScore += 4;
    if (record.location.latitude) {
      score += 1;
    }
    if (record.location.longitude) {
      score += 1;
    }
    if (record.location.country) {
      score += 1;
    }
    if (record.location.locality) {
      score += 1;
    }

    // Taxon completeness
    maxScore += 4;
    if (record.taxon.scientificName) {
      score += 1;
    }
    if (record.taxon.family) {
      score += 1;
    }
    if (record.taxon.genus) {
      score += 1;
    }
    if (record.taxon.species) {
      score += 1;
    }

    // Observation completeness
    maxScore += 3;
    if (record.observation.eventDate) {
      score += 1;
    }
    if (record.observation.basisOfRecord) {
      score += 1;
    }
    if (record.observation.recordedBy) {
      score += 1;
    }

    return score / maxScore;
  }

  /**
   * Calculate query complexity for metrics
   */
  private calculateQueryComplexity(query: MultiSourceQuery): number {
    let complexity = 1;

    if (query.query) {
      complexity += 1;
    }
    if (query.filters) {
      complexity += Object.keys(query.filters).length;
    }
    if (query.sources && query.sources.length > 1) {
      complexity += query.sources.length;
    }
    if (query.options?.mergeStrategy === 'intersection') {
      complexity += 2;
    }
    if (query.options?.deduplication) {
      complexity += 1;
    }

    return complexity;
  }

  /**
   * Validate query parameters
   */
  private validateQuery(query: MultiSourceQuery): void {
    if (!query.query && !query.filters) {
      throw new Error('Query must have either query text or filters');
    }

    if (query.options?.maxResults && query.options.maxResults > 10000) {
      throw new Error('Maximum results cannot exceed 10,000');
    }

    if (query.options?.timeout && query.options.timeout > 300000) {
      throw new Error('Timeout cannot exceed 5 minutes');
    }
  }

  /**
   * Select sources for the query
   */
  private selectSources(requestedSources?: string[]): DataSourceProvider[] {
    if (requestedSources && requestedSources.length > 0) {
      return requestedSources
        .map((id) => this.registry.getProvider(id))
        .filter(Boolean) as DataSourceProvider[];
    }

    // Return all sources that support occurrence search
    return this.registry.findProvidersWithCapability('occurrence');
  }
}
