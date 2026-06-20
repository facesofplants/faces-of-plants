## Authentication and Authorization Architecture Description

This document describes the authentication and authorization architecture implemented in the Next.js project, leveraging Auth.js (formerly NextAuth.js), a custom DynamoDB adapter, and AWS Cognito Identity Pool for secure user management and AWS resource access.

### 1. Overview

The system employs a custom authentication flow where user credentials (email/password) are first verified against a DynamoDB table. Upon successful authentication, the system interacts with an AWS Cognito Identity Pool using a Developer Authenticated Identity to obtain temporary AWS credentials. These credentials are then injected into the Auth.js session, allowing the frontend to securely access AWS resources on behalf of the authenticated user.

### 2. Key Technologies and Versions

The following are the critical packages and their versions used in this implementation:

*   **SST (Infrastructure as Code):** `3.17.10`
*   **Next.js (Frontend Framework):** `^15.3.1`
*   **`next-auth` (Authentication Library):** `^4.24.11`
*   **`@auth/core` (Auth.js Core):** `^0.34.2`
*   **`amazon-cognito-identity-js` (Cognito SDK):** `^6.3.15`
*   **`aws-amplify` (AWS Frontend Library):** `^6.14.4`
*   **`@aws-sdk/client-cognito-identity` (AWS SDK for Cognito Identity):** `^3.873.0`
*   **`@aws-sdk/client-dynamodb` (AWS SDK for DynamoDB):** `^3.873.0`
*   **`@aws-sdk/lib-dynamodb` (AWS SDK for DynamoDB Document Client):** `^3.873.0`
*   **`bcryptjs` (Password Hashing):** `^3.0.2`

### 3. Auth.js Configuration (`web/pages/api/auth/[...nextauth].ts`)

This file defines the core Auth.js configuration, including providers, adapter, session strategy, events, and callbacks.

#### Providers

The system uses a `CredentialsProvider` for email/password authentication.

```typescript
// web/pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { DynamoDBAdapter } from "@/lib/auth/dynamodb-adapter";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Environment variables
const USERS_TABLE = process.env.NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME;
const LOGIN_HISTORY_TABLE = process.env.NEXT_PUBLIC_LOGIN_HISTORY_TABLE_NAME;
const REGION = process.env.AWS_REGION || 'eu-central-1';
const COGNITO_IDENTITY_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID;
const COGNITO_DEV_PROVIDER_NAME = process.env.COGNITO_DEVELOPER_PROVIDER_NAME || "hub.giuseppeserrecchia.com";

// AWS Clients
const dynamo = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dynammo);
const cognitoIdentityClient = new CognitoIdentityClient({ region: REGION });

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: {  label: "Password", type: "password" }
      },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async authorize(credentials, _req) {
        // ... (authorize function content below)
      },
    }),
  ],
  adapter: DynamoDBAdapter(),
  session: {
    strategy: "jwt" as const,
  },
  events: {
    // ... (signIn event content below)
  },
  callbacks: {
    // ... (jwt and session callbacks content below)
  },
};

export default NextAuth(authOptions);
```

#### Custom `authorize` Function

The `authorize` function within the `CredentialsProvider` performs a two-step authentication and authorization process:

1.  **DynamoDB User Verification:**
    *   It queries the `USERS_TABLE` (defined by `NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME`) using the `EmailIndex` to find the user by their email.
    *   It then uses `bcrypt.compare` to verify the provided password against the hashed password stored in DynamoDB.

2.  **Cognito Identity Pool Integration:**
    *   If DynamoDB verification is successful, it obtains a `GetOpenIdTokenForDeveloperIdentityCommand` from the Cognito Identity Pool. The `Logins` parameter is crucial here, mapping the `COGNITO_DEV_PROVIDER_NAME` (e.g., "hub.giuseppeserrecchia.com") to the `userId` from DynamoDB. This establishes the user's identity within Cognito.
    *   Subsequently, it uses `GetCredentialsForIdentityCommand` with the obtained `IdentityId` and `Token` to retrieve temporary AWS credentials (Access Key ID, Secret Key, Session Token, Expiration).
    *   These temporary AWS credentials are then returned as part of the `user` object, which Auth.js will use to populate the JWT and session.

```typescript
// authorize function snippet from web/pages/api/auth/[...nextauth].ts
async authorize(credentials, _req) {
  // Step 1: Authenticate against the local DynamoDB table
  const queryResult = await ddbDocClient.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": credentials.email.toLowerCase() },
      Limit: 1,
    })
  );

  if (!queryResult.Items || queryResult.Items.length === 0) {
    throw new Error("Invalid email or password.");
  }
  const localUser = queryResult.Items[0];

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    localUser.password
  );
  if (!passwordMatch) {
    throw new Error("Invalid email or password.");
  }

  // Step 2: Get temporary AWS credentials from Cognito Identity Pool
  if (!COGNITO_IDENTITY_POOL_ID || !COGNITO_DEV_PROVIDER_NAME) {
    throw new Error("Cognito Identity Pool not configured.");
  }

  const loginsObj = { [COGNITO_DEV_PROVIDER_NAME]: localUser.userId };
  const getOpenIdTokenCommand = new GetOpenIdTokenForDeveloperIdentityCommand({
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
    Logins: loginsObj,
  });

  let idResponse;
  try {
    idResponse = await cognitoIdentityClient.send(getOpenIdTokenCommand);
    if (!idResponse.IdentityId || !idResponse.Token) {
      throw new Error("Failed to get Cognito Identity or Token.");
    }
  } catch (err) {
    throw new Error(
      "Cognito GetOpenIdTokenForDeveloperIdentityCommand failed: " +
        (err as Error).message
    );
  }

  const loginsObj2 = { "cognito-identity.amazonaws.com": idResponse.Token };
  const getCredentialsCommand = new GetCredentialsForIdentityCommand({
    IdentityId: idResponse.IdentityId,
    Logins: loginsObj2,
  });

  let credsResponse;
  try {
    credsResponse = await cognitoIdentityClient.send(getCredentialsCommand);
    if (!credsResponse.Credentials) {
      throw new Error("Failed to get Cognito Credentials.");
    }
  } catch (err) {
    throw new Error(
      "Cognito GetCredentialsForIdentityCommand failed: " +
        (err as Error).message
    );
  }

  // Step 3: Return a composite user object for the session
  return {
    id: localUser.userId,
    email: localUser.email,
    name: localUser.name,
    awsCredentials: credsResponse.Credentials,
  };
}
```

#### Adapter

The `DynamoDBAdapter` is used to persist user, account, session, and verification token data in DynamoDB.

```typescript
// web/pages/api/auth/[...nextauth].ts
adapter: DynamoDBAdapter(),
```

#### Session Strategy

The session strategy is set to `jwt`, meaning session tokens will be signed (JWS) and stored in a cookie, rather than using database-backed sessions.

```typescript
// web/pages/api/auth/[...nextauth].ts
session: {
  strategy: "jwt" as const,
},
```

#### Events

A `signIn` event is configured to log user login history to the `LOGIN_HISTORY_TABLE`.

```typescript
// web/pages/api/auth/[...nextauth].ts
events: {
  async signIn({ user }: { user: any; account?: any; profile?: any; isNewUser?: boolean }) {
    if (user.id && user.email && LOGIN_HISTORY_TABLE) {
      const command = new PutCommand({
        TableName: LOGIN_HISTORY_TABLE,
        Item: {
          userId: user.id,
          timestamp: new Date().toISOString(),
          email: user.email,
        },
      });
      await ddbDocClient.send(command);
    }
  },
},
```

#### Callbacks

*   **`jwt` callback:**
    *   On initial sign-in, it takes the `awsCredentials` and `email` from the `user` object (returned by `authorize`) and attaches them to the JWT `token`.
    *   It also creates a `universalUserId` by hashing the user's email, providing a stable, privacy-preserving identifier.
    *   Optionally, it updates the `lastSeen` timestamp for the user in the `USERS_TABLE`.

*   **`session` callback:**
    *   It takes the `awsCredentials` and `universalUserId` from the `token` and attaches them to the `session` object, making them available on the client-side.

```typescript
// web/pages/api/auth/[...nextauth].ts
callbacks: {
  async jwt({ token, user }: { token: any; user?: any }) {
    if (user) {
      token.awsCredentials = user.awsCredentials;
      token.email = user.email;
      token.universalUserId = crypto.createHash("sha256").update(user.email.toLowerCase()).digest("hex");
    }
    if (process.env.NEXT_PUBLIC_LAST_SEEN_ENABLED === "true" && token.sub && USERS_TABLE) {
      const command = new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { PK: `USER#${token.sub}`, SK: `USER#${token.sub}` },
        UpdateExpression: "set lastSeen = :lastSeen",
        ExpressionAttributeValues: { ":lastSeen": new Date().toISOString() },
      });
      ddbDocClient.send(command);
    }
    return token;
  },
  async session({ session, token }: { session: any; token: any }) {
    if (token.awsCredentials && session.user) {
      session.awsCredentials = token.awsCredentials;
      session.user.id = token.sub;
      session.user.universalUserId = token.universalUserId;
    }
    session.accessToken = token;
    return session;
  },
}
```

### 4. Custom DynamoDB Adapter (`web/lib/auth/dynamodb-adapter.ts`)

This file implements the `Auth.js` Adapter interface, providing the necessary methods for `Auth.js` to interact with DynamoDB.

#### PK/SK Composition

The adapter uses a single-table design pattern with composite primary keys (PK and SK) to store different entity types (USER, ACCOUNT, SESSION, VERIFICATION_TOKEN).

*   `PK`: `TYPE#ID` (e.g., `USER#<userId>`)
*   `SK`: `TYPE#ID` (e.g., `USER#<userId>`)

For accounts, the PK/SK is composed of `ACCOUNT#<provider>|<providerAccountId>`.

```typescript
// web/lib/auth/dynamodb-adapter.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  Adapter,
  AdapterUser,
  AdapterSession,
  AdapterAccount,
  VerificationToken,
} from "@auth/core/adapters";

const DEFAULT_TABLE_NAME = process.env.NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME!;
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const pk = (type: string, id: string) => `${type}#${id}`;
const sk = (type: string, id: string) => `${type}#${id}`;

export function DynamoDBAdapter(tableName?: string): Adapter {
  const TableName = tableName || DEFAULT_TABLE_NAME;
  return {
    // --- User methods ---
    async createUser(user) {
      const item = { PK: pk("USER", user.id), SK: sk("USER", user.id), ...user };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      return item as AdapterUser;
    },
    async getUser(id) {
      const res = await ddb.send(
        new GetCommand({ TableName, Key: { PK: pk("USER", id), SK: sk("USER", id) } })
      );
      if (!res.Item) return null;
      const { PK, SK, ...user } = res.Item;
      return user as AdapterUser;
    },
    async getUserByEmail(email) {
      const res = await ddb.send(
        new QueryCommand({
          TableName,
          IndexName: "EmailIndex", // Uses a GSI for email lookup
          KeyConditionExpression: "email = :email",
          ExpressionAttributeValues: { ":email": email },
          Limit: 1,
        })
      );
      if (!res.Items || res.Items.length === 0) return null;
      const { PK, SK, ...user } = res.Items[0];
      return user as AdapterUser;
    },
    async updateUser(user) {
      const item = { PK: pk("USER", user.id), SK: sk("USER", user.id), ...user };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      return item as AdapterUser;
    },
    async deleteUser(id) {
      await ddb.send(
        new DeleteCommand({ TableName, Key: { PK: pk("USER", id), SK: sk("USER", id) } })
      );
    },

    // --- Account methods ---
    async linkAccount(account) {
      const item = {
        PK: pk("ACCOUNT", `${account.provider}|${account.providerAccountId}`),
        SK: sk("ACCOUNT", `${account.provider}|${account.providerAccountId}`),
        ...account,
      };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      return item;
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await ddb.send(
        new DeleteCommand({
          TableName,
          Key: {
            PK: pk("ACCOUNT", `${provider}|${providerAccountId}`),
            SK: sk("ACCOUNT", `${provider}|${providerAccountId}`),
          },
        })
      );
    },
    async getAccount(provider: string, providerAccountId: string): Promise<AdapterAccount | null> {
      const res = await ddb.send(
        new GetCommand({
          TableName,
          Key: {
            PK: pk("ACCOUNT", `${provider}|${providerAccountId}`),
            SK: sk("ACCOUNT", `${provider}|${providerAccountId}`),
          },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, ...account } = res.Item;
      return account as AdapterAccount;
    },

    // --- Session methods ---
    async createSession(session) {
      const item = {
        PK: pk("SESSION", session.sessionToken),
        SK: sk("SESSION", session.sessionToken),
        userId: session.userId,
        expires: session.expires,
        sessionToken: session.sessionToken,
      };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      const { PK, SK, ...rest } = item;
      return rest;
    },
    async getSessionAndUser(sessionToken) {
      const sessionRes = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk("SESSION", sessionToken), SK: sk("SESSION", sessionToken) },
        })
      );
      const sessionItem = sessionRes.Item;
      if (!sessionItem) return null;
      const { PK: _spk, SK: _ssk, ...session } = sessionItem;
      const userId = session.userId;
      const userRes = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk("USER", userId), SK: sk("USER", userId) },
        })
      );
      const userItem = userRes.Item;
      if (!userItem) return null;
      const { PK: _upk, SK: _usk, ...user } = userItem;
      return { session: session as AdapterSession, user: user as AdapterUser };
    },
    async updateSession(session) {
      const item = {
        PK: pk("SESSION", session.sessionToken),
        SK: sk("SESSION", session.sessionToken),
        userId: session.userId!,
        expires: session.expires!,
        sessionToken: session.sessionToken,
      };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      const { PK, SK, ...rest } = item;
      return rest;
    },
    async deleteSession(sessionToken) {
      await ddb.send(
        new DeleteCommand({
          TableName,
          Key: { PK: pk("SESSION", sessionToken), SK: sk("SESSION", sessionToken) },
        })
      );
    },

    // --- Verification Token methods ---
    async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
      const item = {
        PK: pk("VERIFICATION_TOKEN", token.identifier),
        SK: sk("VERIFICATION_TOKEN", token.token),
        ...token,
      };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      const { PK, SK, ...rest } = item;
      return rest as VerificationToken;
    },
    async useVerificationToken(params: { identifier: string; token: string }): Promise<VerificationToken | null> {
      const { identifier, token } = params;
      const res = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk("VERIFICATION_TOKEN", identifier), SK: sk("VERIFICATION_TOKEN", token) },
        })
      );
      if (!res.Item) return null;
      await ddb.send(
        new DeleteCommand({
          TableName,
          Key: { PK: pk("VERIFICATION_TOKEN", identifier), SK: sk("VERIFICATION_TOKEN", token) },
        })
      );
      const { PK, SK, ...rest } = res.Item;
      return rest as VerificationToken;
    },
  };
}
```

### 5. SST Configuration (`sst.config.ts`)

The `sst.config.ts` file defines the AWS infrastructure using SST v3 constructs.

#### Cognito Identity Pool

A `CognitoIdentityPool` is created. **Important:** The `developerProviderName` (e.g., "hub.giuseppeserrecchia.com") and `allowUnauthenticatedIdentities: true` must be manually configured in the AWS Console after deployment, as SST v3 does not directly support these properties in code.

```typescript
// sst.config.ts
import { sst } from "sst";

export default $config({
  // ... app configuration
  async run() {
    const identityPool = new sst.aws.CognitoIdentityPool("IdentityPool", {});

    // Manual AWS Console Instructions:
    // After deployment, go to AWS Console > Cognito > Identity Pools > and manually set:
    // - developerProviderName: "hub.giuseppeserrecchia.com"
    // - allowUnauthenticatedIdentities: true
    // These attributes cannot be configured via SST v3, but are required for custom login to work properly.
  },
});
```

#### Auth.js DynamoDB Table (`AuthJsTable`)

This DynamoDB table stores user, account, session, and verification token data for Auth.js. It uses a single-table design with `PK` and `SK` as the primary key.

It defines the following fields and global secondary indexes (GSIs):

*   **Fields:** `PK`, `SK`, `GSI1PK`, `GSI1SK`, `email`, `userId`, `expires`.
*   **Primary Index:** `hashKey: "PK"`, `rangeKey: "SK"`.
*   **Global Indexes:**
    *   `GSI1`: `hashKey: "GSI1PK"`, `rangeKey: "GSI1SK"` (for legacy lookup).
    *   `EmailIndex`: `hashKey: "email"` (for efficient user lookup by email).
    *   `UserSessionIndex`: `hashKey: "userId"`, `rangeKey: "expires"` (for querying user sessions, sorted by expiration).

```typescript
// sst.config.ts
const authJsTable = new sst.aws.Dynamo("AuthJsTable", {
  fields: {
    PK: "string",
    SK: "string",
    GSI1PK: "string",
    GSI1SK: "string",
    email: "string",
    userId: "string",
    expires: "string",
  },
  primaryIndex: { hashKey: "PK", rangeKey: "SK" },
  globalIndexes: {
    GSI1: { hashKey: "GSI1PK", rangeKey: "GSI1SK" },
    EmailIndex: { hashKey: "email" },
    UserSessionIndex: { hashKey: "userId", rangeKey: "expires" },
  },
});
```

#### Login History Table (`LoginHistoryTable`)

A separate DynamoDB table to store user login history.

*   **Fields:** `userId`, `timestamp`.
*   **Primary Index:** `hashKey: "userId"`, `rangeKey: "timestamp"`.

```typescript
// sst.config.ts
const loginHistoryTable = new sst.aws.Dynamo("LoginHistoryTable", {
  fields: {
    userId: "string",
    timestamp: "string",
  },
  primaryIndex: { hashKey: "userId", rangeKey: "timestamp" },
});
```

#### Next.js Site Deployment

The Next.js application is deployed using `sst.aws.Nextjs`. It's configured with a custom domain (if applicable) and environment variables are injected from the deployed SST resources.

```typescript
// sst.config.ts
const site = new sst.aws.Nextjs("Web", {
  path: "web",
  domain: customDomain
    ? {
        name: customDomain,
      }
    : undefined,
  environment: {
    NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID: identityPool.id,
    NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME: authJsTable.name,
    NEXT_PUBLIC_LOGIN_HISTORY_TABLE_NAME: loginHistoryTable.name,
    COGNITO_DEVELOPER_PROVIDER_NAME: "hub.giuseppeserrecchia.com",
    // ... other environment variables
  },
  permissions:
    // ... IAM permissions below
  ,
});
```

#### IAM Permissions

The Next.js site's underlying Lambda function is granted specific IAM permissions to interact with DynamoDB, SES, and Cognito Identity.

```typescript
// sst.config.ts
permissions: [
  {
    actions: [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:UpdateItem",
      "dynamodb:Scan",
    ],
    resources: [
      authJsTable.arn,
      authJsTable.arn.apply((arn: string) => `${arn}/index/EmailIndex`),
      loginHistoryTable.arn,
      // ... other DynamoDB table ARNs if needed
    ],
  },
  {
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: [
      "arn:aws:ses:eu-central-1:500832345195:identity/no-reply@giuseppeserrecchia.com",
      // ... other SES identities
    ],
  },
  {
    effect: "allow",
    actions: ["cognito-identity:GetOpenIdTokenForDeveloperIdentity"],
    resources: [
      "arn:aws:cognito-identity:eu-central-1:500832345195:identitypool/eu-central-1:697aad6c-91e8-4643-bbf7-aeff86192133", // Example Identity Pool ARN
      // ... other Identity Pool ARNs for different stages
    ],
  },
];
```

### 6. DynamoDB Schema

The `AuthJsTable` schema, as defined in `sst.config.ts` and used by `dynamodb-adapter.ts`, is as follows:

**Table Name:** `AuthJsTable` (resolved from `NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME`)

**Primary Key:**
*   `PK` (Partition Key): String
*   `SK` (Sort Key): String

**Attributes:**
*   `PK`: Partition key, e.g., `USER#<userId>`, `ACCOUNT#<provider>|<providerAccountId>`, `SESSION#<sessionToken>`, `VERIFICATION_TOKEN#<identifier>`.
*   `SK`: Sort key, e.g., `USER#<userId>`, `ACCOUNT#<provider>|<providerAccountId>`, `SESSION#<sessionToken>`, `VERIFICATION_TOKEN#<token>`.
*   `GSI1PK`: String (for legacy lookup)
*   `GSI1SK`: String (for legacy lookup)
*   `email`: String (for `EmailIndex` GSI)
*   `userId`: String (for `UserSessionIndex` GSI)
*   `expires`: String (for `UserSessionIndex` GSI)
*   `firstName`: String (Added for user profiles)
*   `lastName`: String (Added for user profiles)
*   Other attributes are dynamically added by Auth.js for user, account, session, and verification token objects.

**Global Secondary Indexes (GSIs):**

*   **`GSI1`**:
    *   Partition Key: `GSI1PK`
    *   Sort Key: `GSI1SK`
*   **`EmailIndex`**:
    *   Partition Key: `email`
*   **`UserSessionIndex`**:
    *   Partition Key: `userId`
    *   Sort Key: `expires`
*   **`NameIndex`**:
    *   Partition Key: `lastName`
    *   Sort Key: `firstName`

**`LoginHistoryTable` Schema:**

**Table Name:** `LoginHistoryTable` (resolved from `NEXT_PUBLIC_LOGIN_HISTORY_TABLE_NAME`)

**Primary Key:**
*   `userId` (Partition Key): String
*   `timestamp` (Sort Key): String

### 7. Reusable Code and Parametric Description for Other Projects

This architecture provides several reusable components and patterns for similar projects:

1.  **Custom DynamoDB Adapter (`web/lib/auth/dynamodb-adapter.ts`):**
    *   This adapter can be directly reused in other Auth.js projects that require DynamoDB as a database.
    *   **Parametric:** The `DynamoDBAdapter` function accepts an optional `tableName` parameter, allowing it to be used with different DynamoDB tables.
    *   **Adaptation:** Ensure your DynamoDB table schema matches the `PK`/`SK` and GSI requirements of the adapter.

2.  **Cognito Identity Pool Integration in `authorize` function:**
    *   The logic within the `authorize` function for integrating with Cognito Identity Pool (using `GetOpenIdTokenForDeveloperIdentityCommand` and `GetCredentialsForIdentityCommand`) is highly reusable.
    *   **Parametric:** You'll need to update the `COGNITO_IDENTITY_POOL_ID` and `COGNITO_DEV_PROVIDER_NAME` environment variables to match your specific Cognito setup. The `Logins` object in `GetOpenIdTokenForDeveloperIdentityCommand` should map your developer provider name to the user's unique identifier from your user store.

3.  **SST DynamoDB Table Definitions (`sst.config.ts`):**
    *   The `AuthJsTable` and `LoginHistoryTable` definitions in `sst.config.ts` can be copied and adapted.
    *   **Parametric:** Adjust table names, fields, and GSIs as needed for your project's specific data model.

4.  **IAM Permissions:**
    *   The IAM permissions defined in `sst.config.ts` for DynamoDB, SES, and Cognito Identity are a good starting point.
    *   **Adaptation:** Update resource ARNs to match your AWS account and region. Review and adjust actions based on the principle of least privilege for your application's needs.

5.  **Auth.js Callbacks (`jwt`, `session`):**
    *   The `jwt` and `session` callbacks for injecting AWS credentials and a universal user ID are reusable for scenarios where you need to pass AWS credentials or a stable user identifier to the client.
    *   **Adaptation:** Modify the structure of the `awsCredentials` or `universalUserId` as per your application's requirements.

6.  **Environment Variable Management:**
    *   The use of environment variables (e.g., `NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME`, `COGNITO_DEVELOPER_PROVIDER_NAME`) injected via SST provides a clean way to manage configuration across environments.
    *   **Parametric:** Define and inject your own environment variables as needed.

**General Steps for Reusing in a New Project:**

1.  **Set up SST:** Initialize a new SST project.
2.  **Define DynamoDB Tables:** Copy and adapt the `AuthJsTable` and `LoginHistoryTable` definitions from `sst.config.ts` to your new project's `sst.config.ts`.
3.  **Create Cognito Identity Pool:** Define a `CognitoIdentityPool` in your `sst.config.ts`. Remember the manual configuration steps for `developerProviderName` and `allowUnauthenticatedIdentities` in the AWS Console.
4.  **Copy Auth.js Configuration:** Copy `web/pages/api/auth/[...nextauth].ts` to your Next.js project's API routes.
5.  **Copy DynamoDB Adapter:** Copy `web/lib/auth/dynamodb-adapter.ts` to your project's `lib/auth` directory (or similar).
6.  **Install Dependencies:** Ensure all required `next-auth`, AWS SDK, and other dependencies are installed in your `package.json`.
7.  **Configure Environment Variables:** Ensure all necessary environment variables (e.g., `NEXT_PUBLIC_AUTHJS_DYNAMODB_TABLE_NAME`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`, `COGNITO_DEVELOPER_PROVIDER_NAME`) are correctly set in your SST environment and passed to your Next.js application.
8.  **Implement User Management Pages:** Create your sign-up, sign-in, and password management pages, integrating with Auth.js `signIn`, `signOut`, and other client-side functions.
9.  **Review IAM Permissions:** Carefully review and adjust the IAM permissions in `sst.config.ts` to grant your Next.js application the necessary access to AWS resources.
10. **Testing:** Thoroughly test the authentication and authorization flow in your new project.

This detailed description should serve as a comprehensive guide for understanding and replicating this authentication and authorization architecture in similar projects.