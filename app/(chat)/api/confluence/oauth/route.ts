import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { ConfluenceClient } from '@/lib/confluence/client';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Get the correct base URL for redirects
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(new URL('/login?error=unauthorized', baseUrl));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('Confluence OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      error,
      userId: session.user.id
    });

    if (error) {
      console.error('Confluence OAuth error:', error);
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL(`/integrations?error=confluence_${error}`, baseUrl)
      );
    }

    if (!code || !state) {
      console.error('Missing code or state in Confluence OAuth callback');
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=confluence_missing_params', baseUrl)
      );
    }

    // Validate state parameter (basic validation)
    if (!state.startsWith(session.user.id)) {
      console.error('Invalid state parameter in Confluence OAuth callback');
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=confluence_invalid_state', baseUrl)
      );
    }

    console.log('Exchanging authorization code for access token...');

    // Exchange authorization code for access token
    const tokenResponse = await ConfluenceClient.exchangeCodeForToken(code);
    
    console.log('Token exchange successful:', {
      hasAccessToken: !!tokenResponse.access_token,
      hasRefreshToken: !!tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      receivedScopes: tokenResponse.scope?.split(' ') || []
    });

    // Validate that we received the required scopes
    if (!ConfluenceClient.validateScopes(tokenResponse.scope || '')) {
      console.error('❌ INSUFFICIENT SCOPES: The granted scopes are not sufficient for Confluence API access');
      console.error('Granted scopes:', tokenResponse.scope);
      console.error('This usually happens when:');
      console.error('1. The user denied some permissions during OAuth');
      console.error('2. The Confluence site has restricted permissions');
      console.error('3. The OAuth app configuration is incorrect');
      
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=confluence_insufficient_scopes', baseUrl)
      );
    }

    console.log('✅ Scope validation passed - we have the required permissions');

    // Get accessible resources (Confluence sites)
    const resources = await ConfluenceClient.getAccessibleResources(tokenResponse.access_token);
    
    console.log('Accessible Confluence resources:', {
      count: resources.length,
      sites: resources.map(r => ({ id: r.id, name: r.name, url: r.url }))
    });

    if (resources.length === 0) {
      console.error('No accessible Confluence resources found');
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=confluence_no_access', baseUrl)
      );
    }

    // Use the first accessible resource (or let user choose in the future)
    const selectedResource = resources[0];
    
    console.log('Using Confluence resource:', {
      id: selectedResource.id,
      name: selectedResource.name,
      url: selectedResource.url,
      resourceScopes: selectedResource.scopes
    });

    // Test the connection
    const confluenceClient = new ConfluenceClient(tokenResponse.access_token, selectedResource.id);
    
    console.log('Testing Confluence connection with details:', {
      tokenLength: tokenResponse.access_token?.length,
      tokenPrefix: tokenResponse.access_token?.substring(0, 20) + '...',
      cloudId: selectedResource.id,
      baseUrl: `https://api.atlassian.com/ex/confluence/${selectedResource.id}/wiki/api/v2`,
      scopes: tokenResponse.scope?.split(' ') || []
    });
    
    const connectionTest = await confluenceClient.testConnection();
    
    if (!connectionTest) {
      console.error('Confluence connection test failed');
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return NextResponse.redirect(
        new URL('/integrations?error=confluence_connection_failed', baseUrl)
      );
    }

    console.log('Confluence connection test successful');

    // Calculate token expiration
    const expiresAt = tokenResponse.expires_in 
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Check if workspace already exists
    const existingWorkspace = await db
      .select()
      .from(confluenceWorkspace)
      .where(
        and(
          eq(confluenceWorkspace.userId, session.user.id as string),
          eq(confluenceWorkspace.cloudId, selectedResource.id)
        )
      )
      .limit(1);

    if (existingWorkspace.length > 0) {
      console.log('Updating existing Confluence workspace');
      
      // Update existing workspace
      await db
        .update(confluenceWorkspace)
        .set({
          name: selectedResource.name,
          url: selectedResource.url,
          scopes: tokenResponse.scope,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(confluenceWorkspace.id, existingWorkspace[0].id));

      console.log('Confluence workspace updated successfully');
    } else {
      console.log('Creating new Confluence workspace');
      
      // Create new workspace
      await db
        .insert(confluenceWorkspace)
        .values({
          userId: session.user.id as string,
          cloudId: selectedResource.id,
          name: selectedResource.name,
          url: selectedResource.url,
          scopes: tokenResponse.scope,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
          isActive: true,
        });

      console.log('Confluence workspace created successfully');
    }

    // Redirect back to integrations page with success
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL('/integrations?success=confluence_connected', baseUrl)
    );

  } catch (error) {
    console.error('Error in Confluence OAuth callback:', error);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      new URL('/integrations?error=confluence_oauth_failed', baseUrl)
    );
  }
} 