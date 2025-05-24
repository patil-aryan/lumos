import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Skip auth for API routes and auth pages
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  // Only apply auth middleware to protected routes
  const protectedRoutes = ['/chat', '/integrations'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // In development, only protect specific routes to avoid tunneling issues
  if (isDevelopmentEnvironment && !isProtectedRoute) {
    return NextResponse.next();
  }

  // For protected routes or production, check authentication
  if (isProtectedRoute || !isDevelopmentEnvironment) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: !isDevelopmentEnvironment,
    });

    if (!token) {
      // Redirect to login for protected routes
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const isGuest = guestRegex.test(token?.email ?? '');

    // Redirect logged-in users away from auth pages
    if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
      return NextResponse.redirect(new URL('/integrations', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',
    '/integrations',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
