# Admin API 401 Error Fix

**Issue**: Admin dashboard getting 401 Unauthorized errors when calling `/api/admin/*` endpoints

**Root Cause**: JWT validation middleware (Task 16) is now correctly protecting admin API routes, but the routes weren't updated to work with the new middleware.

## What Changed

### Before (Broken)

Admin API routes had commented-out authorization checks:

```typescript
export async function GET() {
  // Check admin authorization
  // const user = await getCurrentUser(request);
  // if (user.type !== 'admin') {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  // }
  
  // ... route logic
}
```

**Problem**: No actual authorization, routes were unprotected

### After Task 16 (Middleware Added)

Middleware now protects `/api/admin/*` routes:
- Validates JWT token
- Checks user has `admin` role
- Returns 401 if not authenticated
- Returns 403 if not admin
- Adds user context to headers

**Problem**: Routes still had no `request` parameter, couldn't access user context

### Fix (Current)

Updated admin routes to accept `request` parameter and use middleware-provided context:

```typescript
export async function GET(request: NextRequest) {
  // User context validated by middleware (admin role required)
  const userId = request.headers.get('x-user-id');
  const userType = request.headers.get('x-user-type');
  
  console.log(`Admin metrics accessed by user ${userId} (${userType})`);
  
  // ... route logic
}
```

## Files Updated

1. `packages/web/src/app/api/admin/metrics/route.ts` ✅
2. `packages/web/src/app/api/admin/analytics/route.ts` ✅
3. `packages/web/src/app/api/admin/users/route.ts` ✅

## How It Works Now

```
Browser (Admin User)
  ↓
  Sends request to /api/admin/metrics
  ↓
Middleware (packages/web/src/middleware.ts)
  ↓
  1. Validates JWT token
  2. Checks userType === 'admin'
  3. Adds headers:
     - x-user-id
     - x-user-email
     - x-user-type
     - x-user-name
  ↓
Admin Route Handler
  ↓
  1. Reads user context from headers
  2. Logs access
  3. Returns data
  ↓
Browser receives response
```

## User Context Headers

The middleware adds these headers to all requests that pass authentication:

| Header | Description | Example |
|--------|-------------|---------|
| `x-user-id` | User's unique ID | `"user-123"` |
| `x-user-email` | User's email | `"admin@example.com"` |
| `x-user-type` | User's role | `"admin"`, `"citizen"`, `"researcher"` |
| `x-user-name` | User's display name | `"John Doe"` |

## Testing

### Manual Test

1. Sign in as admin user
2. Navigate to `/admin/dashboard`
3. Dashboard should load without 401 errors
4. Check browser console - no errors
5. Check server logs - should see "Admin metrics accessed by user..."

### What to Check

- ✅ No 401 errors in browser console
- ✅ Admin dashboard loads successfully
- ✅ Metrics display correctly
- ✅ User analytics display correctly
- ✅ Query analytics display correctly

## Remaining Admin Routes

These routes also need updating (if they're being used):

- `/api/admin/data-sources/health/route.ts`
- `/api/admin/api-keys/route.ts`
- `/api/admin/configuration/route.ts`
- `/api/admin/query-log/route.ts`
- `/api/admin/activity/route.ts`
- `/api/admin/user-session/route.ts`

**Pattern to follow**:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // User context validated by middleware
  const userId = request.headers.get('x-user-id');
  
  // ... your logic
}
```

## Security Notes

1. **Middleware handles all authentication** - Routes don't need to check auth
2. **Admin role is enforced** - Only users with `userType: 'admin'` can access
3. **User context is trusted** - Headers are set by middleware, not client
4. **Logging is important** - Log who accesses admin endpoints for audit trail

## Next Steps

If you encounter 401 errors on other admin routes:

1. Check if route accepts `request: NextRequest` parameter
2. Verify route reads user context from headers
3. Ensure route is under `/api/admin/*` path (protected by middleware)
4. Check user has `admin` role in database

## Related Documentation

- [JWT Validation Middleware](./COGNITO-REMOVAL-AND-JWT-IMPLEMENTATION.md)
- [Authentication Architecture](./AUTHENTICATION-ARCHITECTURE-AUDIT.md)
- [Middleware Implementation](../packages/web/src/middleware.ts)
