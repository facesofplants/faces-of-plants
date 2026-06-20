# API Deprecation Policy

**Date**: December 3, 2024  
**Status**: Active

## Overview

This document outlines the deprecation policy for the Faces of Plants API. It defines how API versions are deprecated, the timeline for deprecation, and how clients are notified.

## Deprecation Process

### 1. Announcement Phase (T-6 months)

When a decision is made to deprecate an API version:

- **Release Notes**: Deprecation is announced in release notes
- **Documentation**: Migration guide is published
- **Communication**: Email notification to registered API users
- **Timeline**: Clear sunset date is established

### 2. Warning Phase (T-3 months)

Three months before the sunset date:

- **Deprecation Headers**: All responses include deprecation headers
- **Dashboard Warnings**: Admin dashboard shows deprecation warnings
- **Monitoring**: Track usage of deprecated versions
- **Support**: Provide migration assistance

### 3. Sunset Phase (T)

On the sunset date:

- **Version Removal**: Deprecated version is no longer supported
- **Error Responses**: Requests to deprecated version return 410 Gone
- **Documentation**: Archived documentation remains available
- **Redirect**: Optional redirect to current version

## Deprecation Headers

When an API version is deprecated, all responses include the following headers:

```http
HTTP/1.1 200 OK
X-API-Version: v1
Deprecation: true
Sunset: 2025-12-31
X-Deprecation-Message: API v1 is deprecated. Please plan migration to future versions.
Link: </v2/query>; rel="successor-version"
```

### Header Descriptions

| Header | Description | Example |
|--------|-------------|---------|
| `Deprecation` | Indicates the endpoint is deprecated | `true` |
| `Sunset` | Date when the version will be removed (RFC 3339) | `2025-12-31` |
| `X-Deprecation-Message` | Human-readable deprecation message | `API v1 is deprecated...` |
| `Link` | Link to successor version (RFC 8288) | `</v2/query>; rel="successor-version"` |
| `X-API-Version` | Current version being used | `v1` |

## Current Deprecation Status

### Version 1 (v1)

| Status | Announcement Date | Warning Start | Sunset Date |
|--------|------------------|---------------|-------------|
| ⚠️ Deprecated | Dec 3, 2024 | Dec 3, 2024 | Dec 31, 2025 |

**Reason**: Establishing deprecation infrastructure and testing. V1 will remain functional until v2 is released.

**Migration Path**: When v2 is released, a detailed migration guide will be provided.

**Breaking Changes in v2** (Planned):
- TBD when v2 development begins

## Client Responsibilities

### Monitoring Deprecation

Clients should:

1. **Check Response Headers**: Monitor for `Deprecation: true` header
2. **Log Warnings**: Log deprecation warnings in application logs
3. **Track Sunset Dates**: Set reminders for sunset dates
4. **Test Migration**: Test against new versions before sunset

### Example: Detecting Deprecation

```typescript
const response = await fetch('https://api.facesofplants.org/v1/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'Quercus' }),
});

// Check for deprecation
const isDeprecated = response.headers.get('Deprecation') === 'true';
if (isDeprecated) {
  const sunsetDate = response.headers.get('Sunset');
  const message = response.headers.get('X-Deprecation-Message');
  
  console.warn(`API version is deprecated!`);
  console.warn(`Sunset date: ${sunsetDate}`);
  console.warn(`Message: ${message}`);
  
  // Alert your team or log to monitoring system
}
```

## Version Support Timeline

| Version | Release | Deprecation | Sunset | Support Duration |
|---------|---------|-------------|--------|------------------|
| v1 | Dec 2024 | Dec 2024* | Dec 2025 | 12+ months |
| v2 | TBD | TBD | TBD | TBD |

*Note: v1 is marked deprecated for testing purposes but will remain fully functional.

## Backward Compatibility

### What Requires a New Version

Breaking changes that require a new API version:

- **Request Schema Changes**: Required fields added or removed
- **Response Schema Changes**: Fields removed or type changes
- **Behavior Changes**: Significant changes to endpoint behavior
- **Authentication Changes**: Changes to auth mechanisms
- **Error Response Changes**: Changes to error codes or structure

### What Doesn't Require a New Version

Non-breaking changes that can be made to existing versions:

- **Adding Optional Fields**: New optional request parameters
- **Adding Response Fields**: New fields in responses (clients should ignore unknown fields)
- **Bug Fixes**: Fixing incorrect behavior
- **Performance Improvements**: Optimizations that don't change behavior
- **Documentation Updates**: Clarifications and examples

## Exception Handling

### Emergency Deprecation

In case of security vulnerabilities or critical issues:

1. **Immediate Notification**: Email and dashboard alerts
2. **Accelerated Timeline**: May be less than 6 months
3. **Migration Support**: Dedicated support for urgent migrations
4. **Documentation**: Clear explanation of the issue and fix

### Extended Support

For enterprise clients or special circumstances:

1. **Request Process**: Submit request to API team
2. **Evaluation**: Review usage and migration complexity
3. **Agreement**: Formal support extension agreement
4. **Additional Cost**: May incur additional fees

## Best Practices

### For API Maintainers

1. **Minimize Breaking Changes**: Design APIs to be extensible
2. **Communicate Early**: Announce deprecations as early as possible
3. **Provide Tools**: Offer migration scripts and tools
4. **Monitor Usage**: Track deprecated version usage
5. **Support Migration**: Provide assistance during transition

### For API Consumers

1. **Stay Updated**: Subscribe to release notes and announcements
2. **Monitor Headers**: Check for deprecation headers in responses
3. **Plan Ahead**: Don't wait until sunset date to migrate
4. **Test Thoroughly**: Test new versions in staging before production
5. **Provide Feedback**: Report issues during migration

## Related Documentation

- [API Versioning](./API-VERSIONING.md)
- [API Reference](./api-reference.md)
- [Migration Guides](./migrations/)

## Contact

For questions about API deprecation:

- **Documentation**: https://docs.facesofplants.org
- **Support**: support@facesofplants.org
- **GitHub Issues**: https://github.com/facesofplants/issues

## Changelog

| Date | Change | Author |
|------|--------|--------|
| Dec 3, 2024 | Initial deprecation policy created | System |
| Dec 3, 2024 | v1 marked as deprecated for testing | System |
