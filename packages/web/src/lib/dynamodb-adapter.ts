let ready: Promise<{
  ddb: any;
  PutCommand: any;
  GetCommand: any;
  DeleteCommand: any;
  QueryCommand: any;
  TableName: string;
}> | null = null;

const pk = (type: string, id: string) => `${type}#${id}`;
const sk = (type: string, id: string) => `${type}#${id}`;

async function ensure() {
  if (!ready) {
    ready = (async () => {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const {
        DynamoDBDocumentClient,
        PutCommand,
        GetCommand,
        DeleteCommand,
        QueryCommand,
      } = await import('@aws-sdk/lib-dynamodb');
      const { defaultProvider } = await import('@aws-sdk/credential-provider-node');

      const client = new DynamoDBClient({ credentials: defaultProvider() });
      const ddb = DynamoDBDocumentClient.from(client);

      return {
        ddb,
        PutCommand,
        GetCommand,
        DeleteCommand,
        QueryCommand,
        TableName: process.env.AUTH_JS_TABLE_NAME || '',
      };
    })();
  }
  return ready;
}

async function getUserById(id: string): Promise<any> {
  const { ddb, GetCommand, TableName } = await ensure();
  const res = await ddb.send(new GetCommand({ TableName, Key: { PK: pk('USER', id), SK: sk('USER', id) } }));
  if (!res.Item) return null;
  const { PK, SK, ...user } = res.Item;
  return user;
}

export function DynamoDBAdapter(): any {
  return {
    async createUser(user: any) {
      console.log('[DynamoDB Adapter] createUser called with:', JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      try {
        const { ddb, PutCommand, TableName } = await ensure();
        console.log('[DynamoDB Adapter] createUser table:', TableName);
        const item = { PK: pk('USER', user.id), SK: sk('USER', user.id), ...user };
        await ddb.send(new PutCommand({ TableName, Item: item }));
        console.log('[DynamoDB Adapter] createUser success:', user.id);
        const { PK, SK, ...rest } = item;
        return rest;
      } catch (err) {
        console.error('[DynamoDB Adapter] createUser FAILED:', err);
        throw err;
      }
    },

    async getUser(id: string) {
      return getUserById(id);
    },

    async getUserByEmail(email: string) {
      const { ddb, QueryCommand, TableName } = await ensure();
      const res = await ddb.send(
        new QueryCommand({
          TableName,
          IndexName: 'EmailIndex',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: { ':email': email },
          Limit: 1,
        })
      );
      if (!res.Items || res.Items.length === 0) return null;
      const { PK, SK, ...user } = res.Items[0];
      return user;
    },

    async updateUser(user: any) {
      const { ddb, PutCommand, TableName } = await ensure();
      const item = { PK: pk('USER', user.id), SK: sk('USER', user.id), ...user };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      const { PK, SK, ...rest } = item;
      return rest;
    },

    async deleteUser(id: string) {
      const { ddb, DeleteCommand, TableName } = await ensure();
      await ddb.send(new DeleteCommand({ TableName, Key: { PK: pk('USER', id), SK: sk('USER', id) } }));
    },

    async linkAccount(account: any) {
      console.log('[DynamoDB Adapter] linkAccount called with:', JSON.stringify({ provider: account.provider, providerAccountId: account.providerAccountId }));
      try {
        const { ddb, PutCommand, TableName } = await ensure();
        const item = {
          PK: pk('ACCOUNT', `${account.provider}|${account.providerAccountId}`),
          SK: sk('ACCOUNT', `${account.provider}|${account.providerAccountId}`),
          ...account,
        };
        await ddb.send(new PutCommand({ TableName, Item: item }));
        console.log('[DynamoDB Adapter] linkAccount success');
        return item;
      } catch (err) {
        console.error('[DynamoDB Adapter] linkAccount FAILED:', err);
        throw err;
      }
    },

    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const { ddb, DeleteCommand, TableName } = await ensure();
      await ddb.send(
        new DeleteCommand({
          TableName,
          Key: { PK: pk('ACCOUNT', `${provider}|${providerAccountId}`), SK: sk('ACCOUNT', `${provider}|${providerAccountId}`) },
        })
      );
    },

    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const { ddb, GetCommand, TableName } = await ensure();
      const res = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk('ACCOUNT', `${provider}|${providerAccountId}`), SK: sk('ACCOUNT', `${provider}|${providerAccountId}`) },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, ...account } = res.Item;
      if (!account.userId) return null;
      return getUserById(account.userId);
    },

    async getAccount(provider: string, providerAccountId: string) {
      const { ddb, GetCommand, TableName } = await ensure();
      const res = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk('ACCOUNT', `${provider}|${providerAccountId}`), SK: sk('ACCOUNT', `${provider}|${providerAccountId}`) },
        })
      );
      if (!res.Item) return null;
      const { PK, SK, ...account } = res.Item;
      return account;
    },

    async createSession(session: any) {
      const { ddb, PutCommand, TableName } = await ensure();
      const item = { PK: pk('SESSION', session.sessionToken), SK: sk('SESSION', session.sessionToken), ...session };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      return item;
    },

    async getSessionAndUser(sessionToken: string) {
      const { ddb, GetCommand, TableName } = await ensure();
      const res = await ddb.send(
        new GetCommand({ TableName, Key: { PK: pk('SESSION', sessionToken), SK: sk('SESSION', sessionToken) } })
      );
      if (!res.Item) return null;
      const { PK, SK, ...session } = res.Item;
      const user = await getUserById(session.userId);
      if (!user) return null;
      return { session, user };
    },

    async updateSession(session: any) {
      const { ddb, GetCommand, PutCommand, TableName } = await ensure();
      const res = await ddb.send(
        new GetCommand({
          TableName,
          Key: { PK: pk('SESSION', session.sessionToken), SK: sk('SESSION', session.sessionToken) },
        })
      );
      if (!res.Item) return null;
      const updated = { ...res.Item, ...session };
      await ddb.send(new PutCommand({ TableName, Item: updated }));
      const { PK, SK, ...rest } = updated;
      return rest;
    },

    async deleteSession(sessionToken: string) {
      const { ddb, DeleteCommand, TableName } = await ensure();
      await ddb.send(
        new DeleteCommand({ TableName, Key: { PK: pk('SESSION', sessionToken), SK: sk('SESSION', sessionToken) } })
      );
    },

    async createVerificationToken(token: any) {
      const { ddb, PutCommand, TableName } = await ensure();
      const item = { PK: pk('VT', `${token.identifier}|${token.token}`), SK: sk('VT', `${token.identifier}|${token.token}`), ...token };
      await ddb.send(new PutCommand({ TableName, Item: item }));
      const { PK, SK, ...rest } = item;
      return rest;
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const { ddb, GetCommand, DeleteCommand, TableName } = await ensure();
      const res = await ddb.send(
        new GetCommand({ TableName, Key: { PK: pk('VT', `${identifier}|${token}`), SK: sk('VT', `${identifier}|${token}`) } })
      );
      if (!res.Item) return null;
      await ddb.send(
        new DeleteCommand({ TableName, Key: { PK: pk('VT', `${identifier}|${token}`), SK: sk('VT', `${identifier}|${token}`) } })
      );
      const { PK, SK, ...verificationToken } = res.Item;
      return verificationToken;
    },
  };
}
