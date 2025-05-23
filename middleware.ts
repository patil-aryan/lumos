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

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // TEMPORARY: Bypass all auth in development to avoid tunneling issues
  // Remove this when ready for production or when using real domains
  if (isDevelopmentEnvironment) {
    return NextResponse.next();
  }

  // Skip auth for integrations and other API routes during development
  if (isDevelopmentEnvironment && (pathname.startsWith('/integrations') || pathname.startsWith('/api/slack'))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    // In development, be more permissive to avoid redirect loops with tunneling
    if (isDevelopmentEnvironment) {
      // Only redirect to guest auth from the root path to avoid loops
      if (pathname === '/') {
        try {
          // Safely encode the redirect URL
          const redirectUrl = encodeURIComponent(request.url);
          const guestAuthUrl = new URL('/api/auth/guest', request.url);
          guestAuthUrl.searchParams.set('redirectUrl', redirectUrl);
          return NextResponse.redirect(guestAuthUrl);
        } catch (urlError) {
          console.warn('URL parsing error in middleware, skipping auth:', urlError);
          return NextResponse.next();
        }
      }
      // For other paths in development, just continue without auth
      return NextResponse.next();
    }
    
    // Production behavior - more robust URL handling
    try {
      const redirectUrl = encodeURIComponent(request.url);
      const guestAuthUrl = new URL('/api/auth/guest', request.url);
      guestAuthUrl.searchParams.set('redirectUrl', redirectUrl);
      return NextResponse.redirect(guestAuthUrl);
    } catch (urlError) {
      console.error('URL parsing error in production middleware:', urlError);
      // Fallback to simple guest auth without redirect
      return NextResponse.redirect(new URL('/api/auth/guest', request.url));
    }
  }

  const isGuest = guestRegex.test(token?.email ?? '');

  if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
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
