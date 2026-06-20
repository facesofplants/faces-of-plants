import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const token = await getToken({
    req: request as any,
    secret: process.env.AUTH_SECRET,
  });

  // Protected API routes - require authentication
  if (path.startsWith('/api/protected')) {
    if (!token) {
      return new NextResponse(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.sub || '');
    requestHeaders.set('x-user-email', token.email || '');
    requestHeaders.set('x-user-type', token.user?.userType || 'citizen');
    requestHeaders.set('x-user-name', token.name || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/protected/:path*',
  ],
};