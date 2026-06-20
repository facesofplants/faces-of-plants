/**
 * Example usage of the Logger service
 * Demonstrates structured logging with request IDs for tracing
 */

import { Logger, logger, type LogContext } from '../Logger';

// Example 1: Using the default logger instance
export function exampleDefaultLogger() {
  const context: LogContext = {
    requestId: 'req-12345',
    userId: 'user-67890',
    operation: 'query-species',
    duration: 150,
  };

  // Log informational message
  logger.info('Species query completed successfully', context);

  // Log warning
  logger.warn('Cache miss, fetching from provider', {
    ...context,
    provider: 'gbif',
  });

  // Log error with error object
  try {
    throw new Error('Provider API timeout');
  } catch (error) {
    logger.error('Failed to fetch species data', error as Error, {
      ...context,
      provider: 'gbif',
      retryCount: 3,
    });
  }
}

// Example 2: Creating a custom logger with specific configuration
export function exampleCustomLogger() {
  // Create logger for development with DEBUG level
  const devLogger = new Logger({
    minLevel: 'DEBUG',
    enableConsole: true,
    formatJson: false, // Human-readable for development
  });

  const context: LogContext = {
    requestId: 'req-dev-001',
    operation: 'test-feature',
  };

  devLogger.debug('Detailed debugging information', {
    ...context,
    variables: { x: 1, y: 2 },
  });

  devLogger.info('Feature test started', context);
}

// Example 3: Production logger with JSON formatting
export function exampleProductionLogger() {
  const prodLogger = new Logger({
    minLevel: 'INFO',
    enableConsole: true,
    formatJson: true, // JSON for CloudWatch
  });

  const context: LogContext = {
    requestId: 'req-prod-001',
    userId: 'user-123',
    operation: 'api-request',
  };

  prodLogger.info('API request received', {
    ...context,
    path: '/v1/query',
    method: 'POST',
  });
}

// Example 4: Lambda function integration
export function exampleLambdaIntegration(event: any, requestId: string): void {
  const context: LogContext = {
    requestId,
    operation: 'lambda-handler',
    path: event.path,
    method: event.httpMethod,
  };

  logger.info('Lambda invocation started', context);

  const startTime = Date.now();

  try {
    // Process request...
    logger.info('Processing request', {
      ...context,
      body: event.body,
    });

    // Success
    const duration = Date.now() - startTime;
    logger.info('Lambda invocation completed', {
      ...context,
      duration,
      statusCode: 200,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Lambda invocation failed', error as Error, {
      ...context,
      duration,
      statusCode: 500,
    });
    throw error;
  }
}

// Example 5: Middleware integration
export function exampleMiddlewareIntegration() {
  return async (event: any, next: () => Promise<any>) => {
    const requestId = event.headers['x-request-id'] || generateRequestId();
    const startTime = Date.now();

    const context: LogContext = {
      requestId,
      operation: 'api-request',
      path: event.path,
      method: event.httpMethod,
    };

    logger.info('Request received', context);

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        ...context,
        duration,
        statusCode: result.statusCode,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Request failed', error as Error, {
        ...context,
        duration,
      });

      throw error;
    }
  };
}

// Example 6: Changing log level dynamically
export function exampleDynamicLogLevel() {
  // Start with INFO level
  logger.setMinLevel('INFO');

  const context: LogContext = {
    requestId: 'req-001',
    operation: 'test',
  };

  logger.debug('This will not be logged', context);
  logger.info('This will be logged', context);

  // Enable debug logging for troubleshooting
  logger.setMinLevel('DEBUG');

  logger.debug('Now this will be logged', context);
}

// Helper function to generate request IDs
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Example 7: Structured logging with additional context
export function exampleStructuredContext() {
  const context: LogContext = {
    requestId: 'req-12345',
    operation: 'multi-provider-query',
    // Additional structured context
    providers: ['gbif', 'inaturalist', 'eol'],
    filters: {
      taxon: 'Quercus',
      location: 'California',
    },
    pagination: {
      limit: 100,
      offset: 0,
    },
  };

  logger.info('Starting multi-provider query', context);

  // All additional context fields will be preserved in the log output
}
