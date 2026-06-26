export interface GBIFSearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  country?: string;
  basisOfRecord?: string;
  scientificName?: string;
  taxonKey?: number;
  hasCoordinate?: boolean;
  hasGeospatialIssue?: boolean;
  year?: string;
  kingdom?: string;
  kingdomKey?: number;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  mediaType?: string;
  geometry?: string; // WKT POLYGON for geographic filtering
}

export interface GBIFOccurrence {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  country: string;
  stateProvince?: string;
  locality?: string;
  eventDate?: string;
  basisOfRecord: string;
  institutionCode?: string;
  collectionCode?: string;
  catalogNumber?: string;
  recordedBy?: string;
  identifiedBy?: string;
  license?: string;
  rightsHolder?: string;
  datasetName?: string;
  publishingOrgKey?: string;
  publishingCountry?: string;
  protocol?: string;
  lastCrawled?: string;
  lastParsed?: string;
  crawlId?: number;
  installationKey?: string;
  hostingOrganizationKey?: string;
  taxonKey?: number;
  speciesKey?: number;
  acceptedTaxonKey?: number;
  acceptedScientificName?: string;
  taxonomicStatus?: string;
  iucnRedListCategory?: string;
  elevation?: number;
  elevationAccuracy?: number;
  depth?: number;
  depthAccuracy?: number;
  coordinateUncertaintyInMeters?: number;
  year?: number;
  month?: number;
  day?: number;
  eventTime?: string;
  modified?: string;
  references?: string;
  relations?: string[];
  geodeticDatum?: string;
  coordinateAccuracy?: number;
  coordinatePrecision?: number;
  continent?: string;
  waterBody?: string;
  countryCode?: string;
  recordNumber?: string;
  fieldNumber?: string;
  verbatimEventDate?: string;
  verbatimLocality?: string;
  verbatimElevation?: string;
  verbatimDepth?: string;
  verbatimCoordinates?: string;
  verbatimLatitude?: string;
  verbatimLongitude?: string;
  verbatimCoordinateSystem?: string;
  verbatimSRS?: string;
  higherGeography?: string;
  county?: string;
  municipality?: string;
  higherClassification?: string;
  preparations?: string;
  occurrenceRemarks?: string;
  individualCount?: number;
  sex?: string;
  lifeStage?: string;
  reproductiveCondition?: string;
  behavior?: string;
  establishmentMeans?: string;
  occurrenceStatus?: string;
  associatedMedia?: string[];
  media?: Array<{
    type?: string;
    identifier: string;
    format?: string;
    references?: string;
    license?: string;
    creator?: string;
    description?: string;
  }>;
  associatedReferences?: string[];
  associatedSequences?: string[];
  associatedTaxa?: string[];
  otherCatalogNumbers?: string[];
  occurrenceId?: string;
  organismId?: string;
  organismName?: string;
  organismScope?: string;
  associatedOccurrences?: string[];
  associatedOrganisms?: string[];
  previousIdentifications?: string[];
  organismRemarks?: string;
  materialSampleId?: string;
  eventId?: string;
  parentEventId?: string;
  eventRemarks?: string;
  samplingProtocol?: string;
  samplingEffort?: string;
  sampleSizeValue?: number;
  sampleSizeUnit?: string;
  fieldNotes?: string;
  eventAccordingTo?: string;
  identificationId?: string;
  identificationQualifier?: string;
  typeStatus?: string;
  identificationRemarks?: string;
  identificationReferences?: string[];
  identificationVerificationStatus?: string;
  identifiedByIds?: string[];
  dateIdentified?: string;
  locationId?: string;
  higherGeographyId?: string;
  locationAccordingTo?: string;
  locationRemarks?: string;
  geologicalContextId?: string;
  earliestEonOrLowestEonothem?: string;
  latestEonOrHighestEonothem?: string;
  earliestEraOrLowestErathem?: string;
  latestEraOrHighestErathem?: string;
  earliestPeriodOrLowestSystem?: string;
  latestPeriodOrHighestSystem?: string;
  earliestEpochOrLowestSeries?: string;
  latestEpochOrHighestSeries?: string;
  earliestAgeOrLowestStage?: string;
  latestAgeOrHighestStage?: string;
  lowestBiostratigraphicZone?: string;
  highestBiostratigraphicZone?: string;
  lithostratigraphicTerms?: string[];
  group?: string;
  formation?: string;
  member?: string;
  bed?: string;
}

export interface UserCollection {
  userId: string;
  collectionId: string;
  name: string;
  description: string;
  queries: SavedQuery[];
  species: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedQuery {
  id: string;
  query: string;
  userType: 'citizen' | 'researcher';
  results?: GBIFOccurrence[];
  timestamp: string;
}

export interface QueryHistory {
  userId: string;
  queryId: string;
  query: string;
  userType: 'citizen' | 'researcher';
  results: any;
  timestamp: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'groq' | 'mistral' | 'custom';
  apiKey: string;
  endpoint: string;
  model: string;
}

// Service integration types
export interface ServiceCapability {
  id: string;
  name: string;
  description: string;
  inputSchema: object;
  outputSchema: object;
  version: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  baseUrl?: string;
  capabilities: ServiceCapability[];
  authenticate?: () => Promise<void>;
  discover?: () => Promise<ServiceCapability[]>;
}

export interface ServiceRequest {
  serviceId: string;
  capabilityId: string;
  parameters: Record<string, any>;
  metadata?: {
    requestId: string;
    userId?: string;
    context?: Record<string, any>;
  };
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    requestId: string;
    executionTime: number;
    serviceVersion: string;
  };
}
