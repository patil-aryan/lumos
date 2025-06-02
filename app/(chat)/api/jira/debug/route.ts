import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { jiraWorkspace } from '@/lib/db/schema-jira';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Jira workspace
    const workspace = await db
      .select()
      .from(jiraWorkspace)
      .where(
        and(
          eq(jiraWorkspace.userId, session.user.id as string),
          eq(jiraWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({
        connected: false,
        error: 'No Jira workspace found'
      });
    }

    const jiraWorkspaceData = workspace[0];
    const now = new Date();
    const tokenExpired = jiraWorkspaceData.expiresAt && jiraWorkspaceData.expiresAt <= now;
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const expiringSoon = jiraWorkspaceData.expiresAt && jiraWorkspaceData.expiresAt <= fiveMinutesFromNow;

    return NextResponse.json({
      connected: true,
      workspace: {
        id: jiraWorkspaceData.id,
        name: jiraWorkspaceData.name,
        url: jiraWorkspaceData.url,
        cloudId: jiraWorkspaceData.cloudId,
        createdAt: jiraWorkspaceData.createdAt,
        updatedAt: jiraWorkspaceData.updatedAt,
      },
      token: {
        hasAccessToken: !!jiraWorkspaceData.accessToken,
        hasRefreshToken: !!jiraWorkspaceData.refreshToken,
        tokenPrefix: jiraWorkspaceData.accessToken?.substring(0, 20) + '...',
        expiresAt: jiraWorkspaceData.expiresAt,
        isExpired: tokenExpired,
        expiringSoon: expiringSoon,
        scopes: jiraWorkspaceData.scopes,
        tokenType: jiraWorkspaceData.tokenType
      },
      environment: {
        clientId: process.env.JIRA_CLIENT_ID ? 'Present' : 'Missing',
        clientSecret: process.env.JIRA_CLIENT_SECRET ? 'Present' : 'Missing',
        redirectUri: process.env.JIRA_REDIRECT_URI || 'Missing'
      }
    });

  } catch (error) {
    console.error('Error in Jira debug:', error);
    return NextResponse.json(
      { 
        connected: false,
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 