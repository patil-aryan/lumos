import { NextRequest, NextResponse } from 'next/server';
import { SlackClient } from '@/lib/slack/client';
import { SlackDatabaseService } from '@/lib/slack/database';
import { auth } from '@/app/(auth)/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return new NextResponse('Missing authorization code', { status: 400 });
    }

    // Exchange code for access token
    const oauthData = await SlackClient.exchangeCodeForToken(code);

    if (!oauthData.ok) {
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(oauthData.error || 'OAuth failed')}`, req.url)
      );
    }

    // Check if workspace already exists
    let workspace = await SlackDatabaseService.getWorkspaceByTeamId(oauthData.team.id);

    if (workspace) {
      // Update existing workspace with new token
      await SlackDatabaseService.updateWorkspaceToken(workspace.id, oauthData.access_token);
    } else {
      // Create new workspace
      workspace = await SlackDatabaseService.createWorkspace(session.user.id, oauthData);
    }

    return NextResponse.redirect(
      new URL('/integrations?success=slack_connected', req.url)
    );
  } catch (error) {
    console.error('Slack OAuth error:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=oauth_failed', req.url)
    );
  }
}

// Initiate OAuth flow
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
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
    authUrl.searchParams.set('state', session.user.id); // Use user ID as state for security

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Error creating OAuth URL:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 