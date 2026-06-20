import type { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

import { DynamoDBAdapter } from './dynamodb-adapter';

console.log(`[Auth Config] Initializing: GOOGLE_ID=${process.env.GOOGLE_CLIENT_ID ? "set" : "missing"}, GOOGLE_SECRET=${process.env.GOOGLE_CLIENT_SECRET ? "set" : "missing"}, AUTH_SECRET=${process.env.AUTH_SECRET ? "set" : "missing"}`);

const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_ID !== 'placeholder'
  ? GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  : null;

console.log(`[Auth Config] Google provider: ${googleProvider ? "enabled" : "disabled"}`);

export const authOptions: AuthOptions = {
  secret: process.env.AUTH_SECRET,
  logger: {
    error(err: any) {
      console.error('[Auth Logger] ERROR:', err);
    },
    warn(code: any) {
      console.warn('[Auth Logger] WARN:', code);
    },
    debug(code: any, metadata?: any) {
      console.log('[Auth Logger] DEBUG:', code, metadata ? JSON.stringify(metadata).slice(0, 200) : '');
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CLIENT_ID !== 'placeholder'
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const adapter = DynamoDBAdapter();
        const user = await adapter.getUserByEmail!(credentials.email);
        if (!user || !user.hashedPassword) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          image: user.image || null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[Auth] signIn callback:', JSON.stringify({ provider: account?.provider, userId: user?.id, email: user?.email }));

      // Credentials provider — already validated in authorize(), let it through
      if (account?.provider === 'credentials') {
        return true;
      }

      // OAuth providers — handle account linking manually
      if (account && profile) {
        const adapter = DynamoDBAdapter();
        const email = (profile as any).email?.toLowerCase();
        if (!email) {
          console.error('[Auth] signIn: no email in OAuth profile');
          return '/auth/signin?error=EmailRequired';
        }

        // 1. Check if account already exists
        const existingAccount = await adapter.getUserByAccount({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        if (existingAccount) {
          console.log('[Auth] signIn: account already linked to user', existingAccount.id);
          user.id = existingAccount.id;
          return true;
        }

        // 2. Check if user exists with this email
        const existingUser = await adapter.getUserByEmail(email);
        if (existingUser) {
          // Link new OAuth account to existing user
          console.log('[Auth] signIn: linking account to existing user', existingUser.id);
          await adapter.linkAccount({
            userId: existingUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: 'oauth',
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: account.session_state ?? null,
          });
          user.id = existingUser.id;
          return true;
        }

        // 3. Create new user and link account
        const newUserId = randomUUID();
        console.log('[Auth] signIn: creating new user', newUserId);
        await adapter.createUser({
          id: newUserId,
          name: (profile as any).name || user.name || null,
          email: email,
          emailVerified: null,
          image: (profile as any).picture || user.image || null,
        });
        await adapter.linkAccount({
          userId: newUserId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          type: 'oauth',
          access_token: account.access_token ?? null,
          refresh_token: account.refresh_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
          session_state: account.session_state ?? null,
        });
        user.id = newUserId;
        console.log('[Auth] signIn: new user created and linked');
        return true;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.provider = account.provider;
      }
      // Always keep user info on token
      if (user) {
        token.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken as string;
        session.idToken = token.idToken as string;
        session.provider = token.provider as string;
        if (token.user) {
          session.user = {
            ...session.user,
            ...(token.user as any),
            id: (token.user as any).id || session.user?.email || '',
          };
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(`[Auth] Sign in: ${user.email} via ${account?.provider}`);
    },
    async signOut({ token }) {
      console.log(`[Auth] Sign out: ${token.email}`);
    },
  },
};
