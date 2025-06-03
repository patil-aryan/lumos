import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

const CONFLUENCE_AUTH_URL = 'https://auth.atlassian.com/authorize';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OAuth 2.0 scopes optimized for v2 API compatibility 
    const scopes = [
      // Essential v2 API scopes (granular scopes that v2 endpoints actually require)
      'read:space:confluence',               // Required for /spaces endpoint
      'read:page:confluence',                // Specifically for /v2/pages endpoint
      'read:content:confluence',             // Required for /pages and content endpoints
      'read:user:confluence',                // Required for user information
      'read:content-details:confluence',     // For detailed content access
      'read:space-details:confluence',       // For detailed space information
      
      // Additional functionality scopes
      'read:blogpost:confluence',            // For blog posts
      'read:comment:confluence',             // For comments
      'read:content.metadata:confluence',    // For content metadata
      'read:analytics.content:confluence',   // For analytics
      
      // Classic scopes for backward compatibility (optional)
      'read:confluence-content.all',         // Classic content scope 
      'read:confluence-user',                // Classic user scope
      'read:confluence-space.summary',       // Classic space scope
      
      // Additional granular scopes
      'read:watcher:confluence',
      'read:group:confluence',
      
      'offline_access'                       // For refresh tokens
    ];

    // Validate environment variables
    if (!process.env.CONFLUENCE_CLIENT_ID) {
      console.error('CONFLUENCE_CLIENT_ID is not set');
      return NextResponse.json({ error: 'Confluence client configuration missing' }, { status: 500 });
    }

    if (!process.env.CONFLUENCE_REDIRECT_URI) {
      console.error('CONFLUENCE_REDIRECT_URI is not set');
      return NextResponse.json({ error: 'Confluence redirect URI configuration missing' }, { status: 500 });
    }

    // Generate state parameter for security
    const state = `${session.user.id}-${Date.now()}`;
    
    // Construct Confluence OAuth URL
    const authUrl = new URL(CONFLUENCE_AUTH_URL);
    authUrl.searchParams.set('audience', 'api.atlassian.com');
    authUrl.searchParams.set('client_id', process.env.CONFLUENCE_CLIENT_ID);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('redirect_uri', process.env.CONFLUENCE_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('prompt', 'consent');

    console.log('Redirecting to Confluence OAuth with comprehensive scopes:', {
      totalScopes: scopes.length,
      classicScopes: scopes.filter(s => s.includes('confluence-')),
      granularScopes: scopes.filter(s => s.includes(':confluence') && !s.includes('confluence-')),
      allScopes: scopes.join(' ')
    });

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('Error initiating Confluence OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Confluence connection' },
      { status: 500 }
    );
  }
} 