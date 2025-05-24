import { NextRequest, NextResponse } from 'next/server';
import { SlackClient } from '@/lib/slack/client';
import { SlackDatabaseService } from '@/lib/slack/database';
import { auth } from '@/app/(auth)/auth';

export async function GET(req: NextRequest) {
  try {
    console.log('=== Slack OAuth GET Callback Started ===');
    console.log('Request URL:', req.url);
    
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('OAuth callback params:', { 
      hasCode: !!code, 
      error: error || 'none',
      state: state || 'none'
    });

    // Get the correct base URL for redirects
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    console.log('Using base URL for redirects:', baseUrl);

    if (error) {
      console.log('❌ Slack OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(error)}`, baseUrl)
      );
    }

    if (!code) {
      console.log('❌ Missing authorization code');
      return NextResponse.redirect(
        new URL('/integrations?error=missing_code', baseUrl)
      );
    }

    // Handle session vs state-based user ID (for tunnel OAuth callbacks)
    let userId: string;
    const session = await auth();
    
    if (session?.user?.id) {
      // Normal case: user has session
      userId = session.user.id;
      console.log('✅ Callback: Using authenticated user ID from session:', userId);
    } else if (state) {
      // Tunnel case: no session but we have state with user ID
      userId = state;
      console.log('✅ Callback: Using user ID from state parameter (tunnel mode):', userId);
    } else {
      console.log('❌ Callback: No session and no state - unauthorized');
      return NextResponse.redirect(
        new URL('/integrations?error=unauthorized', baseUrl)
      );
    }

    console.log('📝 Exchanging code for token...');
    // Exchange code for access token
    const oauthData = await SlackClient.exchangeCodeForToken(code);
    console.log('Token exchange result:', { 
      ok: oauthData.ok, 
      hasToken: !!oauthData.access_token,
      teamId: oauthData.team?.id || 'missing',
      teamName: oauthData.team?.name || 'missing',
      error: oauthData.error || 'none'
    });

    if (!oauthData.ok) {
      console.log('❌ Token exchange failed:', oauthData.error);
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(oauthData.error || 'OAuth failed')}`, baseUrl)
      );
    }

    console.log('🔍 Checking if workspace exists...');
    // Check if workspace already exists
    let workspace = await SlackDatabaseService.getWorkspaceByTeamId(oauthData.team.id);
    console.log('Existing workspace:', { exists: !!workspace, id: workspace?.id || 'none' });

    if (workspace) {
      console.log('🔄 Updating existing workspace token and user association...');
      // Update existing workspace with new token and correct user ID
      await SlackDatabaseService.updateWorkspaceToken(workspace.id, oauthData.access_token);
      // Also update the userId association if needed
      if (workspace.userId !== userId) {
        console.log('🔧 Updating workspace user association from', workspace.userId, 'to', userId);
        await SlackDatabaseService.updateWorkspaceUserId(workspace.id, userId);
      }
    } else {
      console.log('➕ Creating new workspace...');
      // Create new workspace
      workspace = await SlackDatabaseService.createWorkspace(userId, oauthData);
      console.log('Created workspace:', { id: workspace.id, teamName: workspace.teamName, userId: workspace.userId });
    }

    console.log('✅ OAuth flow completed successfully');
    return NextResponse.redirect(
      new URL('/integrations?success=slack_connected', baseUrl)
    );
  } catch (error) {
    console.error('❌ Slack OAuth callback error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    return NextResponse.redirect(
      new URL('/integrations?error=oauth_failed', baseUrl)
    );
  }
}

// Initiate OAuth flow
export async function POST(req: NextRequest) {
  try {
    console.log('=== Slack OAuth POST Request Started ===');
    
    const session = await auth();
    console.log('Session check:', { hasSession: !!session, hasUserId: !!session?.user?.id });
    
    if (!session?.user?.id) {
      console.log('❌ Unauthorized: No valid session');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('✅ Using authenticated user ID:', userId);

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    
    console.log('Environment variables check:', {
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
      clientIdPrefix: clientId?.substring(0, 5) || 'missing',
      redirectUri: redirectUri || 'missing'
    });
    
    if (!clientId || !redirectUri) {
      console.log('❌ Missing environment variables');
      return new NextResponse('Slack OAuth not configured', { status: 500 });
    }

    const scopes = [
      'channels:history',
      'groups:history',
      'im:history',
      'mpim:history',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read',
      'users:read',
      'users:read.email',
      'files:read',
      'team:read',
    ].join(',');

    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', userId); // Use user ID as state for security

    console.log('✅ Generated auth URL successfully');
    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('❌ Error creating OAuth URL:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 