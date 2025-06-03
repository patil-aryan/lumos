import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import type { InferSelectModel } from 'drizzle-orm';

// Confluence Workspace (site/organization)
export const confluenceWorkspace = pgTable('confluence_workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // User who connected this workspace
  cloudId: text('cloud_id').notNull().unique(), // Atlassian cloud ID
  name: text('name').notNull(), // Site name
  url: text('url').notNull(), // Site URL
  scopes: text('scopes'), // Granted OAuth scopes
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'), // Additional site metadata
  
  // Sync tracking
  lastSyncAt: timestamp('last_sync_at'),
  lastFullSyncAt: timestamp('last_full_sync_at'),
  totalSpaces: integer('total_spaces').default(0),
  totalPages: integer('total_pages').default(0),
  totalBlogPosts: integer('total_blog_posts').default(0),
  totalUsers: integer('total_users').default(0),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('confluence_workspace_user_id_idx').on(table.userId),
  cloudIdIdx: index('confluence_workspace_cloud_id_idx').on(table.cloudId),
}));

// Confluence Spaces
export const confluenceSpace = pgTable('confluence_space', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => confluenceWorkspace.id, { onDelete: 'cascade' }),
  spaceId: text('space_id').notNull(), // Confluence space ID
  key: text('key').notNull(), // Space key (unique identifier)
  name: text('name').notNull(),
  description: text('description'),
  type: text('type'), // 'global', 'personal', etc.
  status: text('status'), // 'current', 'archived'
  homepageId: text('homepage_id'), // ID of the homepage
  
  // Metadata
  metadata: jsonb('metadata'),
  permissions: jsonb('permissions'), // Space permissions
  
  // Analytics
  pageCount: integer('page_count').default(0),
  blogPostCount: integer('blog_post_count').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
}, (table) => ({
  workspaceSpaceIdx: index('confluence_space_workspace_space_idx').on(table.workspaceId, table.spaceId),
  keyIdx: index('confluence_space_key_idx').on(table.key),
}));

// Confluence Pages
export const confluencePage = pgTable('confluence_page', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => confluenceWorkspace.id, { onDelete: 'cascade' }),
  spaceId: uuid('space_id').notNull().references(() => confluenceSpace.id, { onDelete: 'cascade' }),
  
  pageId: text('page_id').notNull(), // Confluence page ID
  title: text('title').notNull(),
  type: text('type').notNull(), // 'page', 'blogpost', 'comment'
  status: text('status'), // 'current', 'trashed', 'deleted'
  
  // Content
  content: text('content'), // Extracted text content
  contentHtml: text('content_html'), // HTML content
  excerpt: text('excerpt'), // Short excerpt
  
  // Hierarchy
  parentId: text('parent_id'), // Parent page ID
  position: integer('position'), // Position in hierarchy
  
  // Authors and contributors
  authorId: text('author_id'),
  authorDisplayName: text('author_display_name'),
  lastModifierId: text('last_modifier_id'),
  lastModifierDisplayName: text('last_modifier_display_name'),
  
  // Metadata
  labels: jsonb('labels'), // Page labels/tags
  metadata: jsonb('metadata'),
  restrictions: jsonb('restrictions'), // Read/write restrictions
  
  // URLs and links
  webUrl: text('web_url'),
  editUrl: text('edit_url'),
  
  // Analytics
  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  commentCount: integer('comment_count').default(0),
  
  // Version info
  version: integer('version').default(1),
  versionMessage: text('version_message'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  publishedAt: timestamp('published_at'),
  lastSyncAt: timestamp('last_sync_at'),
}, (table) => ({
  workspacePageIdx: index('confluence_page_workspace_page_idx').on(table.workspaceId, table.pageId),
  spaceIdx: index('confluence_page_space_idx').on(table.spaceId),
  authorIdx: index('confluence_page_author_idx').on(table.authorId),
  titleIdx: index('confluence_page_title_idx').on(table.title),
  typeIdx: index('confluence_page_type_idx').on(table.type),
  statusIdx: index('confluence_page_status_idx').on(table.status),
}));

// Confluence Users
export const confluenceUser = pgTable('confluence_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => confluenceWorkspace.id, { onDelete: 'cascade' }),
  
  accountId: text('account_id').notNull(), // Atlassian account ID
  displayName: text('display_name').notNull(),
  emailAddress: text('email_address'),
  accountType: text('account_type'), // 'atlassian', 'app', etc.
  active: boolean('active').default(true),
  
  // Profile
  profilePicture: text('profile_picture'),
  timeZone: text('time_zone'),
  locale: text('locale'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
}, (table) => ({
  workspaceAccountIdx: index('confluence_user_workspace_account_idx').on(table.workspaceId, table.accountId),
  displayNameIdx: index('confluence_user_display_name_idx').on(table.displayName),
}));

// Confluence Comments
export const confluenceComment = pgTable('confluence_comment', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => confluenceWorkspace.id, { onDelete: 'cascade' }),
  pageId: uuid('page_id').notNull().references(() => confluencePage.id, { onDelete: 'cascade' }),
  
  commentId: text('comment_id').notNull(), // Confluence comment ID
  content: text('content'),
  contentHtml: text('content_html'),
  
  // Author
  authorId: text('author_id'),
  authorDisplayName: text('author_display_name'),
  
  // Hierarchy (for threaded comments)
  parentCommentId: text('parent_comment_id'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
}, (table) => ({
  workspaceCommentIdx: index('confluence_comment_workspace_comment_idx').on(table.workspaceId, table.commentId),
  pageIdx: index('confluence_comment_page_idx').on(table.pageId),
  authorIdx: index('confluence_comment_author_idx').on(table.authorId),
}));

// Confluence Sync Logs
export const confluenceSyncLog = pgTable('confluence_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => confluenceWorkspace.id, { onDelete: 'cascade' }),
  
  syncType: text('sync_type').notNull(), // 'full', 'incremental', 'spaces', 'pages'
  status: text('status').notNull(), // 'running', 'completed', 'failed', 'cancelled'
  
  // Progress tracking
  totalItems: integer('total_items').default(0),
  processedItems: integer('processed_items').default(0),
  successfulItems: integer('successful_items').default(0),
  failedItems: integer('failed_items').default(0),
  
  // Results
  results: jsonb('results'),
  errors: jsonb('errors'),
  
  // Timestamps
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // Duration in seconds
}, (table) => ({
  workspaceIdx: index('confluence_sync_log_workspace_idx').on(table.workspaceId),
  statusIdx: index('confluence_sync_log_status_idx').on(table.status),
  startedAtIdx: index('confluence_sync_log_started_at_idx').on(table.startedAt),
}));

// Export types
export type ConfluenceWorkspace = InferSelectModel<typeof confluenceWorkspace>;
export type ConfluenceSpace = InferSelectModel<typeof confluenceSpace>;
export type ConfluencePage = InferSelectModel<typeof confluencePage>;
export type ConfluenceUser = InferSelectModel<typeof confluenceUser>;
export type ConfluenceComment = InferSelectModel<typeof confluenceComment>;
export type ConfluenceSyncLog = InferSelectModel<typeof confluenceSyncLog>; 