import { type APIGatewayProxyEvent, type APIGatewayProxyResult, type Context } from 'aws-lambda';

import { errorHandler } from '../../core/src/services/ErrorHandler';
import { timeoutHandler } from '../../core/src/services/TimeoutHandler';
import { ValidationError } from '../../core/src/validation/errors';
import { GBIFClient } from '../gbif/client';

async function speciesHandler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      throw new ValidationError('Species ID is required', [
        { path: ['id'], message: 'Species ID is required', code: 'required' },
      ]);
    }

    const gbifClient = new GBIFClient();

    // Fetch species info with timeout detection
    const speciesInfo = await timeoutHandler.withTimeout(context, 'getSpeciesInfo', () =>
      gbifClient.getSpeciesInfo(id)
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        speciesId: id,
        ...speciesInfo,
      }),
    };
  } catch (error) {
    console.error('Species handler error:', error);

    // Use error handler for consistent error responses
    return errorHandler.handle(error as Error, {
      requestId: context.awsRequestId,
      path: event.path,
      method: event.httpMethod,
    });
  }
}

// Wrap handler with timeout detection
export const handler = timeoutHandler.wrapHandler(speciesHandler);
