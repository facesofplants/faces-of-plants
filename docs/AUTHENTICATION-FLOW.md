# Authentication Flow Documentation

## Overview

This document provides detailed authentication flows for the Faces of Plants platform, showing how users authenticate and how sessions are managed.

## Authentication Methods

The platform supports two primary authentication methods:

1. **Email/Password (Credentials Provider)**
2. **Google OAuth (Social Login)**

## Flow 1: Email/Password Authentication

### Sign Up Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant DynamoDB
    
    User->>Browser: Enter email/password
    Browser->>NextAuth: POST /api/auth/signup
    NextAuth->>DynamoDB: Check if user exists
    alt User exists
        DynamoDB-->>NextAuth: User found
        NextAuth-->>Browser: Error: User exists
        Browser-->>User: Show error
    else User doesn't exist
        DynamoDB-->>NextAuth: User not found
        NextAuth->>NextAuth: Hash password (bcrypt)
        NextAuth->>DynamoDB: Create user record
        DynamoDB-->>NextAuth: User created
        NextAuth->>NextAuth: Generate JWT
        NextAuth-->>Browser: Set session cookie
        Browser-->>User: Redirect to setup
    end
```

### Sign In Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant DynamoDB
    
    User->>Browser: Enter email/password
    Browser->>NextAuth: POST /api/auth/signin (credentials)
    NextAuth->>DynamoDB: Query user by email
    alt User not found
        DynamoDB-->>NextAuth: No user
        NextAuth-->>Browser: Error: Invalid credentials
        Browser-->>User: Show error
    else User found
        DynamoDB-->>NextAuth: Return user + hashedPassword
        NextAuth->>NextAuth: Compare password (bcrypt)
        alt Password invalid
            NextAuth-->>Browser: Error: Invalid credentials
            Browser-->>User: Show error
        else Password valid
            NextAuth->>NextAuth: Generate JWT token
            NextAuth->>NextAuth: Enrich token with user data
            NextAuth-->>Browser: Set session cookie (JWT)
            Browser->>Browser: Store session in memory
            Browser-->>User: Redirect to dashboard
        end
    end
```

### Session Validation Flow

```mermaid
sequenceDiagram
    participant Browser
    participant NextAuth
    participant API
    
    Browser->>NextAuth: useSession() hook
    NextAuth->>NextAuth: Read JWT from cookie
    alt JWT valid
        NextAuth->>NextAuth: Decode JWT
        NextAuth-->>Browser: Return session data
        Browser->>API: API request + JWT cookie
        API->>API: Validate JWT (TODO: Task 16)
        API-->>Browser: Protected resource
    else JWT invalid/expired
        NextAuth-->>Browser: Return null session
        Browser->>Browser: Redirect to signin
    end
```

## Flow 2: Google OAuth Authentication

### OAuth Sign In Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant Google
    participant DynamoDB
    participant Cognito
    
    User->>Browser: Click "Sign in with Google"
    Browser->>NextAuth: Initiate OAuth flow
    NextAuth->>Google: Redirect to Google OAuth
    User->>Google: Authorize application
    Google-->>NextAuth: Return with ID token
    NextAuth->>DynamoDB: Check if user exists
    alt User exists
        DynamoDB-->>NextAuth: Return user
    else New user
        NextAuth->>DynamoDB: Create user account
        DynamoDB-->>NextAuth: User created
    end
    NextAuth->>NextAuth: Generate JWT session
    NextAuth-->>Browser: Set session cookie
    
    Note over Browser,Cognito: UNUSED: Cognito credential exchange
    Browser->>NextAuth: POST /api/auth/cognito
    NextAuth->>Cognito: Exchange token
    Cognito-->>NextAuth: AWS credentials
    NextAuth-->>Browser: Return credentials
    Browser->>Browser: Store credentials (NEVER USED)
    
    Browser-->>User: Redirect to dashboard
```

### Key Observations

1. **Cognito credentials are fetched but never used** - This is unnecessary complexity
2. **Only OAuth providers trigger Cognito flow** - Credentials provider skips this
3. **AWS credentials are stored in AuthContext** but no component consumes them

## Session Management

### JWT Token Structure

```typescript
{
  // Standard JWT claims
  iat: 1234567890,        // Issued at
  exp: 1234567890,        // Expires at
  jti: "unique-id",       // JWT ID
  
  // NextAuth claims
  name: "John Doe",
  email: "john@example.com",
  picture: "https://...",
  sub: "user-id",         // Subject (user ID)
  
  // Custom claims
  user: {
    id: "user-id",
    email: "john@example.com",
    name: "John Doe",
    firstName: "John",
    lastName: "Doe",
    userType: "citizen",  // or "researcher", "admin"
  },
  
  // Provider-specific (OAuth only)
  accessToken: "...",     // Provider access token
  idToken: "...",         // Provider ID token
  provider: "google",     // Provider name
}
```

### Session Storage Strategy

**Strategy**: JWT (Stateless)

**Storage Locations**:
- **Cookie**: HTTP-only, secure, same-site
- **Client Memory**: Via `useSession()` hook
- **NOT in Database**: Sessions are not persisted (by design)

**DynamoDB Usage**:
- User profiles (PK: USER#email, SK: USER#email)
- OAuth accounts (PK: ACCOUNT#provider|id, SK: ACCOUNT#provider|id)
- Verification tokens (for email verification)
- **NOT sessions** (JWT strategy is stateless)

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> Authenticating: Sign in
    Authenticating --> Authenticated: Success
    Authenticating --> Unauthenticated: Failure
    Authenticated --> Authenticated: Token refresh
    Authenticated --> Unauthenticated: Sign out
    Authenticated --> Unauthenticated: Token expired
```

### Token Refresh

NextAuth automatically handles token refresh:
- Tokens are refreshed before expiration
- Refresh happens transparently via `useSession()`
- No manual refresh logic needed

## Authorization Flow (Current State)

### Frontend Authorization

```typescript
// Using useAuth hook
const { user, userType, isAuthenticated } = useAuth();

// Check authentication
if (!isAuthenticated) {
  router.push('/auth/signin');
}

// Check user type
if (userType !== 'admin') {
  return <div>Access denied</div>;
}
```

### Backend Authorization (TODO: Task 16)

**Current State**: ❌ No JWT validation on API routes

**Required Implementation**:
```typescript
// Middleware to validate JWT
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // Extract user context
  request.headers.set('x-user-id', token.sub);
  request.headers.set('x-user-type', token.user?.userType);
  
  return NextResponse.next();
}
```

## Anonymous Session Flow

For unauthenticated users, the platform provides limited functionality:

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant LocalStorage
    
    User->>Browser: Visit site (not signed in)
    Browser->>LocalStorage: Check for anonymous session
    alt Session exists
        LocalStorage-->>Browser: Return session
        Browser->>Browser: Check usage limits
    else No session
        Browser->>Browser: Create anonymous session
        Browser->>LocalStorage: Store session
    end
    
    User->>Browser: Perform action (search/map)
    Browser->>Browser: Increment usage counter
    Browser->>LocalStorage: Update session
    
    alt Limit reached
        Browser-->>User: Show upgrade prompt
    else Within limits
        Browser-->>User: Allow action
    end
```

### Anonymous Session Structure

```typescript
{
  sessionId: "anon_1234567890_abc123",
  startTime: "2024-12-02T10:00:00Z",
  searchCount: 5,
  mapInteractions: 20,
  lastActivity: "2024-12-02T10:30:00Z",
  usageLimits: {
    maxSearches: 10,
    maxMapInteractions: 50,
  }
}
```

## Sign Out Flow

### Current Implementation (Aggressive)

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    participant Storage
    
    User->>Browser: Click sign out
    Browser->>NextAuth: signOut({ redirect: false })
    NextAuth->>NextAuth: Invalidate JWT
    NextAuth-->>Browser: Sign out complete
    
    Browser->>Storage: Clear sessionStorage
    Browser->>Storage: Clear localStorage
    Browser->>Storage: Clear IndexedDB
    Browser->>Storage: Clear service workers
    Browser->>Storage: Clear auth cookies
    Storage-->>Browser: All cleared
    
    Browser->>Browser: Force page reload
    Browser-->>User: Redirect to home
```

### Recommended Implementation (Simplified)

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextAuth
    
    User->>Browser: Click sign out
    Browser->>NextAuth: signOut({ callbackUrl: '/' })
    NextAuth->>NextAuth: Invalidate JWT
    NextAuth->>Browser: Clear session cookie
    NextAuth-->>Browser: Redirect to home
    Browser-->>User: Show home page
```

**Rationale**: NextAuth's built-in sign out is sufficient. Aggressive clearing is overkill and may cause issues.

## Security Considerations

### Current Security Measures

✅ **Implemented**:
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens signed with secret
- HTTP-only cookies (prevents XSS)
- Secure cookies (HTTPS only)
- Same-site cookies (prevents CSRF)

⚠️ **Missing** (To be implemented):
- JWT validation middleware on API routes (Task 16)
- Rate limiting on auth endpoints (Task 5)
- Account lockout after failed attempts
- Password strength requirements
- Email verification
- Two-factor authentication

### Token Security

**JWT Secret**: Stored in `AUTH_SECRET` environment variable
- Should be moved to SST secrets (Task 41)
- Must be at least 32 characters
- Should be different per environment

**Token Expiration**:
- Default: 30 days
- Configurable via NextAuth options
- Automatically refreshed by NextAuth

## Error Handling

### Authentication Errors

| Error Code | Meaning | User Message |
|------------|---------|--------------|
| `UserNotFound` | Email not in database | "Wrong email or password" |
| `InvalidCredentials` | Password doesn't match | "Wrong email or password" |
| `AuthenticationFailed` | General auth error | "Authentication failed" |
| `OAuthError` | OAuth provider error | "Sign in with Google failed" |

**Note**: Generic error messages prevent user enumeration attacks

### Session Errors

| Scenario | Behavior |
|----------|----------|
| JWT expired | Redirect to sign in |
| JWT invalid | Redirect to sign in |
| JWT missing | Allow anonymous access |
| Refresh failed | Sign out user |

## Testing Authentication

### Manual Testing Checklist

- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Sign out
- [ ] Access protected route while signed out
- [ ] Access protected route while signed in
- [ ] Token expiration handling
- [ ] Refresh token flow
- [ ] Anonymous session creation
- [ ] Anonymous usage limits

### Automated Testing (TODO)

```typescript
// Unit tests
- JWT token generation
- Password hashing/comparison
- User lookup by email
- Session validation

// Integration tests
- Full sign up flow
- Full sign in flow
- OAuth flow
- Sign out flow
- Protected route access

// Property-based tests (Task 16)
- JWT validation with random tokens
- Authentication failures return 401
```

## Troubleshooting

### Common Issues

**Issue**: "Session not found"
- **Cause**: JWT expired or invalid
- **Solution**: Sign in again

**Issue**: "Unauthorized" on API calls
- **Cause**: No JWT validation middleware (Task 16 not complete)
- **Solution**: Implement JWT validation middleware

**Issue**: "Cognito credentials error"
- **Cause**: Cognito token exchange failing
- **Solution**: This is unused code, can be removed

**Issue**: "User not found" after OAuth
- **Cause**: User creation failed
- **Solution**: Check DynamoDB permissions

## Next Steps

Based on this authentication flow analysis, the next tasks are:

1. **Task 16**: Implement JWT validation middleware
   - Validate tokens on API routes
   - Extract user context
   - Return 401 for invalid tokens

2. **Remove unused Cognito code**:
   - Remove CognitoProvider
   - Remove `/api/auth/cognito` endpoint
   - Remove credential fetching from AuthContext

3. **Simplify AuthContext**:
   - Remove credential state
   - Simplify sign out logic
   - Separate anonymous session management

4. **Add authentication tests**:
   - Unit tests for auth functions
   - Integration tests for auth flows
   - Property tests for JWT validation

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
