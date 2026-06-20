# Faces of Plants – FAQ & Troubleshooting

## Table of Contents

1. [General Questions](#general-questions)
2. [Multi-Source Integration](#multi-source-integration)
3. [Deployment & Infrastructure](#deployment--infrastructure)
4. [Development & Testing](#development--testing)
5. [API Usage](#api-usage)
6. [Performance & Optimization](#performance--optimization)
7. [Troubleshooting](#troubleshooting)

---

## General Questions

### What is Faces of Plants?
Faces of Plants is a multi-source biodiversity data platform that aggregates plant information from GBIF, iNaturalist, and Encyclopedia of Life. It provides a unified API and interface for accessing global plant biodiversity data.

### What data sources are supported?
Currently supported data sources:
- **GBIF**: Scientific specimens and occurrence records (1.5+ billion records)
- **iNaturalist**: Citizen science observations with photos (50+ million observations)
- **Encyclopedia of Life**: Comprehensive species information and media

### How is data quality ensured?
- **Source Validation**: Each provider implements health checks and data validation
- **Deduplication**: Automatic removal of duplicate records across sources
- **Quality Filters**: Support for quality grades and vetted content
- **Error Handling**: Robust error handling and graceful degradation

### Is the platform free to use?
Yes, the platform is open source and free to use. However, be aware of:
- AWS infrastructure costs for hosting
- API rate limits from external data sources
- Potential costs for high-volume usage

---

## Multi-Source Integration

### How does multi-source querying work?
The platform uses a service abstraction layer that:
1. Registers data source providers
2. Orchestrates queries across multiple sources
3. Normalizes data to a unified format
4. Deduplicates results
5. Merges results based on configurable strategies

### What is the UnifiedOccurrence format?
UnifiedOccurrence is our standardized data model that normalizes records from all sources:
```typescript
interface UnifiedOccurrence {
  id: string;
  source: 'gbif' | 'inaturalist' | 'eol';
  scientificName: string;
  commonName?: string;
  taxonomy: { kingdom, phylum, class, order, family, genus, species };
  location?: { country, coordinates, etc. };
  date?: { year, month, day };
  media?: { photos, videos, sounds };
  metadata: { source-specific information };
}
```

### How do I add a new data source?
1. Implement the `DataSourceProvider` interface
2. Create a client for the new API
3. Register the provider with the service registry
4. Add transformation logic for the unified data model
5. Add tests and documentation

Example:
```typescript
class MyProvider implements DataSourceProvider {
  async search(params: SearchParams): Promise<SearchResult> {
    // Implementation
  }
  
  async healthCheck(): Promise<HealthStatus> {
    // Implementation
  }
}
```

### How are rate limits handled?
Each provider implements rate limiting based on the API specifications:
- **GBIF**: 1 req/sec, 100 req/min
- **iNaturalist**: 2 req/sec, 60 req/min
- **EOL**: 1 req/sec, 30 req/min

Rate limiting includes:
- Token bucket algorithm
- Exponential backoff on limits
- Queue management for burst requests
- Health monitoring and alerting

### Can I query specific sources only?
Yes, you can specify which sources to query:
```typescript
// Query only GBIF and iNaturalist
const results = await multiSourceSearch({
  query: 'oak',
  sources: ['gbif', 'inaturalist']
});
```

### How is data deduplication handled?
Deduplication uses multiple strategies:
1. **Exact matching**: Same scientific name, location, and date
2. **Fuzzy matching**: Similar scientific names with location proximity
3. **Metadata comparison**: Institution codes, catalog numbers
4. **Configurable thresholds**: Adjustable similarity thresholds

---

## Deployment & Infrastructure

### Why is my custom domain not resolving?
- DNS changes can take up to 30 minutes to propagate
- Ensure your Route53 A record (Alias) points to your CloudFront distribution
- For CloudFront, the ACM certificate must be in us-east-1 (N. Virginia)
- For API Gateway, the ACM certificate must be in the same region as your API (eu-central-1)
- Check that the certificate is in the "Issued" state, not "Pending validation"

### How do I set secrets for Lambda functions?
- Use `sst secret set LLM_API_KEY <value> --stage dev` (or `--stage production`)
- Do not rely on `.env` for Lambda secrets—use SST secrets for all Lambda environment variables
- For development, use `.env.local` for local testing only

### How do I rotate or update a secret?
- Run `sst secret set LLM_API_KEY <new-value> --stage <stage>`
- Redeploy your stack to update Lambda environment variables
- Verify the new secret is working with health checks

### How do I troubleshoot deployment errors?
- Run `sst logs --stage <stage>` to view Lambda and deployment logs
- Check CloudFormation events in the AWS Console for more details
- Common issues: missing secrets, handler path typos, certificate region mismatch
- Use `sst dev` for local development debugging

### How do I remove all AWS resources?
- Run `pnpm run remove --stage <stage>` to remove all resources for a stage
- Verify in AWS Console that all resources are removed
- Check for any orphaned resources (S3 buckets, CloudWatch logs)

### Can I deploy to different regions?
Yes, but consider:
- Update the region in `sst.config.ts`
- Ensure ACM certificates are in the correct region
- Be aware of API latency from different regions
- Some services may have regional availability differences

---

## Development & Testing

### How do I set up the development environment?
1. Install dependencies: `pnpm install`
2. Configure environment variables: `.env.local`
3. Start development server: `pnpm run dev`
4. Run tests: `pnpm test`
5. Check types: `pnpm run type-check`

### How do I run tests?
```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test -- --testNamePattern="ServiceRegistry"

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test -- --watch
```

### How do I add new tests?
1. Create test files in `__tests__` directories
2. Follow the existing test patterns
3. Test both success and error scenarios
4. Include integration tests for API interactions
5. Mock external API calls for unit tests

### How do I debug issues locally?
1. Use `sst dev` for local development
2. Enable debug logging: `DEBUG=true`
3. Check browser developer tools for frontend issues
4. Use `console.log` or debugger statements
5. Monitor network requests and responses

---

## API Usage

### How do I use the multi-source API?
Basic usage:
```typescript
// GET request
const response = await fetch('/api/multi-source?query=oak&limit=50');

// POST request with filters
const response = await fetch('/api/multi-source', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'oak',
    sources: ['gbif', 'inaturalist'],
    filters: { country: 'US', hasPhotos: true },
    options: { maxResults: 100, deduplication: true }
  })
});
```

### What query parameters are supported?
- `query`: Search term (required)
- `sources`: Array of source names (optional)
- `limit`: Maximum results per source (optional)
- `filters`: Object with filter criteria (optional)
- `options`: Additional options (optional)

### How do I handle API errors?
```typescript
try {
  const response = await fetch('/api/multi-source?query=oak');
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  // Process data
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

### What are the rate limits?
- Multi-source API: 100 requests per minute per IP
- Individual providers have their own limits
- Rate limiting is enforced at the provider level
- Burst requests are queued and processed

### How do I optimize API performance?
1. Use specific source filtering
2. Implement result caching
3. Use appropriate pagination
4. Filter results at the API level
5. Batch multiple queries when possible

---

## Performance & Optimization

### How can I improve query performance?
1. **Source Selection**: Query only needed sources
2. **Caching**: Implement client-side caching
3. **Pagination**: Use smaller page sizes
4. **Filtering**: Apply filters at the API level
5. **Deduplication**: Disable if not needed

### Why are some queries slow?
- **Large result sets**: Some queries return thousands of records
- **Multiple sources**: Querying all sources takes time
- **Rate limiting**: Providers have rate limits
- **Network latency**: External API calls add latency
- **Data processing**: Deduplication and transformation take time

### How do I monitor performance?
1. **Health checks**: Monitor provider health
2. **Metrics**: Track response times and error rates
3. **Logging**: Enable detailed logging
4. **Alerting**: Set up alerts for failures
5. **Profiling**: Use performance profiling tools

### What caching strategies are used?
- **Provider level**: Cache API responses
- **Service level**: Cache transformed data
- **Client level**: Cache UI data
- **CDN level**: Cache static assets
- **Database level**: Cache query results

---

## Troubleshooting

### Common Error Messages

#### "Provider not found"
**Cause**: Trying to query a provider that isn't registered
**Solution**: Check provider registration in service registry

#### "Rate limit exceeded"
**Cause**: Too many requests to a provider
**Solution**: Implement exponential backoff, reduce request frequency

#### "No results found"
**Cause**: Query returned no results from any source
**Solution**: Try broader search terms, check spelling, verify filters

#### "Invalid query parameters"
**Cause**: Malformed query parameters
**Solution**: Validate parameters, check API documentation

#### "Service unavailable"
**Cause**: External API is down or unreachable
**Solution**: Check provider health, implement fallback strategies

#### "Timeout error"
**Cause**: Request took too long to complete
**Solution**: Increase timeout, optimize queries, check network connectivity

### Provider-Specific Issues

#### GBIF Issues
- **Empty results**: Try different scientific names
- **Slow responses**: Use more specific filters
- **Rate limiting**: Respect 1 req/sec limit

#### iNaturalist Issues
- **Missing photos**: Add `photos: true` filter
- **Quality issues**: Use `quality_grade: 'research'`
- **Location issues**: Check coordinate validity

#### EOL Issues
- **Missing species**: Not all species are in EOL
- **Broken media**: Some media URLs may be invalid
- **Slow queries**: Use specific page IDs when possible

### Performance Issues

#### Slow API Responses
1. Check network connectivity
2. Monitor provider health
3. Reduce query complexity
4. Implement caching
5. Use pagination

#### High Memory Usage
1. Limit result set sizes
2. Implement streaming for large datasets
3. Clean up unused objects
4. Monitor memory usage
5. Use efficient data structures

#### Timeout Errors
1. Increase timeout settings
2. Optimize query parameters
3. Check provider status
4. Implement retries
5. Use asynchronous processing

### Debugging Steps

1. **Check Logs**: Review application and provider logs
2. **Test Individually**: Test each provider separately
3. **Validate Input**: Ensure query parameters are valid
4. **Check Health**: Monitor provider health status
5. **Network Testing**: Test network connectivity
6. **Local Testing**: Test locally vs. production

### Getting Help

#### Community Support
- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share experiences
- **Documentation**: Check comprehensive documentation
- **Examples**: Review example code and tutorials

#### Developer Resources
- **API Reference**: `/docs/api-reference.md`
- **Architecture Guide**: `/docs/architecture.md`
- **Development Guide**: `/docs/development.md`
- **Provider Documentation**: `/docs/providers/`

#### Professional Support
- **Consulting**: Available for enterprise deployments
- **Custom Development**: Custom provider implementations
- **Training**: Developer training and workshops
- **Support Contracts**: Ongoing support and maintenance

---

## Advanced Topics

### Custom Provider Development
See `/docs/development.md` for detailed instructions on creating custom providers.

### Scaling and Production Deployment
For production deployments:
1. Use appropriate AWS regions
2. Implement monitoring and alerting
3. Set up CI/CD pipelines
4. Configure backup and disaster recovery
5. Implement security best practices

### Data Privacy and Compliance
- Respect data source licenses
- Implement data retention policies
- Handle user privacy appropriately
- Comply with relevant regulations (GDPR, etc.)

### Integration with Other Systems
The platform can be integrated with:
- Research databases
- Conservation management systems
- Educational platforms
- Mobile applications
- GIS systems

---

## Where do I find more documentation?
- **Main README**: `/README.md` - Overview and quick start
- **Architecture**: `/docs/architecture.md` - System design and architecture
- **API Reference**: `/docs/api-reference.md` - Complete API documentation
- **Development Guide**: `/docs/development.md` - Developer setup and guidelines
- **Provider Documentation**: `/docs/providers/` - Provider-specific documentation
- **Infrastructure**: `sst.config.ts` - Infrastructure configuration
