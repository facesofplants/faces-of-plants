import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    userType?: string;
  }

  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      firstName?: string;
      lastName?: string;
      userType?: string;
    } & User;
    accessToken?: string;
    idToken?: string;
    provider?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    provider?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      firstName?: string;
      lastName?: string;
      userType?: string;
    };
  }
}
