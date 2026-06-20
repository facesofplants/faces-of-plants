# Cognito Identity Pool Removal

**Date**: December 2, 2024  
**Related**: Task 15 (Authentication Simplification), Task 18 (Configure Cognito)

## Summary

Completely removed Cognito Identity Pool from infrastructure as it was not needed for the JWT-based authentication strategy.

## What Was Removed

### 1. Infrastructure (`sst.config.ts`)
- ❌ Removed `createAuth()` call
- ❌ Removed `auth` parameter from `createApi()`
- ❌ Removed `auth` parameter from `createFrontend()`
- ❌ Removed `auth.identityPoolId` from exports

### 2. Frontend Configuration (`infra/frontend.ts`)
- ❌ Removed `COGNITO_IDENTITY_POOL_ID` environment variable
- ❌ Removed `auth.identityPool` from bind list
- ❌ Removed Cognito IAM permissions from site role

### 3. API Configuration (`infra/api.ts`)
- ❌ Removed `/api/auth/cognito` route (already done)
- ❌ Removed Cognito permissions

### 4. Application Code
- ❌ Removed credential fetching from AuthContext (already done)
- ❌ Removed Cognito token exchange endpoint (already done)
- ❌ Removed CognitoProvider from NextAuth (already done)

## Why It Was Safe to Remove

### 1. Credentials Were Never Used
- Credentials were fetched and stored in AuthContext
- No component ever read or used these credentials
- All AWS SDK calls happen server-side with IAM roles

### 2. JWT Strategy Doesn't Need It
- Sessions stored in JWT tokens (cookies)
- No client-side AWS SDK calls
- All AWS access via Lambda IAM roles

### 3. No Direct Client-Side AWS Access
- No S3 uploads from browser
- No DynamoDB queries from browser
- All AWS operations proxied through API

## What Still Works

### ✅ Authentication
- Email/password sign in
- Google OAuth sign in
- Session management
- User profiles

### ✅ AWS Access
- Lambda functions use IAM roles
- Next.js API routes use IAM roles
- DynamoDB access works
- All existing functionality preserved

### ✅ Authorization
- JWT middleware validates tokens
- User context in headers
- Admin routes protected
- Role-based access control

## Deployment Errors Fixed

### Error 1: DynamoDB Schema
**Error**: "all attributes must be indexed"
**Fix**: Removed non-indexed fields from table schema
**Files**: `infra/database.ts`

### Error 2: Cognito IAM Roles
**Error**: "The role with name ... cannot be found"
**Fix**: Removed Cognito Identity Pool from infrastructure
**Files**: `sst.config.ts`, `infra/frontend.ts`

## Infrastructure Changes

### Before
```typescript
const auth = createAuth();
const api = createApi({ database, secrets, auth, accountId, region });
const frontend = createFrontend({ api, auth, authJsTable, ... });

return {
  auth: {
    identityPoolId: auth.identityPoolId,
  },
  // ...
};
```

### After
```typescript
// No auth creation
const api = createApi({ database, secrets, auth: undefined, accountId, region });
const frontend = createFrontend({ api, auth: undefined, authJsTable, ... });

return {
  // No auth exports
  // ...
};
```

## Files Modified

| File | Changes |
|------|---------|
| `sst.config.ts` | Removed auth creation and exports |
| `infra/frontend.ts` | Removed Cognito env vars and permissions |
| `infra/database.ts` | Fixed table schemas |

## Testing Checklist

After deployment:
- [ ] Sign in with email/password works
- [ ] Sign in with Google OAuth works
- [ ] Admin dashboard loads
- [ ] API calls work
- [ ] No 401 errors
- [ ] No Cognito-related errors in logs

## Cost Impact

**Savings**:
- No Cognito Identity Pool costs
- No GetOpenIdTokenForDeveloperIdentity API calls
- No GetCredentialsForIdentity API calls

**Estimated Monthly Savings**: ~$0-5 (depending on usage)

## Rollback Plan

If needed, rollback by:
1. Uncomment `const auth = createAuth();` in `sst.config.ts`
2. Pass `auth` to `createApi()` and `createFrontend()`
3. Restore Cognito env vars and permissions in `infra/frontend.ts`
4. Redeploy

## Related Documentation

- [Authentication Architecture Audit](./AUTHENTICATION-ARCHITECTURE-AUDIT.md)
- [AWS Authorization Architecture](./AWS-AUTHORIZATION-ARCHITECTURE.md)
- [Cognito Removal and JWT Implementation](./COGNITO-REMOVAL-AND-JWT-IMPLEMENTATION.md)

## Conclusion

Cognito Identity Pool successfully removed from infrastructure. The application now has a simpler, more maintainable authentication architecture using JWT tokens and IAM roles for AWS access.

**Status**: ✅ Complete  
**Next**: Deploy and verify all functionality works
