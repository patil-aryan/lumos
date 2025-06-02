import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  json,
  integer,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Jira Integration Tables for Product Manager data
export const jiraWorkspace = pgTable('JiraWorkspace', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  cloudId: varchar('cloudId', { length: 128 }).notNull().unique(),
  url: text('url').notNull(), // e.g., https://your-domain.atlassian.net
  name: text('name').notNull(),
  scopes: text('scopes').notNull(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  tokenType: varchar('tokenType', { length: 32 }).default('Bearer'),
  expiresAt: timestamp('expiresAt'),
  userId: uuid('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  isActive: boolean('isActive').notNull().default(true),
  // Sync tracking
  lastSyncAt: timestamp('lastSyncAt'),
  lastFullSyncAt: timestamp('lastFullSyncAt'),
  totalProjects: integer('totalProjects').default(0),
  totalIssues: integer('totalIssues').default(0),
  totalUsers: integer('totalUsers').default(0),
  totalBoards: integer('totalBoards').default(0),
  syncSettings: json('syncSettings'),
  metadata: json('metadata'),
}, (table) => ({
  userIdIdx: index('jira_workspace_user_id_idx').on(table.userId),
}));

export const jiraProject = pgTable('JiraProject', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  projectId: varchar('projectId', { length: 32 }).notNull(),
  key: varchar('key', { length: 32 }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  projectTypeKey: varchar('projectTypeKey', { length: 32 }),
  simplified: boolean('simplified').default(false),
  style: varchar('style', { length: 32 }),
  isPrivate: boolean('isPrivate').default(false),
  workspaceId: uuid('workspaceId').notNull(),
  // Project metadata
  leadAccountId: varchar('leadAccountId', { length: 128 }),
  leadDisplayName: text('leadDisplayName'),
  url: text('url'),
  avatarUrls: json('avatarUrls'),
  // Project configuration
  components: json('components'),
  versions: json('versions'),
  issueTypes: json('issueTypes'),
  roles: json('roles'),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => ({
  workspaceIdIdx: index('jira_project_workspace_id_idx').on(table.workspaceId),
}));

export const jiraUser = pgTable('JiraUser', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  accountId: varchar('accountId', { length: 128 }).notNull(),
  accountType: varchar('accountType', { length: 32 }),
  emailAddress: text('emailAddress'),
  displayName: text('displayName').notNull(),
  active: boolean('active').default(true),
  timeZone: varchar('timeZone', { length: 64 }),
  locale: varchar('locale', { length: 16 }),
  workspaceId: uuid('workspaceId').notNull(),
  // Profile data
  avatarUrls: json('avatarUrls'),
  groups: json('groups'),
  applicationRoles: json('applicationRoles'),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
});

export const jiraIssue = pgTable('JiraIssue', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  issueId: varchar('issueId', { length: 32 }).notNull(),
  key: varchar('key', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  projectKey: varchar('projectKey', { length: 32 }).notNull(),
  
  // Core issue data
  summary: text('summary').notNull(),
  description: text('description'),
  issueType: varchar('issueType', { length: 32 }).notNull(),
  status: varchar('status', { length: 64 }).notNull(),
  statusCategory: varchar('statusCategory', { length: 32 }),
  priority: varchar('priority', { length: 32 }),
  resolution: varchar('resolution', { length: 32 }),
  
  // People
  reporterAccountId: varchar('reporterAccountId', { length: 128 }),
  reporterDisplayName: text('reporterDisplayName'),
  assigneeAccountId: varchar('assigneeAccountId', { length: 128 }),
  assigneeDisplayName: text('assigneeDisplayName'),
  creatorAccountId: varchar('creatorAccountId', { length: 128 }),
  creatorDisplayName: text('creatorDisplayName'),
  
  // Dates (critical for PM tracking)
  created: timestamp('created').notNull(),
  updated: timestamp('updated').notNull(),
  dueDate: timestamp('dueDate'),
  resolutionDate: timestamp('resolutionDate'),
  
  // Agile data
  epicKey: varchar('epicKey', { length: 32 }),
  epicName: text('epicName'),
  storyPoints: integer('storyPoints'),
  sprint: json('sprint'), // Current sprint data
  sprintHistory: json('sprintHistory'), // All sprints this issue was in
  
  // Content and attachments
  labels: json('labels'),
  components: json('components'),
  fixVersions: json('fixVersions'),
  affectsVersions: json('affectsVersions'),
  attachments: json('attachments'),
  hasAttachments: boolean('hasAttachments').default(false),
  attachmentCount: integer('attachmentCount').default(0),
  
  // Links and dependencies
  issueLinks: json('issueLinks'),
  subtasks: json('subtasks'),
  parentKey: varchar('parentKey', { length: 32 }),
  
  // Comments and activity
  commentCount: integer('commentCount').default(0),
  hasComments: boolean('hasComments').default(false),
  watcherCount: integer('watcherCount').default(0),
  voteCount: integer('voteCount').default(0),
  
  // Custom fields (stored as JSON for flexibility)
  customFields: json('customFields'),
  
  // Workflow and tracking
  timeSpent: integer('timeSpent'), // seconds
  timeEstimate: integer('timeEstimate'), // seconds
  timeOriginalEstimate: integer('timeOriginalEstimate'), // seconds
  workRatio: integer('workRatio'), // percentage
  
  // URLs and metadata
  selfUrl: text('selfUrl'),
  browseUrl: text('browseUrl'),
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => ({
  workspaceIdIdx: index('jira_issue_workspace_id_idx').on(table.workspaceId),
  projectKeyIdx: index('jira_issue_project_key_idx').on(table.projectKey),
  keyWorkspaceIdx: uniqueIndex('jira_issue_key_workspace_idx').on(table.key, table.workspaceId),
}));

// Issue changelog for tracking changes (critical for PM insights)
export const jiraChangeLog = pgTable('JiraChangeLog', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  changeId: varchar('changeId', { length: 64 }).notNull(),
  issueKey: varchar('issueKey', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  
  // Change details
  field: varchar('field', { length: 64 }).notNull(), // status, assignee, priority, etc.
  fieldType: varchar('fieldType', { length: 32 }),
  fieldId: varchar('fieldId', { length: 64 }),
  fromValue: text('fromValue'),
  fromDisplayValue: text('fromDisplayValue'),
  toValue: text('toValue'),
  toDisplayValue: text('toDisplayValue'),
  
  // Who made the change
  authorAccountId: varchar('authorAccountId', { length: 128 }).notNull(),
  authorDisplayName: text('authorDisplayName'),
  
  // When
  created: timestamp('created').notNull(),
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => ({
  issueKeyIdx: index('jira_changelog_issue_key_idx').on(table.issueKey),
}));

// Issue comments
export const jiraComment = pgTable('JiraComment', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  commentId: varchar('commentId', { length: 64 }).notNull(),
  issueKey: varchar('issueKey', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  
  // Comment content
  body: text('body').notNull(),
  bodyFormat: varchar('bodyFormat', { length: 16 }).default('text'), // text, adf
  
  // Author
  authorAccountId: varchar('authorAccountId', { length: 128 }).notNull(),
  authorDisplayName: text('authorDisplayName'),
  
  // Timestamps
  created: timestamp('created').notNull(),
  updated: timestamp('updated').notNull(),
  
  // Visibility
  visibility: json('visibility'), // role/group restrictions
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => ({
  issueKeyIdx: index('jira_comment_issue_key_idx').on(table.issueKey),
}));

// Agile boards (Scrum/Kanban)
export const jiraBoard = pgTable('JiraBoard', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  boardId: integer('boardId').notNull(),
  name: text('name').notNull(),
  type: varchar('type', { length: 32 }).notNull(), // scrum, kanban
  selfUrl: text('selfUrl'),
  workspaceId: uuid('workspaceId').notNull(),
  
  // Board configuration
  location: json('location'), // project info
  filter: json('filter'), // JQL filter
  columnConfig: json('columnConfig'),
  estimationConfig: json('estimationConfig'),
  rankingConfig: json('rankingConfig'),
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
});

// Sprints (critical for PM reporting)
export const jiraSprint = pgTable('JiraSprint', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  sprintId: integer('sprintId').notNull(),
  name: text('name').notNull(),
  state: varchar('state', { length: 16 }).notNull(), // active, closed, future
  boardId: integer('boardId').notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  
  // Sprint details
  goal: text('goal'),
  startDate: timestamp('startDate'),
  endDate: timestamp('endDate'),
  completeDate: timestamp('completeDate'),
  originBoardId: integer('originBoardId'),
  
  // Sprint metrics (calculated during sync)
  issueCount: integer('issueCount').default(0),
  completedIssueCount: integer('completedIssueCount').default(0),
  puntedIssueCount: integer('puntedIssueCount').default(0),
  issueKeys: json('issueKeys'), // All issues in this sprint
  completedIssueKeys: json('completedIssueKeys'),
  puntedIssueKeys: json('puntedIssueKeys'),
  
  // URLs
  selfUrl: text('selfUrl'),
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => ({
  boardIdIdx: index('jira_sprint_board_id_idx').on(table.boardId),
}));

// Sync logging
export const jiraSyncLog = pgTable('JiraSyncLog', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  workspaceId: uuid('workspaceId').notNull(),
  syncType: varchar('syncType', { length: 32 }).notNull(), // full, incremental, project, etc.
  status: varchar('status', { length: 16 }).notNull(), // running, completed, failed
  
  // Timing
  startedAt: timestamp('startedAt').notNull(),
  completedAt: timestamp('completedAt'),
  duration: integer('duration'), // seconds
  
  // Results
  issuesProcessed: integer('issuesProcessed').default(0),
  projectsProcessed: integer('projectsProcessed').default(0),
  usersProcessed: integer('usersProcessed').default(0),
  boardsProcessed: integer('boardsProcessed').default(0),
  sprintsProcessed: integer('sprintsProcessed').default(0),
  changelogsProcessed: integer('changelogsProcessed').default(0),
  commentsProcessed: integer('commentsProcessed').default(0),
  
  // Error handling
  lastError: text('lastError'),
  errorCount: integer('errorCount').default(0),
  
  // Configuration
  syncScope: json('syncScope'), // which projects, date ranges, etc.
  metadata: json('metadata'),
  
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// Type exports
export type JiraWorkspace = typeof jiraWorkspace.$inferSelect;
export type JiraProject = typeof jiraProject.$inferSelect;
export type JiraUser = typeof jiraUser.$inferSelect;
export type JiraIssue = typeof jiraIssue.$inferSelect;
export type JiraChangeLog = typeof jiraChangeLog.$inferSelect;
export type JiraComment = typeof jiraComment.$inferSelect;
export type JiraBoard = typeof jiraBoard.$inferSelect;
export type JiraSprint = typeof jiraSprint.$inferSelect;
export type JiraSyncLog = typeof jiraSyncLog.$inferSelect; 