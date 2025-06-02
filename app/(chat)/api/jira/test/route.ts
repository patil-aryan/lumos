import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
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
        { error: 'No Jira workspace found. Please connect to Jira first.' },
        { status: 404 }
      );
    }

    const jiraWorkspaceData = workspace[0];

    // Create Jira client
    const jiraClient = new JiraClient(jiraWorkspaceData.accessToken, jiraWorkspaceData.cloudId);

    // Test connection and gather basic info
    const [serverInfo, projects, users] = await Promise.allSettled([
      jiraClient.getServerInfo(),
      jiraClient.getProjects(),
      jiraClient.getUsers(10), // Just first 10 users for testing
    ]);

    const connectionTest = {
      workspace: {
        id: jiraWorkspaceData.id,
        name: jiraWorkspaceData.name,
        url: jiraWorkspaceData.url,
        cloudId: jiraWorkspaceData.cloudId,
        connectedAt: jiraWorkspaceData.createdAt,
        lastSyncAt: jiraWorkspaceData.lastSyncAt,
      },
      serverInfo: serverInfo.status === 'fulfilled' ? serverInfo.value : null,
      projects: {
        success: projects.status === 'fulfilled',
        count: projects.status === 'fulfilled' ? projects.value.length : 0,
        sample: projects.status === 'fulfilled' 
          ? projects.value.slice(0, 3).map(p => ({ key: p.key, name: p.name, type: p.projectTypeKey }))
          : null,
      },
      users: {
        success: users.status === 'fulfilled',
        count: users.status === 'fulfilled' ? users.value.length : 0,
        sample: users.status === 'fulfilled'
          ? users.value.slice(0, 3).map(u => ({ accountId: u.accountId, displayName: u.displayName, active: u.active }))
          : null,
      },
      connectionStatus: 'healthy',
    };

    // Check for any failures
    const failures = [];
    if (serverInfo.status === 'rejected') failures.push(`Server info: ${serverInfo.reason}`);
    if (projects.status === 'rejected') failures.push(`Projects: ${projects.reason}`);
    if (users.status === 'rejected') failures.push(`Users: ${users.reason}`);

    if (failures.length > 0) {
      connectionTest.connectionStatus = 'partial';
      (connectionTest as any).errors = failures;
    }

    return NextResponse.json({
      success: true,
      message: 'Jira connection test completed',
      data: connectionTest,
    });

  } catch (error) {
    console.error('Error testing Jira connection:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to test Jira connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 