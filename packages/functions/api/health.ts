import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';
const CURRENT_VERSION = 'v1';
const SUPPORTED_VERSIONS = ['v1'];
import { EOLClient } from '../eol/client';
import { GBIFClient } from '../gbif/client';
import { iNaturalistClient } from '../inaturalist/client';

interface ProviderHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
}

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: {
    current: string;
    supported: string[];
  };
  service: string;
  checks: {
    providers: {
      gbif: ProviderHealth;
      inaturalist: ProviderHealth;
      eol: ProviderHealth;
    };
    database: DatabaseHealth;
  };
}

/**
 * Check GBIF provider availability
 */
async function checkGBIFHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const client = new GBIFClient();
    // Simple test query with minimal data
    await client.searchOccurrences({ limit: 1, hasCoordinate: true });
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check iNaturalist provider availability
 */
async function checkiNaturalistHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const client = new iNaturalistClient();
    const result = await client.healthCheck();
    return {
      status: result.status,
      responseTime: Date.now() - startTime,
      message: result.message,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check EOL provider availability
 */
async function checkEOLHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const client = new EOLClient();
    const result = await client.healthCheck();
    return {
      status: result.status,
      responseTime: Date.now() - startTime,
      message: result.message,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check DynamoDB connectivity
 */
async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  try {
    // Use the cache table for health check as it's lightweight
    const dynamoClient = new DynamoDBClient({});
    const tableName = process.env.CACHE_TABLE || '';
    const command = new DescribeTableCommand({ TableName: tableName });
    const result = await dynamoClient.send(command);

    // Check if table is active
    if (result.Table?.TableStatus === 'ACTIVE') {
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } else {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Table status: ${result.Table?.TableStatus}`,
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Health check endpoint
 * Returns system status, API version information, and checks provider and database availability
 *
 * Requirements: 6.4
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Run all health checks in parallel for faster response
    const [gbifHealth, inatHealth, eolHealth, dbHealth] = await Promise.all([
      checkGBIFHealth(),
      checkiNaturalistHealth(),
      checkEOLHealth(),
      checkDatabaseHealth(),
    ]);

    // Determine overall health status
    const allHealthy =
      gbifHealth.status === 'healthy' &&
      inatHealth.status === 'healthy' &&
      eolHealth.status === 'healthy' &&
      dbHealth.status === 'healthy';

    const health: HealthCheckResponse = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: {
        current: CURRENT_VERSION,
        supported: SUPPORTED_VERSIONS,
      },
      service: 'faces-of-plants-api',
      checks: {
        providers: {
          gbif: gbifHealth,
          inaturalist: inatHealth,
          eol: eolHealth,
        },
        database: dbHealth,
      },
    };

    return {
      statusCode: allHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': CURRENT_VERSION,
      },
      body: JSON.stringify(health),
    };
  } catch (error) {
    console.error('Health check failed:', error);

    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
