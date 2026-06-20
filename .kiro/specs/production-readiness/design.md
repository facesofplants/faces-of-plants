# Design Document: Production Readiness

## Overview

This design document outlines the comprehensive approach to transform the Faces of Plants platform into a production-ready system. The design focuses on establishing robust testing infrastructure, implementing security best practices, optimizing performance, and creating maintainable, well-documented code that can scale to handle real-world traffic.

The transformation will be implemented incrementally, with each component designed to integrate seamlessly with the existing SST-based serverless architecture while maintaining backward compatibility where possible.

## Architecture

### High-Level Architecture Changes

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Browser    │  │  Mobile App  │  │  API Client  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway + WAF                          │
│  - Rate Limiting (100 req/min)                              │
│  - Request Validation                                       │
│  - API Versioning (/v1/*)                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Lambda Functions                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Stack:                                   │  │
│  │  1. Input Validation (Zod)                          │  │
│  │  2. Authentication (NextAuth JWT)                   │  │
│  │  3. Rate Limiting Check                             │  │
│  │  4. Cache Check                                     │  │
│  │  5. Business Logic                                  │  │
│  │  6. Error Handling                                  │  │
│  │  7. Metrics Emission                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  DynamoDB    │  │  Cache Layer │  │  Rate Limit  │     │
│  │  (Primary)   │  │  (DynamoDB)  │  │  (DynamoDB)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Providers                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     GBIF     │  │ iNaturalist  │  │     EOL      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Observability Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  CloudWatch  │  │    Alarms    │  │  Dashboards  │     │
│  │    Logs      │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Middleware-Based Request Processing**: Implement a composable middleware stack for Lambda functions to handle cross-cutting concerns (validation, auth, rate limiting) consistently.

2. **Repository Pattern for Data Access**: Encapsulate all DynamoDB operations behind repository interfaces to improve testability and maintainability.

3. **Cache-Aside Pattern**: Implement caching at the application layer with DynamoDB as the cache store, using TTL for automatic expiration.

4. **Token Bucket Rate Limiting**: Use distributed token bucket algorithm with DynamoDB for rate limiting across Lambda instances.

5. **API Versioning Strategy**: Implement URL-based versioning (/v1/, /v2/) with support for header-based version negotiation.

## Components and Interfaces

### 1. Input Validation Layer

**Purpose**: Validate all incoming requests against Zod schemas before processing.

**Interface**:
```typescript
interface ValidationMiddleware {
  validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T>;
  validateRequest(req: APIGatewayProxyEvent): Promise<ValidatedRequest>;
}

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string[];
  message: string;
  code: string;
}
```

**Schemas**:
- Query request schema
- Filter parameters schema
- Pagination schema
- Authentication token schema

### 2. Rate Limiting Service

**Purpose**: Enforce rate limits per IP address and user tier using token bucket algorithm.

**Interface**:
```typescript
interface RateLimiter {
  checkLimit(key: string, limit: number, window: number): Promise<RateLimitResult>;
  consumeToken(key: string): Promise<boolean>;
  getRemainingTokens(key: string): Promise<number>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}
```

**Implementation**:
- DynamoDB table: `rate-limits` with TTL
- Partition key: `limitKey` (IP or userId)
- Attributes: `tokens`, `lastRefill`, `ttl`

### 3. Cache Service

**Purpose**: Cache external API responses to reduce latency and costs.

**Interface**:
```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
}
```

**Cache Key Strategy**:
- Format: `provider:operation:hash(params)`
- Example: `gbif:search:a3f2c1b9`
- TTL: 3600 seconds (1 hour)

### 4. Repository Layer

**Purpose**: Encapsulate all database operations with clean interfaces.

**Interfaces**:
```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: CreateUserDto): Promise<User>;
  update(id: string, updates: Partial<User>): Promise<User>;
}

interface CacheRepository {
  get(key: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

interface RateLimitRepository {
  getLimit(key: string): Promise<RateLimitEntry | null>;
  updateLimit(entry: RateLimitEntry): Promise<void>;
}
```

### 5. Error Handling Service

**Purpose**: Provide consistent error responses and logging.

**Interface**:
```typescript
interface ErrorHandler {
  handle(error: Error, context: ErrorContext): APIGatewayProxyResult;
  logError(error: Error, context: ErrorContext): void;
}

interface ErrorContext {
  requestId: string;
  userId?: string;
  path: string;
  method: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId: string;
  };
}
```

**Error Codes**:
- `VALIDATION_ERROR`: 400
- `UNAUTHORIZED`: 401
- `FORBIDDEN`: 403
- `NOT_FOUND`: 404
- `RATE_LIMIT_EXCEEDED`: 429
- `INTERNAL_ERROR`: 500
- `SERVICE_UNAVAILABLE`: 503
- `GATEWAY_TIMEOUT`: 504

### 6. Monitoring Service

**Purpose**: Emit metrics and logs for observability.

**Interface**:
```typescript
interface MetricsService {
  recordRequest(path: string, method: string, statusCode: number, duration: number): void;
  recordCacheHit(provider: string): void;
  recordCacheMiss(provider: string): void;
  recordProviderCall(provider: string, duration: number, success: boolean): void;
  recordError(errorCode: string, path: string): void;
}

interface Logger {
  info(message: string, context: LogContext): void;
  warn(message: string, context: LogContext): void;
  error(message: string, error: Error, context: LogContext): void;
}

interface LogContext {
  requestId: string;
  userId?: string;
  operation: string;
  [key: string]: any;
}
```

## Data Models

### Rate Limit Entry
```typescript
interface RateLimitEntry {
  limitKey: string;        // PK: IP address or userId
  tokens: number;          // Remaining tokens
  lastRefill: number;      // Timestamp of last refill
  ttl: number;            // TTL for automatic cleanup
}
```

### Cache Entry
```typescript
interface CacheEntry {
  cacheKey: string;        // PK: Generated cache key
  data: string;           // JSON stringified data
  provider: string;       // Source provider
  createdAt: number;      // Creation timestamp
  ttl: number;           // TTL for automatic expiration
}
```

### API Request Log
```typescript
interface APIRequestLog {
  requestId: string;       // PK: Unique request ID
  timestamp: number;       // SK: Request timestamp
  userId?: string;        // User ID if authenticated
  ipAddress: string;      // Client IP
  path: string;          // API path
  method: string;        // HTTP method
  statusCode: number;    // Response status
  duration: number;      // Request duration in ms
  errorCode?: string;    // Error code if failed
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Input validation rejects invalid requests
*For any* API endpoint and any request body that violates the Zod schema, the system should return a 400 status code with validation errors
**Validates: Requirements 2.1, 2.2**

### Property 2: Input sanitization prevents injection
*For any* query parameter containing injection patterns (SQL, NoSQL, XSS), the sanitized output should not contain executable code patterns
**Validates: Requirements 2.3**

### Property 3: File upload validation enforces constraints
*For any* file upload, if the file type or size violates constraints, the system should reject the upload before processing
**Validates: Requirements 2.4**

### Property 4: Token validation rejects invalid tokens
*For any* authentication token with invalid signature or expired timestamp, the system should return 401 status code
**Validates: Requirements 2.5**

### Property 5: Rate limiting enforces request limits
*For any* IP address or user, when request count exceeds the configured limit within the time window, the system should return 429 status code with retry-after header
**Validates: Requirements 3.2**

### Property 6: Token bucket algorithm maintains rate limits
*For any* sequence of requests, the number of successful requests within a time window should not exceed the configured token bucket capacity
**Validates: Requirements 3.4**

### Property 7: Cache stores and retrieves data correctly
*For any* provider data fetch, if the data is cached, a subsequent identical request should return the cached data without calling the external API
**Validates: Requirements 4.1, 4.2**

### Property 8: Cache keys ensure uniqueness
*For any* two different query parameter sets, the generated cache keys should be different; for identical parameters, cache keys should be the same
**Validates: Requirements 4.4**

### Property 9: Error responses have consistent structure
*For any* error condition, the response should contain an error object with code, message, and requestId fields
**Validates: Requirements 5.1**

### Property 10: Unhandled exceptions return 500
*For any* unhandled exception in Lambda functions, the system should return 500 status code and log the stack trace
**Validates: Requirements 5.5**

### Property 11: Structured logging includes request IDs
*For any* Lambda function execution, all log entries should be valid JSON containing a requestId field for tracing
**Validates: Requirements 6.3**

### Property 12: JWT token validation works correctly
*For any* API request with a JWT token, valid tokens should be accepted and invalid tokens should be rejected with 401 status
**Validates: Requirements 7.3**

### Property 13: Authentication failures return 401
*For any* authentication failure scenario (missing token, invalid token, expired token), the system should return 401 status code
**Validates: Requirements 7.5**

### Property 14: Deprecated endpoints include warning headers
*For any* request to a deprecated API endpoint, the response should include a deprecation warning header
**Validates: Requirements 8.3**

### Property 15: API response times meet SLA
*For any* sample of 100 API requests, at least 95 requests should complete within 2 seconds
**Validates: Requirements 11.1**

## Error Handling

### Error Classification

**1. Client Errors (4xx)**
- Validation errors: Return detailed field-level errors
- Authentication errors: Return generic message (avoid leaking info)
- Authorization errors: Return minimal information
- Rate limit errors: Include retry-after information

**2. Server Errors (5xx)**
- Internal errors: Log full details, return generic message
- Provider errors: Retry with backoff, return partial results if possible
- Timeout errors: Return 504 with timeout information
- Database errors: Log and return 503

### Retry Strategy

**Exponential Backoff**:
```typescript
interface RetryConfig {
  maxRetries: 3;
  initialDelay: 1000;  // 1 second
  maxDelay: 10000;     // 10 seconds
  backoffMultiplier: 2;
}
```

**Retry Logic**:
1. First retry: Wait 1 second
2. Second retry: Wait 2 seconds
3. Third retry: Wait 4 seconds
4. After 3 failures: Return error

**Retryable Errors**:
- Network timeouts
- 5xx responses from providers
- Rate limit errors (429)
- Temporary database unavailability

**Non-Retryable Errors**:
- 4xx client errors
- Authentication failures
- Validation errors
- Permanent provider failures

### Error Logging

**Log Levels**:
- `ERROR`: Unhandled exceptions, system failures
- `WARN`: Retryable errors, degraded performance
- `INFO`: Normal operations, successful requests
- `DEBUG`: Detailed execution information

**Log Structure**:
```typescript
interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  requestId: string;
  userId?: string;
  operation: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  context: Record<string, any>;
}
```

## Testing Strategy

### Unit Testing

**Framework**: Vitest (already configured)

**Coverage Requirements**:
- Core business logic: 90%+
- Utility functions: 85%+
- Repository layer: 80%+
- Overall: 80%+

**Test Organization**:
```
packages/
  core/
    src/
      services/
        __tests__/
          validation.test.ts
          rate-limiter.test.ts
          cache.test.ts
  functions/
    api/
      __tests__/
        query.test.ts
        auth.test.ts
```

**Unit Test Examples**:
- Validation: Test schema validation with valid/invalid inputs
- Rate limiting: Test token bucket algorithm
- Cache: Test cache hit/miss scenarios
- Error handling: Test error response formatting
- Repositories: Test CRUD operations with mocked DynamoDB

### Integration Testing

**Purpose**: Test interactions between components and external services

**Test Scenarios**:
1. **API Integration**: Test full request/response cycle
2. **Database Integration**: Test actual DynamoDB operations
3. **Provider Integration**: Test external API calls (with mocks)
4. **Authentication Flow**: Test NextAuth + Cognito integration
5. **Cache Integration**: Test cache layer with DynamoDB

**Test Environment**:
- Use SST's test environment
- Mock external provider APIs
- Use DynamoDB Local for database tests
- Use test JWT tokens for authentication

### Property-Based Testing

**Framework**: fast-check (to be added)

**Configuration**: Minimum 100 iterations per property test

**Property Test Examples**:

1. **Input Validation Property**:
```typescript
// Feature: production-readiness, Property 1: Input validation rejects invalid requests
test('invalid requests are rejected', () => {
  fc.assert(
    fc.property(
      fc.record({
        query: fc.string(),
        limit: fc.integer({ min: -100, max: 0 }), // Invalid
      }),
      (invalidInput) => {
        const result = validateQueryRequest(invalidInput);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
});
```

2. **Rate Limiting Property**:
```typescript
// Feature: production-readiness, Property 6: Token bucket algorithm maintains rate limits
test('rate limiter enforces token bucket limits', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 200 }),
      async (requestCount) => {
        const limiter = new RateLimiter({ capacity: 100, refillRate: 10 });
        let allowed = 0;
        
        for (let i = 0; i < requestCount; i++) {
          const result = await limiter.checkLimit('test-key', 100, 60);
          if (result.allowed) allowed++;
        }
        
        expect(allowed).toBeLessThanOrEqual(100);
      }
    ),
    { numRuns: 100 }
  );
});
```

3. **Cache Key Uniqueness Property**:
```typescript
// Feature: production-readiness, Property 8: Cache keys ensure uniqueness
test('different queries generate different cache keys', () => {
  fc.assert(
    fc.property(
      fc.record({ query: fc.string(), limit: fc.integer() }),
      fc.record({ query: fc.string(), limit: fc.integer() }),
      (params1, params2) => {
        fc.pre(!isEqual(params1, params2)); // Only test different params
        
        const key1 = generateCacheKey('gbif', 'search', params1);
        const key2 = generateCacheKey('gbif', 'search', params2);
        
        expect(key1).not.toBe(key2);
      }
    ),
    { numRuns: 100 }
  );
});
```

4. **Error Response Structure Property**:
```typescript
// Feature: production-readiness, Property 9: Error responses have consistent structure
test('all errors return consistent structure', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant(new ValidationError('Invalid input')),
        fc.constant(new AuthenticationError('Invalid token')),
        fc.constant(new RateLimitError('Too many requests')),
        fc.constant(new Error('Unexpected error'))
      ),
      (error) => {
        const response = errorHandler.handle(error, mockContext);
        const body = JSON.parse(response.body);
        
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body.error).toHaveProperty('requestId');
      }
    ),
    { numRuns: 100 }
  );
});
```

5. **JWT Validation Property**:
```typescript
// Feature: production-readiness, Property 12: JWT token validation works correctly
test('JWT validation correctly identifies valid and invalid tokens', () => {
  fc.assert(
    fc.property(
      fc.record({
        userId: fc.string(),
        exp: fc.integer({ min: Date.now() / 1000, max: Date.now() / 1000 + 3600 }),
      }),
      (payload) => {
        const validToken = jwt.sign(payload, SECRET);
        const invalidToken = validToken + 'tampered';
        
        expect(validateToken(validToken).valid).toBe(true);
        expect(validateToken(invalidToken).valid).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});
```

### End-to-End Testing

**Purpose**: Test complete user workflows

**Test Scenarios**:
1. User registration and login
2. Search query with caching
3. Rate limit enforcement
4. Error handling and recovery
5. Multi-provider data aggregation

**Tools**:
- Playwright for browser testing
- API testing with supertest
- Smoke tests for deployment verification

### Performance Testing

**Tools**: Artillery or k6

**Test Scenarios**:
1. Load test: 1000 requests/minute for 10 minutes
2. Spike test: Sudden increase to 5000 requests/minute
3. Stress test: Gradually increase load until failure
4. Endurance test: Sustained load for 1 hour

**Metrics to Monitor**:
- Response time (p50, p95, p99)
- Error rate
- Throughput
- Lambda cold starts
- DynamoDB throttling

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
1. Set up testing infrastructure (Vitest, fast-check)
2. Implement input validation with Zod schemas
3. Create repository layer for DynamoDB
4. Set up error handling framework
5. Configure ESLint and Prettier

### Phase 2: Security & Performance (Weeks 3-4)
6. Implement rate limiting service
7. Build cache layer with DynamoDB
8. Add authentication middleware
9. Implement retry logic with exponential backoff
10. Add API versioning

### Phase 3: Observability (Week 5)
11. Set up CloudWatch metrics
12. Configure alarms and notifications
13. Implement structured logging
14. Create monitoring dashboards
15. Add health check endpoints

### Phase 4: Code Quality (Week 6)
16. Refactor large components
17. Add JSDoc documentation
18. Set up pre-commit hooks
19. Configure CI/CD pipeline
20. Generate OpenAPI specifications

### Phase 5: Testing & Validation (Weeks 7-8)
21. Write unit tests for all modules
22. Implement property-based tests
23. Create integration test suite
24. Run performance tests
25. Conduct security audit

### Phase 6: Documentation & Polish (Week 9)
26. Update architecture documentation
27. Create API documentation
28. Write deployment runbooks
29. Create troubleshooting guides
30. Final code review and cleanup

## Security Considerations

### Input Validation
- Validate all inputs against Zod schemas
- Sanitize query parameters to prevent injection
- Validate file uploads (type, size, content)
- Escape HTML in user-generated content

### Authentication & Authorization
- Use NextAuth.js for session management
- Validate JWT tokens on every request
- Implement role-based access control
- Use Cognito for AWS service access only

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper CORS policies
- Sanitize logs to remove sensitive data

### Rate Limiting
- Implement per-IP rate limiting
- Add per-user rate limiting
- Use distributed rate limiting with DynamoDB
- Return proper retry-after headers

### Secrets Management
- Use SST secrets for API keys
- Rotate secrets regularly
- Never commit secrets to version control
- Use environment-specific secrets

## Performance Optimization

### Caching Strategy
- Cache provider responses for 1 hour
- Use cache-aside pattern
- Implement cache warming for popular queries
- Monitor cache hit rates

### Database Optimization
- Use Query instead of Scan operations
- Implement proper indexes
- Use BatchGetItem for multiple items
- Enable DynamoDB auto-scaling

### Lambda Optimization
- Use provisioned concurrency for critical endpoints
- Optimize bundle size with tree-shaking
- Implement connection pooling
- Use Lambda layers for shared dependencies

### API Optimization
- Implement cursor-based pagination
- Use concurrent provider queries
- Compress responses with gzip
- Implement request coalescing

## Deployment Strategy

### Environments
- **Development**: Local SST dev environment
- **Staging**: AWS staging environment for testing
- **Production**: AWS production environment

### CI/CD Pipeline
1. **On Pull Request**:
   - Run linting and type checking
   - Run unit tests
   - Run integration tests
   - Check code coverage
   - Block merge if checks fail

2. **On Merge to Main**:
   - Run full test suite
   - Deploy to staging
   - Run smoke tests
   - Wait for manual approval
   - Deploy to production
   - Run production smoke tests

3. **On Deployment Failure**:
   - Automatically rollback
   - Send alert notifications
   - Create incident ticket

### Rollback Strategy
- Keep previous 3 versions deployed
- Implement blue-green deployment
- Use CloudFormation change sets
- Test rollback procedures regularly

## Monitoring and Alerting

### Key Metrics
- **Request Metrics**: Count, latency, error rate
- **Cache Metrics**: Hit rate, miss rate, eviction rate
- **Provider Metrics**: Call count, latency, error rate
- **Database Metrics**: Read/write capacity, throttling
- **Lambda Metrics**: Duration, cold starts, errors

### Alarms
- **Critical**: Error rate > 5%, P95 latency > 5s
- **Warning**: Error rate > 2%, P95 latency > 3s
- **Info**: Cache hit rate < 50%, Provider errors > 1%

### Dashboards
- **Overview**: System health, request volume, error rate
- **Performance**: Latency percentiles, throughput
- **Providers**: Provider health, response times
- **Costs**: Lambda invocations, DynamoDB usage

This design provides a comprehensive blueprint for transforming the Faces of Plants platform into a production-ready system with robust testing, security, performance, and observability.
