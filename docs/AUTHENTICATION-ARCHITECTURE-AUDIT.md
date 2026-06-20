# Authentication Architecture Audit

**Date**: December 2, 2024  
**Task**: Production Readiness - Task 15  
**Requirement**: 7.1 - Simplify authentication architecture

## Executive Summary

The current authentication architecture uses **NextAuth.js** as the primary authentication provider with three authentication methods (Credentials, Google OAuth, Cognito) and a **Cognito Identity Pool** for AWS service access. The architecture is functional but has unnecessary complexity and unused components that can be simplified.

### Key Findings

1. ✅ **NextAuth.js is properly implemented** as the primary authentication provider
2. ⚠️ **Cognito Identity Pool is configured but credentials are never used** in the application
3. ⚠️ **Multiple authentication providers** add complexity (Credentials, Google, Cognito)
4. ✅ **DynamoDB adapter is working** for session storage
5. ⚠️ **JWT strategy is used** but no JWT validation middleware exists yet

## Current Architecture

### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Authentication                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    NextAuth.js                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Credentials  │  │    Google    │  │   Cognito    │     │
│  │   Provider   │  │    OAuth     │  │   Provider   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              DynamoDB Adapter (Session Storage)             │
│  - Users Table (AUTH_JS_TABLE_NAME)                         │
│  - Session storage with JWT strategy                        │
│  - User profiles with custom fields (userType, etc.)        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Cognito Identity Pool (AWS Service Access)          │
│  - Only used for OAuth providers (Google)                   │
│  - Token exchange via /api/auth/cognito endpoint            │
│  - Credentials stored in AuthContext but NEVER USED         │
└─────────────────────────────────────────────────────────────┘
```

## Component Analysis

### 1. NextAuth.js Configuration

**Location**: `packages/web/src/app/api/auth/[...nextauth]/route.ts`

**Providers Configured**:
1. **CredentialsProvider**: Email/password authentication
   - Validates against DynamoDB users table
   - Uses bcrypt for password hashing
   - Primary authentication method for the application
   
2. **GoogleProvider**: Google OAuth
   - Configured with client ID and secret
   - Triggers Cognito token exchange
   - Used for social login
   
3. **CognitoProvider**: AWS Cognito User Pool
   - Configured but **appears to be unused**
   - No evidence of Cognito User Pool in infrastructure
   - Only Cognito Identity Pool exists

**Session Strategy**: JWT (not database sessions)

**Custom Callbacks**:
- `jwt`: Enriches token with user data from DynamoDB
- `session`: Exposes user data to client

### 2. DynamoDB Adapter

**Location**: `packages/web/src/lib/dynamodb-adapter.ts`

**Purpose**: Implements NextAuth adapter interface for DynamoDB

**Tables Used**:
- Single table design with PK/SK pattern
- Entity types: USER, ACCOUNT, SESSION, VERIFICATION_TOKEN
- EmailIndex for user lookup by email

**Status**: ✅ **Fully functional and properly implemented**

### 3. Cognito Identity Pool

**Location**: `infra/auth.ts`

**Configuration**:
- Developer-authenticated identities enabled
- Allows unauthenticated identities
- Used for AWS service access (S3, DynamoDB from client)

**Token Exchange Endpoint**: `POST /api/auth/cognito`
- Exchanges NextAuth ID token for Cognito credentials
- Only called for OAuth providers (not Credentials)

**Critical Finding**: 🚨 **Credentials are fetched but NEVER USED**

**Evidence**:
```typescript
// In AuthContext.tsx - credentials are fetched
const credentials = await cognitoCredentials();
setCredentials(await cognitoCredentials());

// But searching the entire codebase shows:
// - credentials are stored in AuthContext
// - credentials are exposed via useAuth()
// - credentials are NEVER consumed by any component
```

### 4. Frontend Authentication (AuthContext)

**Location**: `packages/web/src/context/AuthContext.tsx`

**Responsibilities**:
- Wraps NextAuth's `useSession` hook
- Maps session data to UserProfile
- Manages anonymous sessions
- Fetches AWS credentials (unused)
- Provides authentication utilities

**Issues**:
- Complex credential fetching logic that's never used
- Aggressive sign-out logic that clears all storage
- Mixes authentication with anonymous session management

### 5. Middleware

**Location**: `packages/web/src/middleware.ts`

**Current Implementation**:
```typescript
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Basic token extraction
  // No validation or authorization logic
}
```

**Status**: ⚠️ **Minimal implementation, needs JWT validation**

## Authentication Providers Analysis

### Credentials Provider (Email/Password)

**Usage**: ✅ **Primary authentication method**

**Flow**:
1. User submits email/password
2. NextAuth calls `authorize()` function
3. Looks up user in DynamoDB by email
4. Compares password with bcrypt
5. Returns user object if valid

**Status**: Fully functional

### Google OAuth Provider

**Usage**: ✅ **Used for social login**

**Flow**:
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth
3. Google returns with ID token
4. NextAuth creates session
5. AuthContext fetches Cognito credentials (unused)

**Status**: Functional but triggers unnecessary Cognito flow

### Cognito Provider

**Usage**: ❌ **Configured but not used**

**Issues**:
- No Cognito User Pool exists in infrastructure
- Only Cognito Identity Pool exists
- Provider configuration references non-existent resources
- Should be removed

## Infrastructure Analysis

### Current Infrastructure

**File**: `infra/auth.ts`

```typescript
export function createAuth() {
  const identityPool = new sst.aws.CognitoIdentityPool(
    createResourceName("auth", "identity-pool"),
    {
      developerProviders: [...],
      allowUnauthenticatedIdentities: true,
    }
  );
  return { identityPool, identityPoolId: identityPool.id };
}
```

**Resources Created**:
- Cognito Identity Pool
- Authenticated IAM role
- Unauthenticated IAM role

**Purpose**: Provide AWS credentials for client-side AWS SDK usage

**Actual Usage**: None - credentials are fetched but never used

## Simplification Opportunities

### 1. Remove Unused Cognito Components

**Impact**: High  
**Effort**: Low  
**Risk**: Low

**Actions**:
- Remove CognitoProvider from NextAuth configuration
- Remove Cognito token exchange endpoint (`/api/auth/cognito`)
- Remove credential fetching logic from AuthContext
- Remove `credentials` from AuthContext state
- Consider removing Cognito Identity Pool infrastructure (if truly unused)

**Benefits**:
- Reduces complexity
- Removes unused code
- Simplifies authentication flow
- Reduces infrastructure costs

### 2. Consolidate Authentication Providers

**Current**: 3 providers (Credentials, Google, Cognito)  
**Recommended**: 2 providers (Credentials, Google)

**Rationale**:
- Credentials provider is primary method
- Google OAuth provides social login
- Cognito provider is unused and should be removed

### 3. Implement JWT Validation Middleware

**Impact**: High  
**Effort**: Medium  
**Risk**: Low

**Current State**: Middleware exists but doesn't validate tokens

**Recommended Implementation**:
```typescript
// Validate JWT on protected routes
// Extract user context
// Enforce authorization rules
// Return 401 for invalid tokens
```

**Benefits**:
- Secures API endpoints
- Enables proper authorization
- Meets production readiness requirements

### 4. Simplify AuthContext

**Impact**: Medium  
**Effort**: Medium  
**Risk**: Medium

**Issues**:
- Mixes authentication with anonymous session management
- Complex credential fetching that's unused
- Aggressive sign-out logic may be overkill

**Recommendations**:
- Remove credential fetching logic
- Separate anonymous session management
- Simplify sign-out to use NextAuth's built-in logic
- Remove unused AWS SDK imports

### 5. Clarify Session Storage Strategy

**Current**: JWT strategy with DynamoDB adapter

**Confusion**: 
- JWT strategy means sessions are stored in tokens
- DynamoDB adapter is still used for user/account data
- This is correct but should be documented

**Recommendation**: Document that:
- Sessions use JWT (stateless)
- DynamoDB stores user profiles and accounts
- No session records in database (by design)

## Security Considerations

### Current Security Posture

✅ **Strengths**:
- Passwords hashed with bcrypt
- JWT tokens signed with secret
- HTTPS enforced
- Session strategy is stateless (JWT)

⚠️ **Weaknesses**:
- No JWT validation middleware on API routes
- No rate limiting on authentication endpoints
- No account lockout after failed attempts
- Secrets in environment variables (should use SST secrets)

### Recommendations

1. **Implement JWT validation middleware** (Task 16)
2. **Add rate limiting** to auth endpoints (already planned)
3. **Move secrets to SST secrets** (Task 41)
4. **Add account lockout** after N failed attempts
5. **Implement refresh token rotation** (NextAuth handles this)

## Migration Path

### Phase 1: Remove Unused Components (Low Risk)

1. Remove CognitoProvider from NextAuth config
2. Remove `/api/auth/cognito` endpoint
3. Remove credential fetching from AuthContext
4. Update AuthContext types to remove credentials
5. Test authentication flows

**Estimated Effort**: 2-4 hours  
**Risk**: Low - removing unused code

### Phase 2: Implement JWT Validation (Medium Risk)

1. Create JWT validation middleware
2. Apply to protected API routes
3. Extract user context from tokens
4. Test with valid/invalid tokens

**Estimated Effort**: 4-6 hours  
**Risk**: Medium - affects API security

### Phase 3: Infrastructure Cleanup (Low Risk)

1. Evaluate if Cognito Identity Pool is needed
2. If not needed, remove from infrastructure
3. Update environment variables
4. Deploy and verify

**Estimated Effort**: 2-3 hours  
**Risk**: Low - infrastructure change

### Phase 4: Documentation (Low Risk)

1. Document authentication flow
2. Create developer guide
3. Update API documentation
4. Add troubleshooting guide

**Estimated Effort**: 3-4 hours  
**Risk**: None

## Recommendations Summary

### Immediate Actions (Task 15)

1. ✅ **Document current architecture** (this document)
2. ✅ **Identify simplification opportunities** (above)
3. ⏭️ **Proceed to Task 16**: Implement JWT validation middleware

### Short-term Actions (Next Sprint)

1. Remove CognitoProvider from NextAuth
2. Remove unused Cognito token exchange endpoint
3. Simplify AuthContext by removing credential logic
4. Add comprehensive authentication tests

### Long-term Actions (Future Sprints)

1. Evaluate need for Cognito Identity Pool
2. Implement account security features (lockout, 2FA)
3. Add authentication audit logging
4. Implement refresh token rotation

## Conclusion

The current authentication architecture is **functional but over-engineered**. The primary issues are:

1. **Cognito Identity Pool credentials are fetched but never used**
2. **CognitoProvider is configured but non-functional**
3. **No JWT validation middleware exists** (security gap)
4. **AuthContext is complex** due to unused credential logic

The recommended simplification path is:
1. Remove unused Cognito components
2. Implement JWT validation middleware (Task 16)
3. Simplify AuthContext
4. Document the simplified architecture

This will result in a **simpler, more maintainable, and more secure** authentication system that meets production readiness requirements.

## Next Steps

Proceed to **Task 16: Implement JWT validation middleware** which will:
- Create middleware to validate NextAuth JWT tokens
- Extract user context from valid tokens
- Return 401 for invalid/expired tokens
- Secure API endpoints

This is the highest priority security improvement identified in this audit.
