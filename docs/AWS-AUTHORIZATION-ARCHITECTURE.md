# AWS Authorization Architecture

## Question: How are AWS resources accessed without Cognito Identity Pool?

This document clarifies how AWS authorization works in the current architecture and what happens if Cognito components are removed.

## Current Architecture

### Backend (Lambda Functions) - Server-Side

**All Lambda functions use IAM roles for AWS access:**

```typescript
// Example: packages/functions/api/query.ts
const dynamoClient = new DynamoDBClient({});  // No credentials specified
```

**How it works:**
1. Lambda functions run with an **IAM execution role**
2. AWS SDK automatically uses the Lambda's IAM role credentials
3. No explicit credentials needed in code
4. SST automatically configures these IAM roles

**IAM Role Assignment (SST):**
```typescript
// In sst.config.ts or infra files
api.route("GET /query", {
  handler: "packages/functions/api/query.handler",
  permissions: [
    {
      actions: ["dynamodb:Query", "dynamodb:GetItem"],
      resources: [tableArn],
    },
  ],
});
```

SST automatically:
- Creates an IAM role for the Lambda
- Attaches policies with specified permissions
- Lambda assumes this role at runtime

### Frontend (Next.js) - Two Scenarios

#### Scenario 1: Server-Side Rendering (SSR) / API Routes

**Uses IAM roles (same as Lambda):**

```typescript
// packages/web/src/app/api/auth/change-password/route.ts
const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});
```

**How it works:**
1. Next.js API routes run on Lambda (via SST)
2. Lambda has IAM execution role
3. AWS SDK uses Lambda's IAM credentials automatically
4. No Cognito needed

#### Scenario 2: Client-Side (Browser)

**Currently uses Cognito Identity Pool (but credentials are UNUSED):**

```typescript
// packages/web/src/context/AuthContext.tsx
const cognitoCredentials = fromCognitoIdentityPool({
  client: new CognitoIdentityClient({ region: process.env.NEXT_PUBLIC_AWS_REGION }),
  identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!,
  logins: {
    'cognito-identity.amazonaws.com': cognitoData.Token,
  },
});
setCredentials(await cognitoCredentials());
```

**Critical Finding:** These credentials are **NEVER USED** anywhere in the application!

**Evidence:**
- Credentials are stored in AuthContext state
- No component ever reads or uses these credentials
- All AWS SDK calls happen server-side with IAM roles

## Where AWS Resources Are Accessed

### 1. DynamoDB Access

**All DynamoDB access happens SERVER-SIDE:**

| Location | Type | Credentials |
|----------|------|-------------|
| `packages/functions/api/query.ts` | Lambda | IAM Role |
| `packages/functions/api/collections.ts` | Lambda | IAM Role |
| `packages/functions/api/cache-admin.ts` | Lambda | IAM Role |
| `packages/web/src/app/api/auth/[...nextauth]/route.ts` | Next.js API (Lambda) | IAM Role |
| `packages/web/src/app/api/auth/change-password/route.ts` | Next.js API (Lambda) | IAM Role |
| `packages/web/src/lib/dynamodb-adapter.ts` | Next.js API (Lambda) | IAM Role |

**No client-side DynamoDB access exists!**

### 2. S3 Access

**Searching the codebase:**
- No S3Client usage found
- No file uploads to S3
- No S3 bucket access

**Conclusion:** S3 is not currently used

### 3. Other AWS Services

**Cognito Identity (only for token exchange):**
- `packages/functions/api/auth-cognito.ts` - Uses Lambda IAM role
- This endpoint can be removed (credentials are unused)

## Answer: What Happens If We Remove Cognito?

### Short Answer

**Nothing breaks!** All AWS resource access happens server-side using IAM roles.

### Detailed Breakdown

#### What Gets Removed

1. **Cognito Identity Pool** (infrastructure)
   - Currently provides temporary AWS credentials
   - These credentials are fetched but never used
   - Safe to remove

2. **Token Exchange Endpoint** (`/api/auth/cognito`)
   - Exchanges NextAuth token for Cognito credentials
   - Only called to fetch unused credentials
   - Safe to remove

3. **Credential Fetching Logic** (AuthContext)
   - Fetches and stores AWS credentials in state
   - No component consumes these credentials
   - Safe to remove

#### What Stays the Same

1. **All Lambda Functions** ✅
   - Continue using IAM execution roles
   - No code changes needed
   - Authorization unchanged

2. **All Next.js API Routes** ✅
   - Continue using Lambda IAM roles
   - No code changes needed
   - Authorization unchanged

3. **All DynamoDB Access** ✅
   - Continues working via IAM roles
   - No changes needed

4. **User Authentication** ✅
   - NextAuth.js continues working
   - JWT tokens continue working
   - No impact on auth flow

## Authorization Model

### Current Model (Server-Side Only)

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│  - No AWS SDK calls                                         │
│  - No AWS credentials                                       │
│  - Only HTTP requests to API                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Request (with JWT)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / Lambda                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Lambda Execution Role (IAM)                         │  │
│  │  - dynamodb:Query                                    │  │
│  │  - dynamodb:GetItem                                  │  │
│  │  - dynamodb:PutItem                                  │  │
│  │  - dynamodb:UpdateItem                               │  │
│  │  - dynamodb:DeleteItem                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ AWS SDK with IAM Role
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Resources                          │
│  - DynamoDB Tables                                          │
│  - (Future: S3, SQS, etc.)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Browser never talks directly to AWS services**
   - All requests go through API Gateway
   - API Gateway routes to Lambda functions
   - Lambda functions use IAM roles

2. **IAM roles provide authorization**
   - Each Lambda has specific permissions
   - Principle of least privilege
   - No credentials in code

3. **User authentication is separate from AWS authorization**
   - NextAuth handles user authentication (who you are)
   - IAM roles handle AWS authorization (what you can do)
   - JWT tokens prove user identity to API
   - API uses its own IAM role to access AWS resources

## When Would You Need Cognito Identity Pool?

Cognito Identity Pool is needed when:

### Use Case 1: Direct Client-Side AWS SDK Calls

**Example: Direct S3 Upload from Browser**
```typescript
// Browser code - would need Cognito credentials
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: cognitoCredentials,  // From Identity Pool
});

await s3Client.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'file.jpg',
  Body: fileData,
}));
```

**Why needed:**
- Browser can't use IAM roles directly
- Needs temporary credentials
- Cognito Identity Pool provides these

**Current status:** Not doing this, so not needed

### Use Case 2: Mobile Apps with AWS SDK

**Example: Mobile app accessing DynamoDB directly**
```swift
// iOS app - would need Cognito credentials
let credentialsProvider = AWSCognitoCredentialsProvider(
    regionType: .USEast1,
    identityPoolId: "us-east-1:xxx"
)
```

**Current status:** No mobile app, so not needed

### Use Case 3: Fine-Grained User-Level Permissions

**Example: User-specific S3 folders**
```typescript
// Each user can only access their own folder
// s3://bucket/users/${cognito-identity-id}/*
```

**Why needed:**
- IAM policies can use Cognito identity ID
- Provides user-level isolation
- Prevents users from accessing each other's data

**Current status:** Not needed (server-side handles authorization)

## Recommended Architecture (Without Cognito)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NextAuth Session (JWT)                              │  │
│  │  - User ID                                           │  │
│  │  - User Type (citizen/researcher/admin)              │  │
│  │  - Email                                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP + JWT Cookie
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  JWT Validation Middleware                  │
│  - Validates JWT signature                                  │
│  - Extracts user context                                    │
│  - Checks user permissions                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Validated Request + User Context
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Function                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Application Logic                                   │  │
│  │  - Check user permissions (from JWT)                 │  │
│  │  - Apply business rules                              │  │
│  │  - Access AWS resources (via IAM role)               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Lambda IAM Role                                     │  │
│  │  - DynamoDB permissions                              │  │
│  │  - S3 permissions (if needed)                        │  │
│  │  - Other AWS service permissions                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ AWS SDK with IAM Role
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Resources                          │
│  - DynamoDB (user data, cache, rate limits)                 │
│  - S3 (if needed for file storage)                          │
│  - SQS (if needed for async processing)                     │
└─────────────────────────────────────────────────────────────┘
```

### Authorization Flow

```typescript
// 1. Browser sends request with JWT
fetch('/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // JWT automatically sent via cookie
  },
  body: JSON.stringify({ query: 'species' }),
});

// 2. Middleware validates JWT
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) return new NextResponse('Unauthorized', { status: 401 });
  
  // Add user context to headers
  request.headers.set('x-user-id', token.sub);
  request.headers.set('x-user-type', token.user?.userType);
  
  return NextResponse.next();
}

// 3. Lambda handler uses user context
export async function handler(event: APIGatewayProxyEvent) {
  const userId = event.headers['x-user-id'];
  const userType = event.headers['x-user-type'];
  
  // Check permissions based on user type
  if (userType !== 'admin' && isAdminOnlyOperation) {
    return { statusCode: 403, body: 'Forbidden' };
  }
  
  // Access DynamoDB using Lambda's IAM role
  const dynamoClient = new DynamoDBClient({});  // Uses IAM role
  const result = await dynamoClient.send(new QueryCommand({
    TableName: 'users',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': { S: userId } },
  }));
  
  return { statusCode: 200, body: JSON.stringify(result) };
}
```

### Benefits of This Approach

1. **Simpler Architecture**
   - No Cognito Identity Pool needed
   - No credential exchange needed
   - Fewer moving parts

2. **Better Security**
   - No AWS credentials in browser
   - All AWS access controlled by IAM roles
   - Centralized authorization logic

3. **Easier to Maintain**
   - Less code to maintain
   - Fewer services to manage
   - Clearer separation of concerns

4. **Cost Effective**
   - No Cognito Identity Pool costs
   - No credential exchange API calls
   - Simpler infrastructure

## Migration Path

### Phase 1: Verify No Client-Side AWS SDK Usage

✅ **Already verified:**
- No client-side DynamoDB calls
- No client-side S3 calls
- All AWS SDK usage is server-side

### Phase 2: Remove Cognito Components

1. Remove credential fetching from AuthContext
2. Remove Cognito token exchange endpoint
3. Remove CognitoProvider from NextAuth
4. Update types to remove credentials

**Impact:** None - credentials were unused

### Phase 3: Remove Infrastructure (Optional)

1. Evaluate if Identity Pool is needed for future features
2. If not needed, remove from infrastructure
3. Update environment variables

**Impact:** Cost savings, simpler infrastructure

## Future Considerations

### If You Need Client-Side AWS Access Later

**Option 1: Presigned URLs (Recommended)**
```typescript
// Server generates presigned URL
const presignedUrl = await s3Client.getSignedUrl(
  new PutObjectCommand({ Bucket: 'my-bucket', Key: 'file.jpg' }),
  { expiresIn: 3600 }
);

// Client uploads directly to S3 using presigned URL
await fetch(presignedUrl, {
  method: 'PUT',
  body: fileData,
});
```

**Benefits:**
- No Cognito needed
- Server controls permissions
- Temporary, scoped access

**Option 2: Proxy Through API**
```typescript
// Client sends file to API
await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

// API uploads to S3 using IAM role
export async function handler(event) {
  const s3Client = new S3Client({});  // Uses IAM role
  await s3Client.send(new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'file.jpg',
    Body: fileData,
  }));
}
```

**Benefits:**
- No Cognito needed
- Full control over uploads
- Can validate/transform files

**Option 3: Reintroduce Cognito Identity Pool**
- Only if direct client-side AWS SDK access is required
- Only if presigned URLs or API proxy won't work
- Document why it's needed

## Conclusion

### Answer to Your Question

**"If I remove Cognito component, how do you manage authorizations to AWS resources?"**

**Answer:** Through **IAM roles attached to Lambda functions**. This is how it already works today!

**Key Points:**

1. ✅ **All AWS resource access is server-side**
   - Lambda functions use IAM execution roles
   - Next.js API routes run on Lambda (also use IAM roles)
   - No client-side AWS SDK calls exist

2. ✅ **Cognito credentials are already unused**
   - Fetched but never consumed
   - Removing them changes nothing
   - Authorization continues via IAM roles

3. ✅ **User authentication is separate from AWS authorization**
   - NextAuth handles user authentication (JWT tokens)
   - IAM roles handle AWS resource authorization
   - JWT validation middleware (Task 16) will enforce user permissions

4. ✅ **This is the recommended architecture**
   - Simpler and more secure
   - Industry best practice for serverless
   - Aligns with AWS Well-Architected Framework

### Recommendation

**Proceed with removing Cognito components** as planned. The authorization model is sound and follows AWS best practices.

The only change needed is **Task 16: Implement JWT validation middleware** to ensure proper user authentication and authorization at the API layer.
