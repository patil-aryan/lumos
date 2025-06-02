import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient, JiraUser } from '@/lib/jira/client';
import { JiraTokenManager } from '@/lib/jira/token-manager';
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
      return NextResponse.json(
        { error: 'No Jira workspace found' },
        { status: 404 }
      );
    }

    const jiraWorkspaceData = workspace[0];

    // Check token expiry first
    const now = new Date();
    const tokenExpired = jiraWorkspaceData.expiresAt && jiraWorkspaceData.expiresAt <= now;
    
    console.log('Token status:', {
      hasToken: !!jiraWorkspaceData.accessToken,
      hasRefreshToken: !!jiraWorkspaceData.refreshToken,
      expiresAt: jiraWorkspaceData.expiresAt,
      isExpired: tokenExpired,
      tokenPrefix: jiraWorkspaceData.accessToken?.substring(0, 20) + '...'
    });

    // Use token manager to handle potential token refresh
    const serverInfoData = await JiraTokenManager.handleTokenRefresh(
      jiraWorkspaceData,
      async (jiraClient: JiraClient) => {
        console.log('Fetching Jira server info...');
        return await jiraClient.getServerInfo();
      }
    );

    // Parallel data fetching with error handling
    const [projectsResult, issuesResult, usersResult] = await Promise.allSettled([
      JiraTokenManager.handleTokenRefresh(
        jiraWorkspaceData,
        async (jiraClient: JiraClient) => {
          console.log('Fetching Jira projects...');
          return await jiraClient.getProjects();
        }
      ),
      JiraTokenManager.handleTokenRefresh(
        jiraWorkspaceData,
        async (jiraClient: JiraClient) => {
          console.log('Fetching Jira issues...');
          // Get recent issues from all projects with explicit fields
          const jql = 'created >= -30d ORDER BY created DESC';
          const fields = [
            'summary', 'issuetype', 'status', 'priority', 'assignee', 
            'created', 'updated', 'project'
          ];
          const result = await jiraClient.searchIssues(jql, fields, undefined, 50);
          return result.issues;
        }
      ),
      JiraTokenManager.handleTokenRefresh(
        jiraWorkspaceData,
        async (jiraClient: JiraClient) => {
          console.log('Fetching Jira users...');
          return await jiraClient.getUsers(100);
        }
      ),
    ]);

    // Process results
    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
    const rawIssues = issuesResult.status === 'fulfilled' ? issuesResult.value : [];
    const users = usersResult.status === 'fulfilled' ? usersResult.value : [];

    // Transform issues to flat format for UI
    const issues = rawIssues.map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary || 'No Summary',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      status: issue.fields?.status?.name || null,
      priority: issue.fields?.priority?.name || null,
      assigneeDisplayName: issue.fields?.assignee?.displayName || null,
      created: issue.fields?.created || new Date().toISOString(),
      updated: issue.fields?.updated || new Date().toISOString(),
      projectKey: issue.fields?.project?.key || 'Unknown',
      projectName: issue.fields?.project?.name || 'Unknown Project'
    }));

    console.log('Sample transformed issue:', issues[0]); // Debug log

    // Count errors
    const errors = [projectsResult, issuesResult, usersResult].filter(
      result => result.status === 'rejected'
    ).length;

    // Log any errors
    if (projectsResult.status === 'rejected') {
      console.error('Error fetching projects:', projectsResult.reason);
    }
    if (issuesResult.status === 'rejected') {
      console.error('Error fetching issues:', issuesResult.reason);
    }
    if (usersResult.status === 'rejected') {
      console.error('Error fetching users:', usersResult.reason);
    }

    console.log('Jira data fetch completed:', {
      serverInfo: !!serverInfoData,
      projects: projects.length,
      issues: issues.length,
      users: users.length,
      errors,
      status: errors === 0 ? 'success' : errors === 3 ? 'failed' : 'partial'
    });

    return NextResponse.json({
      success: true,
      data: {
        workspace: {
          id: jiraWorkspaceData.id,
          name: jiraWorkspaceData.name,
          url: jiraWorkspaceData.url,
          cloudId: jiraWorkspaceData.cloudId,
        },
        serverInfo: serverInfoData,
        stats: {
          projects: projects.length,
          issues: issues.length,
          users: users.length,
          errors,
          status: errors === 0 ? 'success' : errors === 3 ? 'failed' : 'partial'
        },
        recentProjects: projects.slice(0, 10),
        recentIssues: issues.slice(0, 10),
        activeUsers: users.filter((user: JiraUser) => user.active).slice(0, 10),
      },
    });

  } catch (error) {
    console.error('Error fetching Jira data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Jira data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 