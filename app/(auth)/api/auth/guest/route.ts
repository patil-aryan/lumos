import { signIn } from '@/app/(auth)/auth';
import { isDevelopmentEnvironment } from '@/lib/constants';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Get the current URL more safely
    const requestUrl = new URL(request.url);
    const { searchParams } = requestUrl;
    const redirectUrl = searchParams.get('redirectUrl') || '/';

    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: !isDevelopmentEnvironment,
    });

    if (token) {
      // If user is already authenticated, redirect to home
      const baseUrl = requestUrl.origin;
      return NextResponse.redirect(new URL('/', baseUrl));
    }

    // In development, always redirect to home to avoid loops
    if (isDevelopmentEnvironment) {
      return signIn('guest', { redirect: true, redirectTo: '/' });
    }

    // For production, try to use the redirect URL but fallback to home
    let safeRedirectUrl = '/';
    try {
      // Decode and validate the redirect URL
      const decodedUrl = decodeURIComponent(redirectUrl);
      // Only use it if it's a relative path or same origin
      if (decodedUrl.startsWith('/') || decodedUrl.startsWith(requestUrl.origin)) {
        safeRedirectUrl = decodedUrl;
      }
    } catch (urlError) {
      console.warn('Invalid redirect URL, using default:', urlError);
    }

    return signIn('guest', { redirect: true, redirectTo: safeRedirectUrl });
  } catch (error) {
    console.error('Error in guest auth:', error);
    // Robust fallback - construct URL manually to avoid parsing issues
    try {
      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(new URL('/', baseUrl));
    } catch (fallbackError) {
      // Ultimate fallback - just sign in without redirect
      return signIn('guest', { redirect: true, redirectTo: '/' });
    }
  }
}
