# Admin Dashboard 401 Error - Troubleshooting Guide

## Error

```
Error: HTTP error! status: 401
at AdminApiService.fetchWithAuth
```

## This is Actually Correct Behavior! ✅

The JWT middleware is working correctly and protecting admin routes. The 401 error means:
- ✅ Middleware is validating JWT tokens
- ✅ Middleware is checking user roles
- ✅ Middleware is blocking unauthorized access

## Why You're Getting 401

The middleware returns 401 when:
1. **Not signed in** - No JWT token in cookie
2. **Not an admin** - JWT token exists but `userType !== 'admin'`

## How to Fix

### Step 1: Check if You're Signed In

1. Open browser DevTools (F12)
2. Go to Application tab → Cookies
3. Look for `next-auth.session-token` or `__Secure-next-auth.session-token`
4. If missing → You're not signed in

**Solution**: Sign in first

### Step 2: Check Your User Type

1. While signed in, open browser console
2. Run this code:
```javascript
fetch('/api/auth/session')
  .then(r => r.json())
  .then(session => console.log('User type:', session?.user?.userType))
```

3. Check the output:
   - `"admin"` → You should have access ✅
   - `"citizen"` or `"researcher"` → You don't have admin access ❌
   - `undefined` → User type not set ❌

### Step 3: Make Yourself an Admin

If your user type is not "admin", you need to update it in DynamoDB:

#### Option A: Using AWS Console

1. Go to AWS Console → DynamoDB
2. Find your table (e.g., `faces-of-plants-dev-database-auth-js`)
3. Find your user record (PK: `USER#<your-email>`, SK: `USER#<your-email>`)
4. Edit the item
5. Add/update field: `userType` = `"admin"`
6. Save
7. Sign out and sign in again

#### Option B: Using AWS CLI

```bash
aws dynamodb update-item \
  --table-name faces-of-plants-dev-database-auth-js \
  --key '{"PK": {"S": "USER#your-email@example.com"}, "SK": {"S": "USER#your-email@example.com"}}' \
  --update-expression "SET userType = :admin" \
  --expression-attribute-values '{":admin": {"S": "admin"}}'
```

Replace `your-email@example.com` with your actual email.

#### Option C: Using Admin Setup Page (If Available)

1. Navigate to `/admin/setup`
2. Click "Become Admin" button
3. This should update your user type to admin

### Step 4: Clear Session and Sign In Again

After updating your user type in DynamoDB:

1. Sign out completely
2. Clear browser cookies
3. Sign in again
4. Your JWT token will now include `userType: "admin"`

## Verify It's Working

### Test 1: Check Session

```javascript
fetch('/api/auth/session')
  .then(r => r.json())
  .then(session => {
    console.log('Signed in:', !!session);
    console.log('User type:', session?.user?.userType);
    console.log('Is admin:', session?.user?.userType === 'admin');
  })
```

Expected output:
```
Signed in: true
User type: admin
Is admin: true
```

### Test 2: Check Admin API Access

```javascript
fetch('/api/admin/metrics')
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => console.log('Data:', data))
  .catch(err => console.error('Error:', err))
```

Expected output:
```
Status: 200
Data: { success: true, data: {...}, timestamp: "..." }
```

## Common Issues

### Issue 1: "I'm signed in but still getting 401"

**Cause**: Your JWT token was created before you became admin

**Solution**: 
1. Sign out
2. Sign in again (this creates a new JWT with updated userType)

### Issue 2: "I updated DynamoDB but still not admin"

**Cause**: JWT tokens are cached, old token still in use

**Solution**:
1. Clear all cookies
2. Close browser
3. Open browser again
4. Sign in

### Issue 3: "Session says I'm admin but still 401"

**Cause**: Middleware might not be reading the token correctly

**Solution**: Check middleware logs in terminal where Next.js is running

### Issue 4: "No users in DynamoDB"

**Cause**: You haven't signed up yet

**Solution**:
1. Go to `/auth/signin`
2. Sign up with email/password or Google
3. Then follow Step 3 above to make yourself admin

## Middleware Flow

Here's what happens when you access `/api/admin/metrics`:

```
1. Browser sends request with JWT cookie
   ↓
2. Middleware intercepts request
   ↓
3. Middleware validates JWT token
   ↓
4. Middleware checks: userType === 'admin'?
   ↓
   YES → Add user headers, allow request
   NO  → Return 401 Unauthorized ← YOU ARE HERE
```

## Debug Checklist

- [ ] I am signed in (JWT cookie exists)
- [ ] My user record exists in DynamoDB
- [ ] My user record has `userType: "admin"`
- [ ] I signed out and back in after updating userType
- [ ] Browser cookies are not corrupted
- [ ] Middleware is running (check terminal logs)
- [ ] No JavaScript errors in browser console

## Still Not Working?

### Check Middleware Logs

In your terminal where `npm run dev` is running, you should see:

```
Middleware: Accessing /api/admin/metrics
Middleware: Token exists: true
Middleware: Token userType: admin
```

If you see `Token userType: citizen` or `undefined`, that's your problem.

### Check Browser Network Tab

1. Open DevTools → Network tab
2. Try to access admin dashboard
3. Find the request to `/api/admin/metrics`
4. Check:
   - Request Headers: Should have Cookie with JWT
   - Response: Status 401
   - Response Body: Should show error message

### Manual Token Check

Run this in browser console:

```javascript
document.cookie.split(';').forEach(c => {
  if (c.includes('next-auth')) {
    console.log('Auth cookie:', c.trim());
  }
});
```

You should see a JWT token. If not, you're not signed in.

## Quick Fix for Development

If you just want to test the admin dashboard quickly:

1. Sign in with any account
2. Open DynamoDB in AWS Console
3. Find your user record
4. Set `userType` to `"admin"`
5. Sign out and sign in
6. Admin dashboard should work

## Related Documentation

- [JWT Validation Middleware](./COGNITO-REMOVAL-AND-JWT-IMPLEMENTATION.md)
- [Authentication Architecture](./AUTHENTICATION-ARCHITECTURE-AUDIT.md)
- [Admin API Fix](./archieve/ADMIN-API-FIX.md)
