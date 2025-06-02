import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
import { jiraWorkspace, jiraProject, jiraIssue, jiraUser } from '@/lib/db/schema-jira';
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

    console.log('=== JIRA DEBUG - FULL DATA DUMP ===');

    // Get workspace data
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
        success: false,
        error: 'No Jira workspace found',
        debug: {
          userId: session.user.id,
          workspaceFound: false
        }
      });
    }

    const jiraWorkspaceData = workspace[0];
    
    console.log('Workspace found:', {
      id: jiraWorkspaceData.id,
      name: jiraWorkspaceData.name,
      cloudId: jiraWorkspaceData.cloudId,
      hasAccessToken: !!jiraWorkspaceData.accessToken,
      tokenLength: jiraWorkspaceData.accessToken?.length,
      expiresAt: jiraWorkspaceData.expiresAt,
      scopes: jiraWorkspaceData.scopes
    });

    // Try to create Jira client and test basic calls
    let apiTestResults = {
      serverInfo: null as any,
      projects: null as any,
      issues: null as any,
      users: null as any,
      rawErrors: [] as any[]
    };

    try {
      const jiraClient = new JiraClient(jiraWorkspaceData.accessToken, jiraWorkspaceData.cloudId);

      // Test server info
      try {
        console.log('Testing server info...');
        apiTestResults.serverInfo = await jiraClient.getServerInfo();
        console.log('Server info success:', apiTestResults.serverInfo);
      } catch (error: any) {
        console.error('Server info failed:', error.response?.data || error.message);
        apiTestResults.rawErrors.push({
          endpoint: 'serverInfo',
          error: error.response?.data || error.message,
          status: error.response?.status
        });
      }

      // Test projects
      try {
        console.log('Testing projects...');
        const projects = await jiraClient.getProjects();
        apiTestResults.projects = {
          count: projects.length,
          sample: projects.slice(0, 5),
          all: projects
        };
        console.log('Projects success:', projects.length, 'found');
      } catch (error: any) {
        console.error('Projects failed:', error.response?.data || error.message);
        apiTestResults.rawErrors.push({
          endpoint: 'projects',
          error: error.response?.data || error.message,
          status: error.response?.status
        });
      }

      // Test issues
      try {
        console.log('Testing issues...');
        const issueResult = await jiraClient.searchIssues('created >= -30d ORDER BY created DESC', undefined, undefined, 20);
        apiTestResults.issues = {
          count: issueResult.issues.length,
          total: issueResult.total,
          sample: issueResult.issues.slice(0, 3),
          all: issueResult.issues
        };
        console.log('Issues success:', issueResult.issues.length, 'found');
      } catch (error: any) {
        console.error('Issues failed:', error.response?.data || error.message);
        apiTestResults.rawErrors.push({
          endpoint: 'issues',
          error: error.response?.data || error.message,
          status: error.response?.status
        });
      }

      // Test users
      try {
        console.log('Testing users...');
        const users = await jiraClient.getUsers(20);
        apiTestResults.users = {
          count: users.length,
          sample: users.slice(0, 3),
          all: users
        };
        console.log('Users success:', users.length, 'found');
      } catch (error: any) {
        console.error('Users failed:', error.response?.data || error.message);
        apiTestResults.rawErrors.push({
          endpoint: 'users',
          error: error.response?.data || error.message,
          status: error.response?.status
        });
      }

    } catch (clientError: any) {
      console.error('Failed to create Jira client:', clientError);
      apiTestResults.rawErrors.push({
        endpoint: 'client_creation',
        error: clientError.message,
        status: 'client_error'
      });
    }

    // Get database data
    const [dbProjects, dbIssues, dbUsers] = await Promise.allSettled([
      db.select().from(jiraProject).where(eq(jiraProject.workspaceId, jiraWorkspaceData.id)).limit(10),
      db.select().from(jiraIssue).where(eq(jiraIssue.workspaceId, jiraWorkspaceData.id)).limit(10),
      db.select().from(jiraUser).where(eq(jiraUser.workspaceId, jiraWorkspaceData.id)).limit(10)
    ]);

    const databaseData = {
      projects: dbProjects.status === 'fulfilled' ? dbProjects.value : [],
      issues: dbIssues.status === 'fulfilled' ? dbIssues.value : [],
      users: dbUsers.status === 'fulfilled' ? dbUsers.value : [],
      errors: [
        dbProjects.status === 'rejected' ? dbProjects.reason : null,
        dbIssues.status === 'rejected' ? dbIssues.reason : null,
        dbUsers.status === 'rejected' ? dbUsers.reason : null
      ].filter(Boolean)
    };

    console.log('Database data counts:', {
      projects: databaseData.projects.length,
      issues: databaseData.issues.length,
      users: databaseData.users.length
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workspace: {
        id: jiraWorkspaceData.id,
        name: jiraWorkspaceData.name,
        url: jiraWorkspaceData.url,
        cloudId: jiraWorkspaceData.cloudId,
        scopes: jiraWorkspaceData.scopes,
        createdAt: jiraWorkspaceData.createdAt,
        updatedAt: jiraWorkspaceData.updatedAt,
        expiresAt: jiraWorkspaceData.expiresAt,
        metadata: jiraWorkspaceData.metadata,
        totalProjects: jiraWorkspaceData.totalProjects,
        totalIssues: jiraWorkspaceData.totalIssues,
        totalUsers: jiraWorkspaceData.totalUsers,
        lastSyncAt: jiraWorkspaceData.lastSyncAt,
        lastFullSyncAt: jiraWorkspaceData.lastFullSyncAt
      },
      apiTests: apiTestResults,
      databaseData,
      summary: {
        hasValidToken: !!jiraWorkspaceData.accessToken,
        tokenExpired: jiraWorkspaceData.expiresAt ? jiraWorkspaceData.expiresAt <= new Date() : null,
        apiErrorCount: apiTestResults.rawErrors.length,
        workingEndpoints: [
          apiTestResults.serverInfo ? 'serverInfo' : null,
          apiTestResults.projects ? 'projects' : null,
          apiTestResults.issues ? 'issues' : null,
          apiTestResults.users ? 'users' : null
        ].filter(Boolean),
        databaseRecords: {
          projects: databaseData.projects.length,
          issues: databaseData.issues.length,
          users: databaseData.users.length
        }
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 