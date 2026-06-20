// Core service abstractions for multi-source biodiversity data integration
export interface DataSourceProvider {
  id: string;
  name: string;
  version: string;
  baseUrl?: string;
  capabilities: DataSourceCapability[];
  client: DataSourceClient;
  rateLimit: RateLimit;
  authentication?: AuthenticationConfig;
}

export interface DataSourceCapability {
  type: 'occurrence' | 'taxonomy' | 'images' | 'traits' | 'conservation';
  operations: CapabilityOperation[];
  filters: FilterCapability[];
  schema: JSONSchema;
  examples: ExampleQuery[];
}

export interface CapabilityOperation {
  name: 'search' | 'get' | 'batch' | 'stream';
  description: string;
  parameters: JSONSchema;
  rateLimit?: RateLimit;
}

export interface FilterCapability {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: any[];
  format?: string;
}

export interface ExampleQuery {
  description: string;
  query: string;
  parameters: Record<string, any>;
  expectedResults?: number;
}

export interface DataSourceClient {
  search(params: SearchParams): Promise<SearchResult>;
  get(id: string): Promise<any>;
  batch(ids: string[]): Promise<any[]>;
  stream?(params: SearchParams): AsyncIterable<any>;
  healthCheck?(): Promise<HealthStatus>;
}

export interface SearchParams {
  query?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  sort?: SortOption[];
}

export interface SearchResult {
  results: any[];
  count: number;
  totalCount?: number;
  endOfRecords?: boolean;
  nextOffset?: number;
  metadata?: ResultMetadata;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ResultMetadata {
  executionTime: number;
  cacheHit: boolean;
  dataSourceVersion: string;
  queryComplexity: number;
}

export interface RateLimit {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

export interface AuthenticationConfig {
  type: 'apiKey' | 'oauth' | 'basic' | 'bearer';
  credentials: Record<string, string>;
  refreshable?: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  responseTime: number;
  lastCheck: string;
  errors?: string[];
  metadata?: Record<string, any>;
}

// Unified data models for cross-source compatibility
export interface UnifiedOccurrence {
  id: string;
  source: string;
  sourceId: string;
  taxon: TaxonInfo;
  location: LocationInfo;
  observation: ObservationInfo;
  metadata: SourceMetadata;
  confidence: number;
  lastUpdated: string;
  extensions?: Record<string, any>; // Source-specific additional data
}

export interface TaxonInfo {
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  taxonRank?: string;
  taxonomicStatus?: string;
  acceptedName?: string;
  parentTaxonKey?: string;
  taxonKey?: string;
}

export interface LocationInfo {
  latitude?: number;
  longitude?: number;
  country?: string;
  countryCode?: string;
  stateProvince?: string;
  locality?: string;
  elevation?: number;
  depth?: number;
  coordinateUncertainty?: number;
  geodeticDatum?: string;
  continent?: string;
  waterBody?: string;
  higherGeography?: string;
}

export interface ObservationInfo {
  eventDate?: string;
  year?: number;
  month?: number;
  day?: number;
  basisOfRecord?: string;
  institutionCode?: string;
  collectionCode?: string;
  catalogNumber?: string;
  recordedBy?: string;
  identifiedBy?: string;
  individualCount?: number;
  lifeStage?: string;
  reproductiveCondition?: string;
  behavior?: string;
  establishmentMeans?: string;
  occurrenceStatus?: string;
  preparations?: string;
  associatedMedia?: string[];
}

export interface SourceMetadata {
  license?: string;
  rightsHolder?: string;
  datasetName?: string;
  publisher?: string;
  publishingOrganization?: string;
  protocol?: string;
  lastCrawled?: string;
  lastParsed?: string;
  references?: string;
  datasetKey?: string;
  installationKey?: string;
  originalData: Record<string, any>;
  processingNotes?: string[];
}

// JSON Schema type for validation
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: any[];
  format?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}
