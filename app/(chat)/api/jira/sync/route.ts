import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
import { JiraTokenManager } from '@/lib/jira/token-manager';
import { jiraWorkspace, jiraProject, jiraIssue, jiraUser, jiraSyncLog } from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

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

    // Create sync log
    const syncLog = await db
      .insert(jiraSyncLog)
      .values({
        workspaceId: jiraWorkspaceData.id,
        syncType: 'full',
        status: 'running',
        startedAt: new Date(),
      })
      .returning({ id: jiraSyncLog.id });

    const syncLogId = syncLog[0].id;

    console.log(`Starting Jira sync for workspace ${jiraWorkspaceData.name}`);

    try {
      // Sync projects using token manager
      console.log('Syncing projects...');
      const projects = await JiraTokenManager.handleTokenRefresh(
        jiraWorkspaceData,
        async (jiraClient: JiraClient) => await jiraClient.getProjects()
      );
      
      let projectsProcessed = 0;
      let issuesProcessed = 0;
      let usersProcessed = 0;

      // Sync issues from first project (for demo)
      if (projects.length > 0) {
        console.log('Syncing issues...');
        const firstProject = projects[0];
        const searchResult = await JiraTokenManager.handleTokenRefresh(
          jiraWorkspaceData,
          async (jiraClient: JiraClient) => await jiraClient.searchIssues(
            `project = ${firstProject.key} ORDER BY updated DESC`,
            ['*all'],
            undefined,
            100
          )
        );

        for (const issue of searchResult.issues) {
          await db
            .insert(jiraIssue)
            .values({
              issueId: issue.id,
              key: issue.key,
              workspaceId: jiraWorkspaceData.id,
              projectKey: issue.fields.project.key,
              summary: issue.fields.summary,
              description: issue.fields.description || null,
              issueType: issue.fields.issuetype.name,
              status: issue.fields.status.name,
              statusCategory: issue.fields.status.statusCategory?.name,
              priority: issue.fields.priority?.name,
              resolution: issue.fields.resolution?.name,
              reporterAccountId: issue.fields.reporter?.accountId,
              reporterDisplayName: issue.fields.reporter?.displayName,
              assigneeAccountId: issue.fields.assignee?.accountId,
              assigneeDisplayName: issue.fields.assignee?.displayName,
              creatorAccountId: issue.fields.creator?.accountId,
              creatorDisplayName: issue.fields.creator?.displayName,
              created: new Date(issue.fields.created),
              updated: new Date(issue.fields.updated),
              dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
              resolutionDate: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null,
              labels: issue.fields.labels ? JSON.stringify(issue.fields.labels) : null,
              components: issue.fields.components ? JSON.stringify(issue.fields.components) : null,
              fixVersions: issue.fields.fixVersions ? JSON.stringify(issue.fields.fixVersions) : null,
              customFields: issue.fields.customFields ? JSON.stringify(issue.fields.customFields) : null,
              timeSpent: issue.fields.timespent,
              timeEstimate: issue.fields.timeestimate,
              timeOriginalEstimate: issue.fields.timeoriginalestimate,
              selfUrl: issue.self,
              lastSyncAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [jiraIssue.key, jiraIssue.workspaceId],
              set: {
                summary: issue.fields.summary,
                status: issue.fields.status.name,
                assigneeAccountId: issue.fields.assignee?.accountId,
                assigneeDisplayName: issue.fields.assignee?.displayName,
                updated: new Date(issue.fields.updated),
                lastSyncAt: new Date(),
              }
            });

          issuesProcessed++;
        }
      }

      // Sync users (sample)
      console.log('Syncing users...');
      const users = await JiraTokenManager.handleTokenRefresh(
        jiraWorkspaceData,
        async (jiraClient: JiraClient) => await jiraClient.getUsers(50, 0)
      );
      
      for (const user of users) {
        await db
          .insert(jiraUser)
          .values({
            accountId: user.accountId,
            accountType: user.accountType,
            emailAddress: user.emailAddress,
            displayName: user.displayName,
            active: user.active,
            timeZone: user.timeZone,
            locale: user.locale,
            workspaceId: jiraWorkspaceData.id,
            avatarUrls: user.avatarUrls ? JSON.stringify(user.avatarUrls) : null,
            lastSyncAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [jiraUser.accountId, jiraUser.workspaceId],
            set: {
              displayName: user.displayName,
              active: user.active,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            }
          });

        usersProcessed++;
      }

      // Update workspace sync stats
      await db
        .update(jiraWorkspace)
        .set({
          lastSyncAt: new Date(),
          lastFullSyncAt: new Date(),
          totalProjects: projectsProcessed,
          totalIssues: issuesProcessed,
          totalUsers: usersProcessed,
          updatedAt: new Date(),
        })
        .where(eq(jiraWorkspace.id, jiraWorkspaceData.id));

      // Complete sync log
      const syncStartTime = new Date(syncLog[0].id); // Use sync log creation as start time
      await db
        .update(jiraSyncLog)
        .set({
          status: 'completed',
          completedAt: new Date(),
          duration: Math.floor((Date.now() - syncStartTime.getTime()) / 1000),
          projectsProcessed,
          issuesProcessed,
          usersProcessed,
        })
        .where(eq(jiraSyncLog.id, syncLogId));

      console.log('Jira sync completed successfully:', {
        projects: projectsProcessed,
        issues: issuesProcessed,
        users: usersProcessed,
      });

      return NextResponse.json({
        success: true,
        message: 'Jira sync completed successfully',
        syncLogId,
        stats: {
          projectsProcessed,
          issuesProcessed,
          usersProcessed,
        }
      });

    } catch (syncError) {
      console.error('Error during sync:', syncError);
      
      // Update sync log with error
      await db
        .update(jiraSyncLog)
        .set({
          status: 'failed',
          completedAt: new Date(),
          lastError: syncError instanceof Error ? syncError.message : 'Unknown error',
          errorCount: 1,
        })
        .where(eq(jiraSyncLog.id, syncLogId));

      throw syncError;
    }

  } catch (error) {
    console.error('Error in Jira sync:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const syncLogId = searchParams.get('syncLogId');

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

    if (syncLogId) {
      // Get specific sync log status
      const syncLog = await db
        .select()
        .from(jiraSyncLog)
        .where(
          and(
            eq(jiraSyncLog.id, syncLogId),
            eq(jiraSyncLog.workspaceId, jiraWorkspaceData.id)
          )
        )
        .limit(1);

      if (!syncLog.length) {
        return NextResponse.json(
          { error: 'Sync log not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        syncLog: syncLog[0],
      });
    } else {
      // Get recent sync logs for this workspace
      const recentSyncLogs = await db
        .select()
        .from(jiraSyncLog)
        .where(eq(jiraSyncLog.workspaceId, jiraWorkspaceData.id))
        .orderBy(jiraSyncLog.startedAt)
        .limit(10);

      return NextResponse.json({
        success: true,
        workspace: {
          id: jiraWorkspaceData.id,
          name: jiraWorkspaceData.name,
          url: jiraWorkspaceData.url,
          lastSyncAt: jiraWorkspaceData.lastSyncAt,
          lastFullSyncAt: jiraWorkspaceData.lastFullSyncAt,
          totalProjects: jiraWorkspaceData.totalProjects,
          totalIssues: jiraWorkspaceData.totalIssues,
          totalUsers: jiraWorkspaceData.totalUsers,
          totalBoards: jiraWorkspaceData.totalBoards,
        },
        recentSyncLogs,
      });
    }

  } catch (error) {
    console.error('Error getting Jira sync status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 