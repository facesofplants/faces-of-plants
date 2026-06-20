import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  description?: string;
  homepage?: string;
  api_docs?: string;
  api_endpoints?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data_format?: string;
  spatial_coverage?: string;
  temporal_coverage?: string;
  update_frequency?: string;
  license?: string;
  citation?: string;
  contact?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  supported_features?: string[];
  integration_status?: string;
  mcp_server?: string;
  proxy_service?: string;
  tags?: string[];
  example_query?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  last_updated?: string;
  is_active?: boolean;
}

const client = new DynamoDBClient({ region: 'eu-central-1' });
// Uses environment variable DATA_SOURCES_TABLE if set, otherwise defaults to dev table name
const TABLE_NAME =
  process.env.DATA_SOURCES_TABLE ||
  'faces-of-plants-dev-facesofplantsdevdatabasedatasourcesTable-ksnvhvvu';

export async function batchInsertDataSources(items: DataSource[]) {
  const putRequests = items.map((item) => ({
    PutRequest: {
      Item: {
        id: { S: item.id },
        name: { S: item.name },
        type: { S: item.type },
        description: { S: item.description ?? '' },
        homepage: { S: item.homepage ?? '' },
        api_docs: { S: item.api_docs ?? '' },
        api_endpoints: { S: JSON.stringify(item.api_endpoints ?? []) },
        data_format: { S: item.data_format ?? '' },
        spatial_coverage: { S: item.spatial_coverage ?? '' },
        temporal_coverage: { S: item.temporal_coverage ?? '' },
        update_frequency: { S: item.update_frequency ?? '' },
        license: { S: item.license ?? '' },
        citation: { S: item.citation ?? '' },
        contact: { S: JSON.stringify(item.contact ?? {}) },
        supported_features: { S: JSON.stringify(item.supported_features ?? []) },
        integration_status: { S: item.integration_status ?? '' },
        mcp_server: { S: item.mcp_server ?? '' },
        proxy_service: { S: item.proxy_service ?? '' },
        tags: { S: JSON.stringify(item.tags ?? []) },
        example_query: { S: JSON.stringify(item.example_query ?? {}) },
        last_updated: { S: item.last_updated ?? '' },
        is_active: { N: item.is_active ? '1' : '0' },
      },
    },
  }));

  const command = new BatchWriteItemCommand({
    RequestItems: {
      [TABLE_NAME]: putRequests,
    },
  });
  await client.send(command);
}

// Example usage

const gbifSource = {
  id: 'gbif',
  name: 'Global Biodiversity Information Facility',
  type: 'biodiversity',
  description: 'Open-access data on species occurrences worldwide.',
  homepage: 'https://www.gbif.org/',
  api_docs: 'https://www.gbif.org/developer/summary',
  api_endpoints: ['https://api.gbif.org/v1/'],
  data_format: 'JSON',
  spatial_coverage: 'Global',
  temporal_coverage: 'Historical to present',
  update_frequency: 'Daily',
  license: 'CC BY 4.0',
  citation: 'GBIF.org (2025)',
  contact: { email: 'support@gbif.org' },
  supported_features: ['species search', 'occurrence search', 'taxonomic backbone'],
  integration_status: 'active',
  mcp_server: '',
  proxy_service: '',
  tags: ['biodiversity', 'species', 'occurrence'],
  example_query: { scientificName: 'Quercus robur' },
  last_updated: '2025-07-11',
  is_active: true,
};

const eolSource = {
  id: 'eol',
  name: 'Encyclopedia of Life',
  type: 'biodiversity',
  description: 'Aggregated species information from global providers.',
  homepage: 'https://eol.org/',
  api_docs: 'https://eol.org/docs/what-is-eol/api-overview',
  api_endpoints: ['https://eol.org/api/'],
  data_format: 'JSON',
  spatial_coverage: 'Global',
  temporal_coverage: 'Current',
  update_frequency: 'Weekly',
  license: 'CC BY 3.0',
  citation: 'Encyclopedia of Life (2025)',
  contact: { email: 'info@eol.org' },
  supported_features: ['species info', 'images', 'taxonomy'],
  integration_status: 'active',
  mcp_server: '',
  proxy_service: '',
  tags: ['species', 'taxonomy', 'images'],
  example_query: { id: '328672' },
  last_updated: '2025-07-11',
  is_active: true,
};

const inatSource = {
  id: 'inaturalist',
  name: 'iNaturalist',
  type: 'citizen science',
  description: 'Crowdsourced species observations and identifications.',
  homepage: 'https://www.inaturalist.org/',
  api_docs: 'https://api.inaturalist.org/v1/docs/',
  api_endpoints: ['https://api.inaturalist.org/v1/'],
  data_format: 'JSON',
  spatial_coverage: 'Global',
  temporal_coverage: 'Current',
  update_frequency: 'Real-time',
  license: 'CC BY-NC 4.0',
  citation: 'iNaturalist (2025)',
  contact: { email: 'help@inaturalist.org' },
  supported_features: ['observations', 'taxa', 'users'],
  integration_status: 'active',
  mcp_server: '',
  proxy_service: '',
  tags: ['citizen science', 'observations', 'species'],
  example_query: { taxon_id: 47126 },
  last_updated: '2025-07-11',
  is_active: true,
};

const worldclimSource = {
  id: 'worldclim',
  name: 'WorldClim',
  type: 'climate',
  description: 'Global climate data for environmental modeling.',
  homepage: 'https://www.worldclim.org/',
  api_docs: 'https://www.worldclim.org/data/v2.1/',
  api_endpoints: ['https://www.worldclim.org/data/v2.1/'],
  data_format: 'GeoTIFF, CSV',
  spatial_coverage: 'Global',
  temporal_coverage: '1970-2000, 2010-2018',
  update_frequency: 'Irregular',
  license: 'CC BY 4.0',
  citation: 'WorldClim (2025)',
  contact: { email: 'info@worldclim.org' },
  supported_features: ['climate layers', 'historical data'],
  integration_status: 'planned',
  mcp_server: '',
  proxy_service: '',
  tags: ['climate', 'environment', 'raster'],
  example_query: { variable: 'bio1', resolution: '2.5m' },
  last_updated: '2025-07-11',
  is_active: false,
};

const chelsaSource = {
  id: 'chelsa',
  name: 'CHELSA Climate Data',
  type: 'climate',
  description: 'High-resolution climate data for land surface modeling.',
  homepage: 'https://chelsa-climate.org/',
  api_docs: 'https://chelsa-climate.org/downloads/',
  api_endpoints: ['https://chelsa-climate.org/downloads/'],
  data_format: 'GeoTIFF',
  spatial_coverage: 'Global',
  temporal_coverage: '1979-2013',
  update_frequency: 'Irregular',
  license: 'CC BY 4.0',
  citation: 'CHELSA (2025)',
  contact: { email: 'contact@chelsa-climate.org' },
  supported_features: ['climate layers'],
  integration_status: 'planned',
  mcp_server: '',
  proxy_service: '',
  tags: ['climate', 'environment', 'raster'],
  example_query: { variable: 'precipitation', year: 2010 },
  last_updated: '2025-07-11',
  is_active: false,
};

const nasaSource = {
  id: 'nasa-earthdata',
  name: 'NASA Earthdata',
  type: 'remote sensing',
  description: 'Satellite imagery and global environmental data.',
  homepage: 'https://earthdata.nasa.gov/',
  api_docs: 'https://earthdata.nasa.gov/learn/api',
  api_endpoints: ['https://earthdata.nasa.gov/api/'],
  data_format: 'HDF, GeoTIFF, NetCDF',
  spatial_coverage: 'Global',
  temporal_coverage: '1970-present',
  update_frequency: 'Daily',
  license: 'Various',
  citation: 'NASA Earthdata (2025)',
  contact: { email: 'support@earthdata.nasa.gov' },
  supported_features: ['satellite imagery', 'environmental layers'],
  integration_status: 'planned',
  mcp_server: '',
  proxy_service: '',
  tags: ['remote sensing', 'satellite', 'environment'],
  example_query: { dataset: 'MODIS', variable: 'NDVI' },
  last_updated: '2025-07-11',
  is_active: false,
};

const openMeteoSource = {
  id: 'open-meteo',
  name: 'Open-Meteo',
  type: 'weather',
  description: 'Free weather API for non-commercial use.',
  homepage: 'https://open-meteo.com/',
  api_docs: 'https://open-meteo.com/en/docs',
  api_endpoints: ['https://api.open-meteo.com/v1/forecast'],
  data_format: 'JSON',
  spatial_coverage: 'Global',
  temporal_coverage: 'Current',
  update_frequency: 'Hourly',
  license: 'CC BY 4.0',
  citation: 'Open-Meteo (2025)',
  contact: { email: 'info@open-meteo.com' },
  supported_features: ['weather forecast', 'historical weather'],
  integration_status: 'planned',
  mcp_server: '',
  proxy_service: '',
  tags: ['weather', 'forecast', 'api'],
  example_query: { latitude: 52.52, longitude: 13.405 },
  last_updated: '2025-07-11',
  is_active: false,
};

const soilGridsSource = {
  id: 'soilgrids',
  name: 'SoilGrids',
  type: 'soil',
  description: 'Global gridded soil information.',
  homepage: 'https://soilgrids.org/',
  api_docs: 'https://soilgrids.org/api/',
  api_endpoints: ['https://rest.soilgrids.org/query'],
  data_format: 'JSON',
  spatial_coverage: 'Global',
  temporal_coverage: 'Current',
  update_frequency: 'Irregular',
  license: 'CC BY 4.0',
  citation: 'SoilGrids (2025)',
  contact: { email: 'info@soilgrids.org' },
  supported_features: ['soil properties', 'gridded data'],
  integration_status: 'planned',
  mcp_server: '',
  proxy_service: '',
  tags: ['soil', 'environment', 'gridded'],
  example_query: { lat: 40.7128, lon: -74.006 },
  last_updated: '2025-07-11',
  is_active: false,
};

// Example usage: batch insert all real sources
batchInsertDataSources([
  gbifSource,
  eolSource,
  inatSource,
  worldclimSource,
  chelsaSource,
  nasaSource,
  openMeteoSource,
  soilGridsSource,
]);
