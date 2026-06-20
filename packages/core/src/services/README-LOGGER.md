# Logger Service

## Overview

The Logger service provides structured JSON logging with request IDs for production-ready observability. It implements the logging requirements from the production readiness specification (Requirement 6.3).

## Features

- **Structured JSON Logging**: All logs are formatted as JSON for easy parsing by CloudWatch and other log aggregation tools
- **Request ID Tracing**: Every log entry includes a requestId for distributed tracing
- **Log Levels**: Support for ERROR, WARN, INFO, and DEBUG levels with filtering
- **Error Details**: Automatic capture of error name, message, and stack trace
- **Flexible Context**: Support for additional context fields beyond standard ones
- **Environment-Aware**: Automatically uses JSON formatting in production, human-readable in development

## Installation

The Logger service is part of the `@faces-of-plants/core` package:

```typescript
import { Logger, logger, LogContext } from '@faces-of-plants/core';
```

## Usage

### Basic Usage with Default Logger

```typescript
import { logger, LogContext } from '@faces-of-plants/core';

const context: LogContext = {
  requestId: 'req-12345',
  userId: 'user-67890',
  operation: 'query-species',
};

// Log informational message
logger.info('Species query completed', context);

// Log warning
logger.warn('Cache miss detected', context);

// Log error with error object
try {
  // ... some operation
} catch (error) {
  logger.error('Operation failed', error as Error, context);
}

// Log debug information
logger.debug('Detailed debugging info', context);
```

### Creating Custom Logger

```typescript
import { Logger } from '@faces-of-plants/core';

// Development logger with debug level
const devLogger = new Logger({
  minLevel: 'DEBUG',
  enableConsole: true,
  formatJson: false, // Human-readable
});

// Production logger
const prodLogger = new Logger({
  minLevel: 'INFO',
  enableConsole: true,
  formatJson: true, // JSON for CloudWatch
});
```

### Lambda Function Integration

```typescript
import { logger, LogContext } from '@faces-of-plants/core';

export const handler = async (event: any) => {
  const requestId = event.requestContext?.requestId || generateRequestId();
  const startTime = Date.now();

  const context: LogContext = {
    requestId,
    operation: 'api-handler',
    path: event.path,
    method: event.httpMethod,
  };

  logger.info('Request received', context);

  try {
    // Process request
    const result = await processRequest(event);
    
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      ...context,
      duration,
      statusCode: 200,
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
```

### Middleware Integration

```typescript
import { logger, LogContext } from '@faces-of-plants/core';

export const loggingMiddleware = (handler: any) => {
  return async (event: any) => {
    const requestId = event.headers['x-request-id'] || generateRequestId();
    const startTime = Date.now();

    const context: LogContext = {
      requestId,
      operation: 'api-request',
      path: event.path,
      method: event.httpMethod,
    };

    logger.info('Request started', context);

    try {
      const result = await handler(event);
      const duration = Date.now() - startTime;

      logger.info('Request succeeded', {
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
};
```

### Adding Custom Context Fields

```typescript
import { logger, LogContext } from '@faces-of-plants/core';

const context: LogContext = {
  requestId: 'req-12345',
  operation: 'multi-provider-query',
  // Additional custom fields
  providers: ['gbif', 'inaturalist', 'eol'],
  filters: {
    taxon: 'Quercus',
    location: 'California',
  },
  cacheHit: false,
};

logger.info('Query executed', context);
```

## Log Structure

All logs follow this structure:

```typescript
{
  "timestamp": "2024-12-03T23:28:25.123Z",
  "level": "INFO",
  "message": "Species query completed",
  "requestId": "req-12345",
  "userId": "user-67890",
  "operation": "query-species",
  "duration": 150,
  "context": {
    // Additional custom fields
  },
  "error": {  // Only for ERROR level
    "name": "Error",
    "message": "Something went wrong",
    "stack": "Error: Something went wrong\n  at ..."
  }
}
```

## Log Levels

The logger supports four log levels with filtering:

- **ERROR**: Unhandled exceptions, system failures
- **WARN**: Retryable errors, degraded performance
- **INFO**: Normal operations, successful requests (default)
- **DEBUG**: Detailed execution information

Set the minimum level:

```typescript
logger.setMinLevel('DEBUG'); // Log everything
logger.setMinLevel('INFO');  // Log INFO, WARN, ERROR
logger.setMinLevel('WARN');  // Log WARN, ERROR
logger.setMinLevel('ERROR'); // Log ERROR only
```

## Environment Configuration

The default logger respects environment variables:

```bash
# Set log level
LOG_LEVEL=DEBUG

# NODE_ENV controls formatting
NODE_ENV=production  # Uses JSON formatting
NODE_ENV=development # Uses human-readable formatting
```

## CloudWatch Integration

The Logger service is designed to work seamlessly with AWS CloudWatch Logs:

1. **JSON Formatting**: Logs are automatically formatted as JSON in production
2. **Request ID**: Every log includes a requestId for tracing across Lambda invocations
3. **Structured Fields**: All context fields are preserved for CloudWatch Insights queries
4. **Error Details**: Full error stack traces are captured for debugging

### CloudWatch Insights Queries

```sql
-- Find all errors for a specific request
fields @timestamp, message, error.message, error.stack
| filter requestId = "req-12345"
| sort @timestamp desc

-- Find slow requests
fields @timestamp, requestId, operation, duration
| filter duration > 2000
| sort duration desc

-- Count errors by operation
fields operation
| filter level = "ERROR"
| stats count() by operation
```

## Testing

The Logger service includes comprehensive tests:

- **Unit Tests**: 18 tests covering all functionality
- **Property Tests**: 4 property-based tests validating correctness properties

Run tests:

```bash
npm test -- Logger --run
```

## API Reference

### Logger Class

#### Constructor

```typescript
new Logger(config?: LoggerConfig)
```

**LoggerConfig**:
- `minLevel?: LogLevel` - Minimum log level (default: 'INFO')
- `enableConsole?: boolean` - Enable console output (default: true)
- `formatJson?: boolean` - Use JSON formatting (default: true)

#### Methods

- `info(message: string, context: LogContext): void`
- `warn(message: string, context: LogContext): void`
- `error(message: string, error: Error, context: LogContext): void`
- `debug(message: string, context: LogContext): void`
- `setMinLevel(level: LogLevel): void`
- `getMinLevel(): LogLevel`

### LogContext Interface

```typescript
interface LogContext {
  requestId: string;      // Required: Unique request identifier
  userId?: string;        // Optional: User identifier
  operation: string;      // Required: Operation name
  duration?: number;      // Optional: Operation duration in ms
  [key: string]: any;     // Additional custom fields
}
```

## Best Practices

1. **Always Include Request ID**: Every log should have a requestId for tracing
2. **Use Appropriate Levels**: 
   - ERROR for failures that need attention
   - WARN for degraded performance or retryable errors
   - INFO for normal operations
   - DEBUG for detailed troubleshooting
3. **Add Context**: Include relevant context fields for debugging
4. **Log Duration**: Include duration for performance monitoring
5. **Structured Data**: Use context fields instead of string interpolation
6. **Error Objects**: Always pass the full error object to `logger.error()`

## Related Documentation

- [Production Readiness Requirements](/.kiro/specs/production-readiness/requirements.md)
- [Production Readiness Design](/.kiro/specs/production-readiness/design.md)
- [Logger Examples](/packages/core/src/services/examples/loggerExample.ts)
