import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
import { jiraWorkspace } from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

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

    // Get the correct base URL for redirects
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    if (error) {
      console.error('Jira OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/integrations?error=jira_oauth_failed&details=${error}`, baseUrl)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/integrations?error=jira_oauth_no_code', baseUrl)
      );
    }

    console.log('Starting Jira OAuth token exchange...');

    // Exchange code for access token
    const tokenResponse = await JiraClient.exchangeCodeForToken(code);
    
    if (!tokenResponse.access_token) {
      throw new Error('No access token received from Jira');
    }

    console.log('Token exchange successful, fetching accessible resources...');

    // Get accessible resources (Jira sites)
    const resources = await JiraClient.getAccessibleResources(tokenResponse.access_token);
    
    if (!resources.length) {
      throw new Error('No accessible Jira resources found');
    }

    // For now, use the first resource (could be enhanced to let user choose)
    const resource = resources[0];
    
    console.log('Creating Jira client and testing connection...');
    
    // Create Jira client to test connection and get site info
    const jiraClient = new JiraClient(tokenResponse.access_token, resource.id);
    const serverInfo = await jiraClient.getServerInfo();

    console.log('Connection test successful, saving workspace...');

    // Calculate token expiration
    const expiresAt = tokenResponse.expires_in 
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Check if workspace already exists for this user and cloudId
    const existingWorkspace = await db
      .select()
      .from(jiraWorkspace)
      .where(eq(jiraWorkspace.cloudId, resource.id))
      .limit(1);

    let workspace;
    
    if (existingWorkspace.length > 0) {
      console.log('Updating existing workspace...');
      // Update existing workspace
      const updatedWorkspace = await db
        .update(jiraWorkspace)
        .set({
          name: resource.name,
          url: resource.url,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          tokenType: tokenResponse.token_type,
          scopes: tokenResponse.scope,
          userId: session.user.id as string,
          expiresAt,
          updatedAt: new Date(),
          isActive: true,
          metadata: {
            serverInfo,
            availableResources: resources,
            lastConnected: new Date().toISOString(),
          },
        })
        .where(eq(jiraWorkspace.id, existingWorkspace[0].id))
        .returning();
      
      workspace = updatedWorkspace[0];
    } else {
      console.log('Creating new workspace...');
      // Create new workspace
      const newWorkspace = await db
        .insert(jiraWorkspace)
        .values({
          cloudId: resource.id,
          name: resource.name,
          url: resource.url,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          tokenType: tokenResponse.token_type,
          scopes: tokenResponse.scope,
          userId: session.user.id as string,
          expiresAt,
          isActive: true,
          metadata: {
            serverInfo,
            availableResources: resources,
            lastConnected: new Date().toISOString(),
          },
        })
        .returning();
      
      workspace = newWorkspace[0];
    }

    console.log('Jira workspace connected successfully:', {
      workspaceId: workspace.id,
      cloudId: workspace.cloudId,
      name: workspace.name,
      url: workspace.url,
      tokenExpiry: workspace.expiresAt,
      scopes: workspace.scopes
    });

    // Redirect to integrations page with success message using proper base URL
    return NextResponse.redirect(
      new URL('/integrations?success=jira_connected', baseUrl)
    );

  } catch (error) {
    console.error('Error in Jira OAuth callback:', error);
    
    // Get the correct base URL for redirects
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const encodedError = encodeURIComponent(errorMessage);
    
    return NextResponse.redirect(
      new URL(`/integrations?error=jira_oauth_failed&details=${encodedError}`, baseUrl)
    );
  }
} 