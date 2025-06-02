import { JiraClient, JiraIssue, JiraProject, JiraUser, JiraBoard, JiraSprint } from './client';
import { 
  jiraWorkspace, 
  jiraProject, 
  jiraUser, 
  jiraIssue, 
  jiraChangeLog, 
  jiraComment, 
  jiraBoard, 
  jiraSprint, 
  jiraSyncLog 
} from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, inArray } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export interface SyncOptions {
  syncType: 'full' | 'incremental' | 'projects_only' | 'issues_only';
  projectKeys?: string[]; // Specific projects to sync
  maxIssues?: number; // Limit for testing
  includeArchived?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export class JiraSync {
  private client: JiraClient;
  private workspaceId: string;
  private cloudId: string;

  constructor(accessToken: string, cloudId: string, workspaceId: string) {
    this.client = new JiraClient(accessToken, cloudId);
    this.workspaceId = workspaceId;
    this.cloudId = cloudId;
  }

  async startFullSync(options: SyncOptions = { syncType: 'full' }): Promise<string> {
    const syncLog = await this.createSyncLog(options);
    
    try {
      console.log(`Starting Jira ${options.syncType} sync for workspace ${this.workspaceId}`);
      
      const results = {
        projects: 0,
        users: 0,
        issues: 0,
        boards: 0,
        sprints: 0,
        changelogs: 0,
        comments: 0,
      };

      // Step 1: Sync Projects
      if (options.syncType === 'full' || options.syncType === 'projects_only') {
        results.projects = await this.syncProjects();
        console.log(`✅ Synced ${results.projects} projects`);
      }

      // Step 2: Sync Users
      if (options.syncType === 'full') {
        results.users = await this.syncUsers();
        console.log(`✅ Synced ${results.users} users`);
      }

      // Step 3: Sync Boards and Sprints (Agile data)
      if (options.syncType === 'full') {
        results.boards = await this.syncBoards();
        console.log(`✅ Synced ${results.boards} boards`);
        
        results.sprints = await this.syncSprints();
        console.log(`✅ Synced ${results.sprints} sprints`);
      }

      // Step 4: Sync Issues (most intensive)
      if (options.syncType === 'full' || options.syncType === 'issues_only') {
        const issueResults = await this.syncIssues(options);
        results.issues = issueResults.issues;
        results.changelogs = issueResults.changelogs;
        results.comments = issueResults.comments;
        console.log(`✅ Synced ${results.issues} issues, ${results.changelogs} changelog entries, ${results.comments} comments`);
      }

      // Update workspace sync timestamp
      await db
        .update(jiraWorkspace)
        .set({
          lastSyncAt: new Date(),
          lastFullSyncAt: options.syncType === 'full' ? new Date() : undefined,
          totalProjects: results.projects || undefined,
          totalIssues: results.issues || undefined,
          totalUsers: results.users || undefined,
          totalBoards: results.boards || undefined,
        })
        .where(eq(jiraWorkspace.id, this.workspaceId));

      // Complete sync log
      await this.completeSyncLog(syncLog.id, 'completed', results);
      
      console.log('🎉 Jira sync completed successfully:', results);
      return syncLog.id;

    } catch (error) {
      console.error('❌ Jira sync failed:', error);
      await this.completeSyncLog(syncLog.id, 'failed', {}, error);
      throw error;
    }
  }

  private async syncProjects(): Promise<number> {
    const projects = await this.client.getProjects(['description', 'lead', 'components', 'versions', 'issueTypes']);
    
    for (const project of projects) {
      await db
        .insert(jiraProject)
        .values({
          projectId: project.id,
          key: project.key,
          name: project.name,
          description: project.description || null,
          projectTypeKey: project.projectTypeKey,
          simplified: project.simplified,
          style: project.style,
          isPrivate: project.isPrivate,
          workspaceId: this.workspaceId,
          leadAccountId: project.lead?.accountId || null,
          leadDisplayName: project.lead?.displayName || null,
          url: `https://${this.cloudId}.atlassian.net/browse/${project.key}`,
          components: project.components || null,
          versions: project.versions || null,
          issueTypes: project.issueTypes || null,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraProject.projectId, jiraProject.workspaceId],
          set: {
            name: project.name,
            description: project.description || null,
            leadAccountId: project.lead?.accountId || null,
            leadDisplayName: project.lead?.displayName || null,
            components: project.components || null,
            versions: project.versions || null,
            issueTypes: project.issueTypes || null,
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          },
        });
    }

    return projects.length;
  }

  private async syncUsers(): Promise<number> {
    let allUsers: JiraUser[] = [];
    let startAt = 0;
    const maxResults = 100;

    // Paginate through all users
    while (true) {
      const users = await this.client.getUsers(maxResults, startAt);
      if (users.length === 0) break;
      
      allUsers.push(...users);
      startAt += maxResults;
      
      if (users.length < maxResults) break; // Last page
    }

    for (const user of allUsers) {
      await db
        .insert(jiraUser)
        .values({
          accountId: user.accountId,
          accountType: user.accountType,
          emailAddress: user.emailAddress || null,
          displayName: user.displayName,
          active: user.active,
          timeZone: user.timeZone || null,
          locale: user.locale || null,
          workspaceId: this.workspaceId,
          avatarUrls: user.avatarUrls || null,
          groups: user.groups || null,
          applicationRoles: user.applicationRoles || null,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraUser.accountId, jiraUser.workspaceId],
          set: {
            emailAddress: user.emailAddress || null,
            displayName: user.displayName,
            active: user.active,
            timeZone: user.timeZone || null,
            locale: user.locale || null,
            avatarUrls: user.avatarUrls || null,
            groups: user.groups || null,
            applicationRoles: user.applicationRoles || null,
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          },
        });
    }

    return allUsers.length;
  }

  private async syncBoards(): Promise<number> {
    const boardsResponse = await this.client.getBoards();
    const boards = boardsResponse.values;

    for (const board of boards) {
      await db
        .insert(jiraBoard)
        .values({
          boardId: board.id,
          name: board.name,
          type: board.type,
          workspaceId: this.workspaceId,
          selfUrl: board.self,
          location: board.location || null,
          filter: board.filter || null,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraBoard.boardId, jiraBoard.workspaceId],
          set: {
            name: board.name,
            type: board.type,
            location: board.location || null,
            filter: board.filter || null,
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          },
        });
    }

    return boards.length;
  }

  private async syncSprints(): Promise<number> {
    // Get all boards first
    const boards = await db
      .select()
      .from(jiraBoard)
      .where(eq(jiraBoard.workspaceId, this.workspaceId));

    let totalSprints = 0;

    for (const board of boards) {
      try {
        const sprintsResponse = await this.client.getSprints(board.boardId);
        const sprints = sprintsResponse.values;

        for (const sprint of sprints) {
          await db
            .insert(jiraSprint)
            .values({
              sprintId: sprint.id,
              name: sprint.name,
              state: sprint.state,
              boardId: board.boardId,
              workspaceId: this.workspaceId,
              goal: sprint.goal || null,
              startDate: sprint.startDate ? new Date(sprint.startDate) : null,
              endDate: sprint.endDate ? new Date(sprint.endDate) : null,
              completeDate: sprint.completeDate ? new Date(sprint.completeDate) : null,
              originBoardId: sprint.originBoardId,
              selfUrl: sprint.self,
              lastSyncAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [jiraSprint.sprintId, jiraSprint.workspaceId],
              set: {
                name: sprint.name,
                state: sprint.state,
                goal: sprint.goal || null,
                startDate: sprint.startDate ? new Date(sprint.startDate) : null,
                endDate: sprint.endDate ? new Date(sprint.endDate) : null,
                completeDate: sprint.completeDate ? new Date(sprint.completeDate) : null,
                updatedAt: new Date(),
                lastSyncAt: new Date(),
              },
            });
        }

        totalSprints += sprints.length;
      } catch (error) {
        console.warn(`Failed to sync sprints for board ${board.name}:`, error);
      }
    }

    return totalSprints;
  }

  private async syncIssues(options: SyncOptions): Promise<{ issues: number; changelogs: number; comments: number }> {
    let jql = 'ORDER BY updated DESC';
    
    // Apply filters based on options
    if (options.projectKeys?.length) {
      jql = `project IN (${options.projectKeys.join(',')}) AND ${jql}`;
    }
    
    if (options.dateRange) {
      const fromDate = options.dateRange.from.toISOString().split('T')[0];
      const toDate = options.dateRange.to.toISOString().split('T')[0];
      jql = `updated >= "${fromDate}" AND updated <= "${toDate}" AND ${jql}`;
    }

    const maxResults = options.maxIssues || 1000;
    let allIssues: JiraIssue[] = [];
    let startAt = 0;
    const batchSize = 100;

    // Paginate through issues
    while (allIssues.length < maxResults) {
      const remainingResults = Math.min(batchSize, maxResults - allIssues.length);
      
      const searchResult = await this.client.searchIssues(
        jql,
        undefined, // Use default comprehensive fields
        ['changelog'], // Include changelog
        remainingResults,
        startAt
      );

      if (searchResult.issues.length === 0) break;
      
      allIssues.push(...searchResult.issues);
      startAt += remainingResults;
      
      if (searchResult.issues.length < remainingResults) break; // Last page
    }

    console.log(`Processing ${allIssues.length} issues...`);

    let syncedIssues = 0;
    let syncedChangelogs = 0;
    let syncedComments = 0;

    // Process issues in batches for better performance
    const batchProcessSize = 50;
    for (let i = 0; i < allIssues.length; i += batchProcessSize) {
      const batch = allIssues.slice(i, i + batchProcessSize);
      
      for (const issue of batch) {
        // Sync issue
        await this.syncIssue(issue);
        syncedIssues++;

        // Sync changelog if available
        if (issue.changelog?.histories) {
          const changelogCount = await this.syncIssueChangelog(issue.key, issue.changelog.histories);
          syncedChangelogs += changelogCount;
        }

        // Sync comments if available
        if (issue.fields.comment?.comments) {
          const commentCount = await this.syncIssueComments(issue.key, issue.fields.comment.comments);
          syncedComments += commentCount;
        }
      }

      // Log progress
      console.log(`Processed ${Math.min(i + batchProcessSize, allIssues.length)}/${allIssues.length} issues`);
    }

    return {
      issues: syncedIssues,
      changelogs: syncedChangelogs,
      comments: syncedComments,
    };
  }

  private async syncIssue(issue: JiraIssue): Promise<void> {
    const fields = issue.fields;
    
    await db
      .insert(jiraIssue)
      .values({
        issueId: issue.id,
        key: issue.key,
        workspaceId: this.workspaceId,
        projectKey: fields.project?.key || issue.key.split('-')[0],
        summary: fields.summary,
        description: fields.description || null,
        issueType: fields.issuetype.name,
        status: fields.status.name,
        statusCategory: fields.status.statusCategory.name,
        priority: fields.priority?.name || null,
        resolution: fields.resolution?.name || null,
        reporterAccountId: fields.reporter?.accountId || null,
        reporterDisplayName: fields.reporter?.displayName || null,
        assigneeAccountId: fields.assignee?.accountId || null,
        assigneeDisplayName: fields.assignee?.displayName || null,
        creatorAccountId: fields.creator?.accountId || null,
        creatorDisplayName: fields.creator?.displayName || null,
        created: new Date(fields.created),
        updated: new Date(fields.updated),
        dueDate: fields.duedate ? new Date(fields.duedate) : null,
        resolutionDate: fields.resolutiondate ? new Date(fields.resolutiondate) : null,
        epicKey: fields.parent?.key || null,
        epicName: fields.parent?.fields?.summary || null,
        storyPoints: fields.customfield_10016 || null, // Common story points field
        labels: fields.labels || null,
        components: fields.components || null,
        fixVersions: fields.fixVersions || null,
        affectsVersions: fields.versions || null,
        attachments: fields.attachment || null,
        hasAttachments: fields.attachment?.length > 0,
        attachmentCount: fields.attachment?.length || 0,
        issueLinks: fields.issuelinks || null,
        subtasks: fields.subtasks || null,
        parentKey: fields.parent?.key || null,
        commentCount: fields.comment?.total || 0,
        hasComments: (fields.comment?.total || 0) > 0,
        watcherCount: fields.watches?.watchCount || 0,
        voteCount: fields.votes?.votes || 0,
        timeSpent: fields.timetracking?.timeSpentSeconds || null,
        timeEstimate: fields.timetracking?.remainingEstimateSeconds || null,
        timeOriginalEstimate: fields.timetracking?.originalEstimateSeconds || null,
        customFields: this.extractCustomFields(fields),
        selfUrl: issue.self,
        browseUrl: `https://${this.cloudId}.atlassian.net/browse/${issue.key}`,
        lastSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [jiraIssue.key, jiraIssue.workspaceId],
        set: {
          summary: fields.summary,
          description: fields.description || null,
          status: fields.status.name,
          statusCategory: fields.status.statusCategory.name,
          priority: fields.priority?.name || null,
          resolution: fields.resolution?.name || null,
          assigneeAccountId: fields.assignee?.accountId || null,
          assigneeDisplayName: fields.assignee?.displayName || null,
          updated: new Date(fields.updated),
          dueDate: fields.duedate ? new Date(fields.duedate) : null,
          resolutionDate: fields.resolutiondate ? new Date(fields.resolutiondate) : null,
          labels: fields.labels || null,
          components: fields.components || null,
          fixVersions: fields.fixVersions || null,
          attachments: fields.attachment || null,
          hasAttachments: fields.attachment?.length > 0,
          attachmentCount: fields.attachment?.length || 0,
          commentCount: fields.comment?.total || 0,
          hasComments: (fields.comment?.total || 0) > 0,
          watcherCount: fields.watches?.watchCount || 0,
          voteCount: fields.votes?.votes || 0,
          customFields: this.extractCustomFields(fields),
          updatedAt: new Date(),
          lastSyncAt: new Date(),
        },
      });
  }

  private async syncIssueChangelog(issueKey: string, histories: any[]): Promise<number> {
    let syncedCount = 0;

    for (const history of histories) {
      for (const item of history.items) {
        await db
          .insert(jiraChangeLog)
          .values({
            changeId: `${history.id}-${item.field}`,
            issueKey,
            workspaceId: this.workspaceId,
            field: item.field,
            fieldType: item.fieldtype,
            fieldId: item.fieldId || null,
            fromValue: item.from || null,
            fromDisplayValue: item.fromString || null,
            toValue: item.to || null,
            toDisplayValue: item.toString || null,
            authorAccountId: history.author.accountId,
            authorDisplayName: history.author.displayName,
            created: new Date(history.created),
            lastSyncAt: new Date(),
          })
          .onConflictDoNothing(); // Don't update existing changelog entries
        
        syncedCount++;
      }
    }

    return syncedCount;
  }

  private async syncIssueComments(issueKey: string, comments: any[]): Promise<number> {
    for (const comment of comments) {
      await db
        .insert(jiraComment)
        .values({
          commentId: comment.id,
          issueKey,
          workspaceId: this.workspaceId,
          body: typeof comment.body === 'string' ? comment.body : JSON.stringify(comment.body),
          bodyFormat: comment.body?.type === 'doc' ? 'adf' : 'text',
          authorAccountId: comment.author.accountId,
          authorDisplayName: comment.author.displayName,
          created: new Date(comment.created),
          updated: new Date(comment.updated),
          visibility: comment.visibility || null,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraComment.commentId, jiraComment.workspaceId],
          set: {
            body: typeof comment.body === 'string' ? comment.body : JSON.stringify(comment.body),
            updated: new Date(comment.updated),
            updatedAt: new Date(),
            lastSyncAt: new Date(),
          },
        });
    }

    return comments.length;
  }

  private extractCustomFields(fields: any): any {
    const customFields: any = {};
    
    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('customfield_') && value !== null) {
        customFields[key] = value;
      }
    }
    
    return Object.keys(customFields).length > 0 ? customFields : null;
  }

  private async createSyncLog(options: SyncOptions): Promise<{ id: string }> {
    const syncLog = await db
      .insert(jiraSyncLog)
      .values({
        workspaceId: this.workspaceId,
        syncType: options.syncType,
        status: 'running',
        startedAt: new Date(),
        syncScope: {
          projectKeys: options.projectKeys,
          maxIssues: options.maxIssues,
          includeArchived: options.includeArchived,
          dateRange: options.dateRange,
        },
      })
      .returning();

    return syncLog[0];
  }

  private async completeSyncLog(
    syncLogId: string, 
    status: 'completed' | 'failed',
    results: any = {},
    error?: any
  ): Promise<void> {
    const completedAt = new Date();
    const startedAt = await db
      .select({ startedAt: jiraSyncLog.startedAt })
      .from(jiraSyncLog)
      .where(eq(jiraSyncLog.id, syncLogId))
      .limit(1);

    const duration = startedAt.length > 0 
      ? Math.round((completedAt.getTime() - startedAt[0].startedAt.getTime()) / 1000)
      : null;

    await db
      .update(jiraSyncLog)
      .set({
        status,
        completedAt,
        duration,
        issuesProcessed: results.issues || 0,
        projectsProcessed: results.projects || 0,
        usersProcessed: results.users || 0,
        boardsProcessed: results.boards || 0,
        sprintsProcessed: results.sprints || 0,
        changelogsProcessed: results.changelogs || 0,
        commentsProcessed: results.comments || 0,
        lastError: error instanceof Error ? error.message : null,
        metadata: {
          results,
          error: error instanceof Error ? error.message : error,
        },
      })
      .where(eq(jiraSyncLog.id, syncLogId));
  }
} 