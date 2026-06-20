# Timeout Handling

This document describes the timeout handling implementation for Lambda functions in the Faces of Plants platform.

## Overview

Lambda functions have a maximum execution time (timeout) configured per function. When a function approaches or exceeds this timeout, it's important to:

1. Detect the timeout condition early
2. Log appropriate warnings and errors
3. Return a proper 504 Gateway Timeout response to clients
4. Clean up resources gracefully

## Architecture

### Components

1. **TimeoutHandler**: Core service for timeout detection and handling
2. **GatewayTimeoutError**: Error class for timeout conditions (504 status)
3. **Infrastructure Configuration**: Lambda timeout settings in `infra/api.ts`
4. **Handler Wrappers**: Middleware to wrap Lambda handlers with timeout detection

### Lambda Timeout Configuration

Timeouts are configured per endpoint in `infra/api.ts`:

```typescript
api.route("POST /query", {
  handler: "packages/functions/api/query.handler",
  timeout: "30 seconds", // Configure Lambda timeout
  // ... other configuration
});
```

**Configured Timeouts:**
- `/query`: 30 seconds (complex queries with LLM processing)
- `/species/{id}`: 15 seconds (single species lookup)
- `/collections`: 15 seconds (collection operations)
- `/data-sources`: 10 seconds (simple database scan)
- `/auth/cognito`: 10 seconds (authentication)
- `/admin/cache`: 20 seconds (cache invalidation operations)

## Usage

### Basic Handler Wrapping

The simplest way to add timeout handling is to wrap your handler:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { timeoutHandler } from "../../core/src/services/TimeoutHandler";
import { errorHandler } from "../../core/src/services/ErrorHandler";

async function myHandler(
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    // Your handler logic here
    const result = await someOperation();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return errorHandler.handle(error as Error, {
      requestId: context.awsRequestId,
      path: event.path,
      method: event.httpMethod,
    });
  }
}

// Wrap handler with timeout detection
export const handler = timeoutHandler.wrapHandler(myHandler);
```

### Timeout-Aware Operations

For long-running operations within your handler, use `withTimeout`:

```typescript
import { timeoutHandler } from "../../core/src/services/TimeoutHandler";

async function myHandler(event: APIGatewayProxyEvent, context: Context) {
  try {
    // Wrap long-running operations with timeout detection
    const data = await timeoutHandler.withTimeout(
      context,
      'fetchExternalData',
      () => fetchFromExternalAPI()
    );
    
    const processed = await timeoutHandler.withTimeout(
      context,
      'processData',
      () => processData(data)
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(processed),
    };
  } catch (error) {
    return errorHandler.handle(error as Error, {
      requestId: context.awsRequestId,
      path: event.path,
      method: event.httpMethod,
    });
  }
}

export const handler = timeoutHandler.wrapHandler(myHandler);
```

### Manual Timeout Checks

For fine-grained control, you can manually check timeout conditions:

```typescript
import { timeoutHandler, getRemainingTime } from "../../core/src/services/TimeoutHandler";

async function myHandler(event: APIGatewayProxyEvent, context: Context) {
  // Check remaining time
  const remaining = getRemainingTime(context);
  console.log(`Remaining time: ${remaining}ms`);
  
  // Check if approaching timeout
  if (timeoutHandler.isApproachingTimeout(context)) {
    console.warn('Approaching timeout, skipping optional operations');
    // Skip non-critical operations
  }
  
  // Check if should abort
  if (timeoutHandler.shouldAbort(context)) {
    timeoutHandler.throwTimeoutError(context, 'operation');
  }
  
  // Continue with critical operations only
}
```

## Configuration

### TimeoutHandler Configuration

The `TimeoutHandler` can be configured with custom settings:

```typescript
import { TimeoutHandler } from "../../core/src/services/TimeoutHandler";

const customHandler = new TimeoutHandler({
  // Warning threshold: log warning when 80% of time is used (default)
  warningThreshold: 0.8,
  
  // Grace period: abort if less than 1000ms remaining (default)
  gracePeriod: 1000,
});
```

### Configuration Options

- **warningThreshold** (default: 0.8): Percentage of timeout duration at which to log warnings
  - 0.8 = log warning when 80% of time is used
  - Helps identify operations that are taking too long

- **gracePeriod** (default: 1000ms): Minimum time remaining before aborting
  - Ensures enough time to return a proper error response
  - Prevents Lambda from timing out mid-response

## Behavior

### Timeout Detection Flow

1. **Before Operation**: Check if within grace period → abort if true
2. **During Operation**: Execute the operation
3. **After Operation**: Check again if within grace period → abort if true
4. **On Timeout**: Throw `GatewayTimeoutError` with details

### Warning Logs

When approaching timeout (80% of time used by default):

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "WARN",
  "message": "Approaching Lambda timeout",
  "requestId": "abc-123",
  "operation": "fetchExternalData",
  "remainingTimeMs": 5000,
  "functionName": "query-handler"
}
```

### Error Logs

When timeout occurs:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "ERROR",
  "message": "Lambda function timeout",
  "requestId": "abc-123",
  "operation": "processData",
  "remainingTimeMs": 500,
  "functionName": "query-handler"
}
```

### Error Response

When a timeout occurs, clients receive a 504 Gateway Timeout response:

```json
{
  "error": {
    "code": "GATEWAY_TIMEOUT",
    "message": "Request timeout - operation took too long to complete",
    "details": {
      "operation": "processData",
      "requestId": "abc-123",
      "functionName": "query-handler"
    },
    "requestId": "abc-123"
  }
}
```

## Best Practices

### 1. Wrap All Handlers

Always wrap your Lambda handlers with `timeoutHandler.wrapHandler()`:

```typescript
export const handler = timeoutHandler.wrapHandler(myHandler);
```

### 2. Wrap Long Operations

Use `withTimeout` for operations that might take significant time:

```typescript
const result = await timeoutHandler.withTimeout(
  context,
  'operationName',
  () => longRunningOperation()
);
```

### 3. Set Appropriate Timeouts

Configure Lambda timeouts based on expected operation duration:
- Simple lookups: 10-15 seconds
- Complex queries: 20-30 seconds
- Batch operations: 30-60 seconds

### 4. Handle Gracefully

When approaching timeout, consider:
- Returning partial results
- Skipping optional operations
- Caching intermediate results

### 5. Monitor Timeout Metrics

Track timeout occurrences in CloudWatch:
- Count of 504 responses
- Operations that frequently timeout
- Average remaining time at completion

## Testing

### Unit Tests

Test timeout detection logic:

```typescript
import { describe, it, expect } from 'vitest';
import { TimeoutHandler } from '../TimeoutHandler';
import { GatewayTimeoutError } from '../../validation/errors';

describe('TimeoutHandler', () => {
  it('should throw timeout error when within grace period', async () => {
    const handler = new TimeoutHandler({ gracePeriod: 2000 });
    const context = createMockContext(1000); // 1 second remaining
    
    await expect(
      handler.withTimeout(context, 'test', () => Promise.resolve('ok'))
    ).rejects.toThrow(GatewayTimeoutError);
  });
});
```

### Integration Tests

Test timeout behavior in actual handlers:

```typescript
import { describe, it, expect } from 'vitest';
import { handler } from '../query';

describe('Query Handler Timeout', () => {
  it('should return 504 when operation times out', async () => {
    const event = createMockEvent({ body: JSON.stringify({ query: 'test' }) });
    const context = createMockContext(500); // Very little time
    
    const result = await handler(event, context);
    
    expect(result.statusCode).toBe(504);
    expect(JSON.parse(result.body).error.code).toBe('GATEWAY_TIMEOUT');
  });
});
```

## Troubleshooting

### Frequent Timeouts

If you're seeing frequent timeouts:

1. **Check CloudWatch Logs**: Look for "Approaching Lambda timeout" warnings
2. **Identify Slow Operations**: Check which operations are logged before timeout
3. **Optimize or Increase Timeout**: Either optimize the slow operation or increase Lambda timeout
4. **Consider Async Processing**: Move long operations to async processing (SQS, Step Functions)

### False Positives

If timeout detection is too aggressive:

1. **Adjust Grace Period**: Increase the grace period
2. **Adjust Warning Threshold**: Increase the warning threshold
3. **Check Lambda Configuration**: Ensure timeout is set correctly in infrastructure

### Missing Timeout Handling

If timeouts aren't being caught:

1. **Verify Handler Wrapping**: Ensure handler is wrapped with `timeoutHandler.wrapHandler()`
2. **Check Error Handling**: Ensure errors are properly caught and handled
3. **Verify Infrastructure**: Confirm timeout is configured in `infra/api.ts`

## Related Documentation

- [Error Handling](./error-handling.md)
- [Monitoring and Observability](./monitoring.md)
- [Lambda Best Practices](./lambda-best-practices.md)
