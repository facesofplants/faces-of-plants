import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult, type Context } from 'aws-lambda';
import { CacheService } from '../../core/src/services/CacheService';
import { LLMClient } from '../../core/src/services/llm';
import { errorHandler } from '../../core/src/services/ErrorHandler';
import { timeoutHandler } from '../../core/src/services/TimeoutHandler';
import { GBIFProvider } from '../gbif/provider';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const cacheService = new CacheService(
  process.env.CACHE_TABLE || '',
  dynamoClient,
  3600
);

async function queryHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { query, userType, filters } = JSON.parse(event.body || '{}');

    const gbifProvider = new GBIFProvider(cacheService);

    const searchParams = await timeoutHandler.withTimeout(
      context,
      'convertQueryToSearchParams',
      () => convertQueryToSearchParams(query, userType, filters)
    );

    const results = await timeoutHandler.withTimeout(context, 'providerSearch', () =>
      gbifProvider.client.search(searchParams)
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        query,
        searchParams,
        results: results.results,
        count: results.count,
        totalCount: results.totalCount,
        metadata: results.metadata,
      }),
    };
  } catch (error) {
    console.error('Query handler error:', error);

    return errorHandler.handle(error as Error, {
      requestId: context.awsRequestId,
      path: event.path,
      method: event.httpMethod,
    });
  }
}

export const handler = timeoutHandler.wrapHandler(queryHandler);

async function convertQueryToSearchParams(query: string, userType: string, filters: any) {
  const searchFilters = { ...filters };
  if (searchFilters.hasImage) {
    searchFilters.mediaType = 'StillImage';
    delete searchFilters.hasImage;
  }

  const provider = process.env.LLM_PROVIDER;
  const apiKey = process.env.LLM_API_KEY;
  const endpoint = process.env.LLM_ENDPOINT;
  const model = process.env.LLM_MODEL;

  if (provider && apiKey) {
    try {
      const client = new LLMClient(provider, apiKey, endpoint, model);
      const llmParams = await client.convertQueryToSearchParams(query, userType);

      return {
        query: llmParams.query || query,
        filters: {
          hasCoordinate: true,
          hasGeospatialIssue: false,
          ...searchFilters,
          ...(llmParams.filters || {}),
        },
        limit: llmParams.limit || (userType === 'researcher' ? 100 : 20),
      };
    } catch (err) {
      console.warn('[Query] LLM conversion failed, using fallback:', err);
    }
  }

  return {
    query,
    filters: {
      hasCoordinate: true,
      hasGeospatialIssue: false,
      ...searchFilters,
    },
    limit: userType === 'researcher' ? 100 : 20,
  };
}