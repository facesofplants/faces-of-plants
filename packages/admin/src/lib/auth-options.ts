import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
        const result = await client.send(new QueryCommand({
          TableName: process.env.AUTH_JS_TABLE || 'auth-js',
          IndexName: 'EmailIndex',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: { ':email': { S: credentials.email } },
        }));

        const user = result.Items?.[0];
        if (!user) return null;

        const hashedPassword = user.password?.S;
        if (!hashedPassword) return null;

        const isValid = await bcrypt.compare(credentials.password, hashedPassword);
        if (!isValid) return null;

        const userType = user.userType?.S || 'citizen';
        if (userType !== 'admin') return null;

        return {
          id: user.userId?.S || user.PK?.S || '',
          email: user.email?.S,
          name: `${user.firstName?.S || ''} ${user.lastName?.S || ''}`.trim(),
          userType: 'admin',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userType = (user as any).userType;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userType = token.userType;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
