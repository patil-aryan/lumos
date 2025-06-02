import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OAuth 2.0 scopes matching the user's Jira app configuration
    const scopes = [
      // Granular scopes (preferred - these are configured in the app)
      'read:dashboard:jira',
      'read:group:jira',
      'read:issue:jira',
      'read:comment:jira',
      'read:priority:jira',
      'read:issue.property:jira',
      'read:resolution:jira',
      'read:issue-type:jira',
      'read:issue.changelog:jira',
      'read:user:jira',
      'read:project:jira',
      'read:project.component:jira',
      'read:project-role:jira',
      'read:project-version:jira',
      'read:workflow:jira',
      'read:board-scope.admin:jira-software',
      'read:sprint:jira-software',
      
      // Additional field access scopes
      'read:issue.vote:jira',
      'read:issue.watcher:jira',
      'read:issue.worklog:jira',
      'read:issue.time-tracking:jira',
      
      // Classic scopes (backup - these are also configured)
      'read:jira-work',
      'manage:jira-project',
      'read:jira-user',
      
      // Refresh token support
      'offline_access'
    ];

    // Validate environment variables
    if (!process.env.JIRA_CLIENT_ID) {
      console.error('JIRA_CLIENT_ID is not set');
      return NextResponse.json({ error: 'Jira client configuration missing' }, { status: 500 });
    }

    if (!process.env.JIRA_REDIRECT_URI) {
      console.error('JIRA_REDIRECT_URI is not set');
      return NextResponse.json({ error: 'Jira redirect URI configuration missing' }, { status: 500 });
    }

    // Generate state parameter for security (could be enhanced with CSRF token)
    const state = `${session.user.id}-${Date.now()}`;
    
    // Construct Jira OAuth URL
    const authUrl = new URL(JIRA_AUTH_URL);
    authUrl.searchParams.set('audience', 'api.atlassian.com');
    authUrl.searchParams.set('client_id', process.env.JIRA_CLIENT_ID);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('redirect_uri', process.env.JIRA_REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('prompt', 'consent');

    console.log('Redirecting to Jira OAuth with configured scopes:', scopes.join(' '));

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('Error initiating Jira OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Jira connection' },
      { status: 500 }
    );
  }
} 