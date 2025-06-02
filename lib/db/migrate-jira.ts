const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { 
  jiraWorkspace,
  jiraProject,
  jiraUser,
  jiraIssue,
  jiraChangeLog,
  jiraComment,
  jiraBoard,
  jiraSprint,
  jiraSyncLog
} = require('./schema-jira');

async function migrateJiraSchema() {
  const client = postgres(process.env.POSTGRES_URL || '');
  const db = drizzle(client);

  console.log('🚀 Starting Jira schema migration...');

  try {
    // Create tables in dependency order
    console.log('📋 Creating Jira tables...');

    // 1. Workspace table (no dependencies)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraWorkspace" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "cloudId" varchar(128) UNIQUE NOT NULL,
        "url" text NOT NULL,
        "name" text NOT NULL,
        "scopes" text NOT NULL,
        "accessToken" text NOT NULL,
        "refreshToken" text,
        "tokenType" varchar(32) DEFAULT 'Bearer',
        "expiresAt" timestamp,
        "userId" uuid NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "isActive" boolean DEFAULT true NOT NULL,
        "lastSyncAt" timestamp,
        "lastFullSyncAt" timestamp,
        "totalProjects" integer DEFAULT 0,
        "totalIssues" integer DEFAULT 0,
        "totalUsers" integer DEFAULT 0,
        "totalBoards" integer DEFAULT 0,
        "syncSettings" jsonb,
        "metadata" jsonb
      );
    `);

    // 2. Project table (depends on workspace)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraProject" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "projectId" varchar(32) NOT NULL,
        "key" varchar(32) NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "projectTypeKey" varchar(32),
        "simplified" boolean DEFAULT false,
        "style" varchar(32),
        "isPrivate" boolean DEFAULT false,
        "workspaceId" uuid NOT NULL,
        "leadAccountId" varchar(128),
        "leadDisplayName" text,
        "url" text,
        "avatarUrls" jsonb,
        "components" jsonb,
        "versions" jsonb,
        "issueTypes" jsonb,
        "roles" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("projectId", "workspaceId")
      );
    `);

    // 3. User table (depends on workspace)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraUser" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "accountId" varchar(128) NOT NULL,
        "accountType" varchar(32),
        "emailAddress" text,
        "displayName" text NOT NULL,
        "active" boolean DEFAULT true,
        "timeZone" varchar(64),
        "locale" varchar(16),
        "workspaceId" uuid NOT NULL,
        "avatarUrls" jsonb,
        "groups" jsonb,
        "applicationRoles" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("accountId", "workspaceId")
      );
    `);

    // 4. Board table (depends on workspace)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraBoard" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "boardId" integer NOT NULL,
        "name" text NOT NULL,
        "type" varchar(32) NOT NULL,
        "selfUrl" text,
        "workspaceId" uuid NOT NULL,
        "location" jsonb,
        "filter" jsonb,
        "columnConfig" jsonb,
        "estimationConfig" jsonb,
        "rankingConfig" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("boardId", "workspaceId")
      );
    `);

    // 5. Sprint table (depends on board)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraSprint" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sprintId" integer NOT NULL,
        "name" text NOT NULL,
        "state" varchar(16) NOT NULL,
        "boardId" integer NOT NULL,
        "workspaceId" uuid NOT NULL,
        "goal" text,
        "startDate" timestamp,
        "endDate" timestamp,
        "completeDate" timestamp,
        "originBoardId" integer,
        "issueCount" integer DEFAULT 0,
        "completedIssueCount" integer DEFAULT 0,
        "puntedIssueCount" integer DEFAULT 0,
        "issueKeys" jsonb,
        "completedIssueKeys" jsonb,
        "puntedIssueKeys" jsonb,
        "selfUrl" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("sprintId", "workspaceId")
      );
    `);

    // 6. Issue table (depends on workspace and project)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraIssue" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "issueId" varchar(32) NOT NULL,
        "key" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "projectKey" varchar(32) NOT NULL,
        "summary" text NOT NULL,
        "description" text,
        "issueType" varchar(32) NOT NULL,
        "status" varchar(64) NOT NULL,
        "statusCategory" varchar(32),
        "priority" varchar(32),
        "resolution" varchar(32),
        "reporterAccountId" varchar(128),
        "reporterDisplayName" text,
        "assigneeAccountId" varchar(128),
        "assigneeDisplayName" text,
        "creatorAccountId" varchar(128),
        "creatorDisplayName" text,
        "created" timestamp NOT NULL,
        "updated" timestamp NOT NULL,
        "dueDate" timestamp,
        "resolutionDate" timestamp,
        "epicKey" varchar(32),
        "epicName" text,
        "storyPoints" integer,
        "sprint" jsonb,
        "sprintHistory" jsonb,
        "labels" jsonb,
        "components" jsonb,
        "fixVersions" jsonb,
        "affectsVersions" jsonb,
        "attachments" jsonb,
        "hasAttachments" boolean DEFAULT false,
        "attachmentCount" integer DEFAULT 0,
        "issueLinks" jsonb,
        "subtasks" jsonb,
        "parentKey" varchar(32),
        "commentCount" integer DEFAULT 0,
        "hasComments" boolean DEFAULT false,
        "watcherCount" integer DEFAULT 0,
        "voteCount" integer DEFAULT 0,
        "customFields" jsonb,
        "timeSpent" integer,
        "timeEstimate" integer,
        "timeOriginalEstimate" integer,
        "workRatio" integer,
        "selfUrl" text,
        "browseUrl" text,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("key", "workspaceId")
      );
    `);

    // 7. Changelog table (depends on issue)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraChangeLog" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "changeId" varchar(64) NOT NULL,
        "issueKey" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "field" varchar(64) NOT NULL,
        "fieldType" varchar(32),
        "fieldId" varchar(64),
        "fromValue" text,
        "fromDisplayValue" text,
        "toValue" text,
        "toDisplayValue" text,
        "authorAccountId" varchar(128) NOT NULL,
        "authorDisplayName" text,
        "created" timestamp NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("changeId", "workspaceId")
      );
    `);

    // 8. Comment table (depends on issue)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraComment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "commentId" varchar(64) NOT NULL,
        "issueKey" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "body" text NOT NULL,
        "bodyFormat" varchar(16) DEFAULT 'text',
        "authorAccountId" varchar(128) NOT NULL,
        "authorDisplayName" text,
        "created" timestamp NOT NULL,
        "updated" timestamp NOT NULL,
        "visibility" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSyncAt" timestamp,
        "metadata" jsonb,
        UNIQUE("commentId", "workspaceId")
      );
    `);

    // 9. Sync log table (depends on workspace)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "JiraSyncLog" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspaceId" uuid NOT NULL,
        "syncType" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL,
        "startedAt" timestamp NOT NULL,
        "completedAt" timestamp,
        "duration" integer,
        "issuesProcessed" integer DEFAULT 0,
        "projectsProcessed" integer DEFAULT 0,
        "usersProcessed" integer DEFAULT 0,
        "boardsProcessed" integer DEFAULT 0,
        "sprintsProcessed" integer DEFAULT 0,
        "changelogsProcessed" integer DEFAULT 0,
        "commentsProcessed" integer DEFAULT 0,
        "lastError" text,
        "errorCount" integer DEFAULT 0,
        "syncScope" jsonb,
        "metadata" jsonb,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Create indexes for performance
    console.log('🔍 Creating indexes...');
    
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_workspace_user_id_idx" ON "JiraWorkspace" ("userId");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_project_workspace_id_idx" ON "JiraProject" ("workspaceId");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_issue_workspace_id_idx" ON "JiraIssue" ("workspaceId");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_issue_project_key_idx" ON "JiraIssue" ("projectKey");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_issue_status_idx" ON "JiraIssue" ("status");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_issue_assignee_idx" ON "JiraIssue" ("assigneeAccountId");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_issue_updated_idx" ON "JiraIssue" ("updated");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_changelog_issue_key_idx" ON "JiraChangeLog" ("issueKey");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_changelog_field_idx" ON "JiraChangeLog" ("field");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_comment_issue_key_idx" ON "JiraComment" ("issueKey");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_sprint_board_id_idx" ON "JiraSprint" ("boardId");');
    await db.execute('CREATE INDEX IF NOT EXISTS "jira_sprint_state_idx" ON "JiraSprint" ("state");');

    console.log('✅ Jira schema migration completed successfully!');
    console.log('📊 Created tables:');
    console.log('  - JiraWorkspace');
    console.log('  - JiraProject');
    console.log('  - JiraUser');
    console.log('  - JiraIssue (with comprehensive PM fields)');
    console.log('  - JiraChangeLog (status transitions)');
    console.log('  - JiraComment');
    console.log('  - JiraBoard (Agile boards)');
    console.log('  - JiraSprint (with metrics)');
    console.log('  - JiraSyncLog');
    console.log('🔍 Created performance indexes');

  } catch (error) {
    console.error('❌ Jira schema migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateJiraSchema()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateJiraSchema }; 