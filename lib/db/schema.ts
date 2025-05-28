import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  vector,
  index,
  integer,
  uniqueIndex,
  bigint,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

// Enhanced Slack Integration Tables with comprehensive message support
export const slackWorkspace = pgTable('SlackWorkspace', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  teamId: varchar('teamId', { length: 32 }).notNull().unique(),
  teamName: text('teamName').notNull(),
  teamDomain: text('teamDomain'),
  teamUrl: text('teamUrl'),
  accessToken: text('accessToken').notNull(),
  botUserId: varchar('botUserId', { length: 32 }),
  botAccessToken: text('botAccessToken'),
  scope: text('scope'),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  isActive: boolean('isActive').notNull().default(true),
  // Enhanced sync tracking
  syncStartDate: timestamp('syncStartDate'),
  lastSyncAt: timestamp('lastSyncAt'),
  lastFullSyncAt: timestamp('lastFullSyncAt'),
  totalChannels: varchar('totalChannels', { length: 16 }).default('0'),
  totalUsers: varchar('totalUsers', { length: 16 }).default('0'),
  totalMessages: varchar('totalMessages', { length: 16 }).default('0'),
  totalReactions: varchar('totalReactions', { length: 16 }).default('0'),
  totalThreads: varchar('totalThreads', { length: 16 }).default('0'),
  syncSettings: json('syncSettings'),
  permissions: json('permissions'), // Store bot permissions
  metadata: json('metadata'), // Full team info
});

export const slackUser = pgTable('SlackUser', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: varchar('userId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  username: text('username'),
  realName: text('realName'),
  displayName: text('displayName'),
  email: text('email'),
  title: text('title'),
  phone: text('phone'),
  skype: text('skype'),
  firstName: text('firstName'),
  lastName: text('lastName'),
  isBot: boolean('isBot').notNull().default(false),
  isAdmin: boolean('isAdmin').notNull().default(false),
  isOwner: boolean('isOwner').notNull().default(false),
  isPrimaryOwner: boolean('isPrimaryOwner').notNull().default(false),
  isRestricted: boolean('isRestricted').notNull().default(false),
  isUltraRestricted: boolean('isUltraRestricted').notNull().default(false),
  isDeleted: boolean('isDeleted').notNull().default(false),
  isStranger: boolean('isStranger').notNull().default(false),
  hasFiles: boolean('hasFiles').notNull().default(false),
  timezone: text('timezone'),
  timezoneLabel: text('timezoneLabel'),
  timezoneOffset: integer('timezoneOffset'),
  profileImage24: text('profileImage24'),
  profileImage32: text('profileImage32'),
  profileImage48: text('profileImage48'),
  profileImage72: text('profileImage72'),
  profileImage192: text('profileImage192'),
  profileImage512: text('profileImage512'),
  profileImage1024: text('profileImage1024'),
  profileImageOriginal: text('profileImageOriginal'),
  statusText: text('statusText'),
  statusEmoji: text('statusEmoji'),
  statusExpiration: timestamp('statusExpiration'),
  color: varchar('color', { length: 10 }),
  presence: varchar('presence', { length: 10 }), // active, away
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastActive: timestamp('lastActive'),
  metadata: json('metadata'),
}, (table) => [
  index('idx_slack_user_workspace').on(table.workspaceId),
  index('idx_slack_user_userid').on(table.userId),
  uniqueIndex('idx_slack_user_unique').on(table.userId, table.workspaceId),
]);

export const slackChannel = pgTable('SlackChannel', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameNormalized: text('nameNormalized'),
  purpose: text('purpose'),
  topic: text('topic'),
  creator: varchar('creator', { length: 32 }),
  isChannel: boolean('isChannel').notNull().default(true),
  isGroup: boolean('isGroup').notNull().default(false),
  isIm: boolean('isIm').notNull().default(false),
  isMpim: boolean('isMpim').notNull().default(false),
  isPrivate: boolean('isPrivate').notNull().default(false),
  isArchived: boolean('isArchived').notNull().default(false),
  isGeneral: boolean('isGeneral').notNull().default(false),
  isShared: boolean('isShared').notNull().default(false),
  isExtShared: boolean('isExtShared').notNull().default(false),
  isOrgShared: boolean('isOrgShared').notNull().default(false),
  isMember: boolean('isMember').notNull().default(false),
  memberCount: integer('memberCount').default(0),
  unlinked: integer('unlinked').default(0),
  createdTimestamp: varchar('createdTimestamp', { length: 32 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastMessageAt: timestamp('lastMessageAt'),
  lastSyncAt: timestamp('lastSyncAt'),
  metadata: json('metadata'),
}, (table) => [
  index('idx_slack_channel_workspace').on(table.workspaceId),
  index('idx_slack_channel_channelid').on(table.channelId),
  uniqueIndex('idx_slack_channel_unique').on(table.channelId, table.workspaceId),
]);

export const slackMessage = pgTable('SlackMessage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: varchar('messageId', { length: 64 }).notNull(), // Using ts as messageId
  channelId: varchar('channelId', { length: 32 }).notNull(),
  channelName: text('channelName'),
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  userDisplayName: text('userDisplayName'),
  text: text('text'),
  timestamp: varchar('timestamp', { length: 32 }).notNull(),
  messageType: varchar('messageType', { length: 32 }).notNull().default('message'),
  subtype: varchar('subtype', { length: 32 }),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  // Thread support
  threadTs: varchar('threadTs', { length: 32 }),
  parentUserId: varchar('parentUserId', { length: 32 }),
  replyCount: integer('replyCount').default(0),
  replyUsersCount: integer('replyUsersCount').default(0),
  latestReply: varchar('latestReply', { length: 32 }),
  isThreadReply: boolean('isThreadReply').notNull().default(false),
  // File and attachment support
  hasFiles: boolean('hasFiles').notNull().default(false),
  hasAttachments: boolean('hasAttachments').notNull().default(false),
  fileCount: integer('fileCount').default(0),
  // Message state
  isEdited: boolean('isEdited').notNull().default(false),
  isDeleted: boolean('isDeleted').notNull().default(false),
  editedTs: varchar('editedTs', { length: 32 }),
  deletedTs: varchar('deletedTs', { length: 32 }),
  // Rich content
  blocks: json('blocks'), // Slack Block Kit content
  attachments: json('attachments'), // Legacy attachments
  reactions: json('reactions'), // Message reactions summary
  reactionCount: integer('reactionCount').default(0),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  slackCreatedAt: timestamp('slackCreatedAt'),
  slackUpdatedAt: timestamp('slackUpdatedAt'),
  // Full message metadata
  metadata: json('metadata'),
}, (table) => [
  index('idx_slack_message_workspace').on(table.workspaceId),
  index('idx_slack_message_channel').on(table.channelId),
  index('idx_slack_message_user').on(table.userId),
  index('idx_slack_message_timestamp').on(table.timestamp),
  index('idx_slack_message_thread').on(table.threadTs),
  uniqueIndex('idx_slack_message_unique').on(table.messageId, table.workspaceId),
]);

// New table for individual message reactions
export const slackReaction = pgTable('SlackReaction', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: uuid('messageId')
    .notNull()
    .references(() => slackMessage.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  emoji: varchar('emoji', { length: 64 }).notNull(),
  emojiUnicode: text('emojiUnicode'),
  count: integer('count').notNull().default(1),
  users: json('users').notNull(), // Array of user IDs who reacted
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('idx_slack_reaction_message').on(table.messageId),
  index('idx_slack_reaction_workspace').on(table.workspaceId),
  uniqueIndex('idx_slack_reaction_unique').on(table.messageId, table.emoji),
]);

// Enhanced file table with better content extraction
export const slackFile = pgTable('SlackFile', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  fileId: varchar('fileId', { length: 32 }).notNull().unique(),
  name: text('name').notNull(),
  title: text('title'),
  mimetype: varchar('mimetype', { length: 128 }),
  filetype: varchar('filetype', { length: 32 }),
  prettyType: text('prettyType'),
  size: bigint('size', { mode: 'number' }),
  mode: varchar('mode', { length: 32 }),
  isExternal: boolean('isExternal').notNull().default(false),
  externalType: varchar('externalType', { length: 32 }),
  isStarred: boolean('isStarred').notNull().default(false),
  isPublic: boolean('isPublic').notNull().default(false),
  publicUrlShared: boolean('publicUrlShared').notNull().default(false),
  displayAsBot: boolean('displayAsBot').notNull().default(false),
  // URLs
  urlPrivate: text('urlPrivate'),
  urlPrivateDownload: text('urlPrivateDownload'),
  permalink: text('permalink'),
  permalinkPublic: text('permalinkPublic'),
  thumb64: text('thumb64'),
  thumb80: text('thumb80'),
  thumb160: text('thumb160'),
  thumb360: text('thumb360'),
  thumb480: text('thumb480'),
  thumb720: text('thumb720'),
  thumb800: text('thumb800'),
  thumb960: text('thumb960'),
  thumb1024: text('thumb1024'),
  // Content and processing
  content: text('content'), // Extracted text content
  preview: text('preview'), // File preview text
  plainText: text('plainText'), // Plain text version
  previewHighlight: text('previewHighlight'),
  lines: integer('lines'),
  linesMore: integer('linesMore'),
  hasRichPreview: boolean('hasRichPreview').notNull().default(false),
  // User and workspace info
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  messageId: uuid('messageId').references(() => slackMessage.id, { onDelete: 'set null' }),
  channelId: varchar('channelId', { length: 32 }),
  channelName: text('channelName'),
  // Processing status
  isProcessed: boolean('isProcessed').notNull().default(false),
  processingError: text('processingError'),
  extractedAt: timestamp('extractedAt'),
  downloadedAt: timestamp('downloadedAt'),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  slackCreatedAt: timestamp('slackCreatedAt'),
  slackUpdatedAt: timestamp('slackUpdatedAt'),
  // Metadata
  metadata: json('metadata'),
}, (table) => [
  index('idx_slack_file_workspace').on(table.workspaceId),
  index('idx_slack_file_user').on(table.userId),
  index('idx_slack_file_message').on(table.messageId),
  index('idx_slack_file_channel').on(table.channelId),
]);

// New table for tracking conversation members
export const slackChannelMember = pgTable('SlackChannelMember', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  userId: varchar('userId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  isAdmin: boolean('isAdmin').notNull().default(false),
  dateJoined: timestamp('dateJoined'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('idx_slack_channel_member_channel').on(table.channelId),
  index('idx_slack_channel_member_user').on(table.userId),
  index('idx_slack_channel_member_workspace').on(table.workspaceId),
  uniqueIndex('idx_slack_channel_member_unique').on(table.channelId, table.userId, table.workspaceId),
]);

// New table for sync status tracking
export const slackSyncLog = pgTable('SlackSyncLog', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id, { onDelete: 'cascade' }),
  syncType: varchar('syncType', { length: 32 }).notNull(), // 'full', 'incremental', 'backfill'
  status: varchar('status', { length: 32 }).notNull(), // 'running', 'completed', 'failed', 'paused'
  startedAt: timestamp('startedAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
  duration: integer('duration'), // seconds
  // Sync metrics
  channelsProcessed: integer('channelsProcessed').default(0),
  messagesProcessed: integer('messagesProcessed').default(0),
  filesProcessed: integer('filesProcessed').default(0),
  reactionsProcessed: integer('reactionsProcessed').default(0),
  threadsProcessed: integer('threadsProcessed').default(0),
  // Error tracking
  errorCount: integer('errorCount').default(0),
  lastError: text('lastError'),
  // Progress tracking
  progress: json('progress'),
  dateRange: json('dateRange'), // {from, to} timestamps
  channelFilter: json('channelFilter'), // Selected channels
  configuration: json('configuration'), // Sync settings
  metadata: json('metadata'),
}, (table) => [
  index('idx_slack_sync_log_workspace').on(table.workspaceId),
  index('idx_slack_sync_log_status').on(table.status),
  index('idx_slack_sync_log_started').on(table.startedAt),
]);

// Export types for all Slack tables
export type SlackWorkspace = InferSelectModel<typeof slackWorkspace>;
export type SlackUser = InferSelectModel<typeof slackUser>;
export type SlackChannel = InferSelectModel<typeof slackChannel>;
export type SlackMessage = InferSelectModel<typeof slackMessage>;
export type SlackFile = InferSelectModel<typeof slackFile>;

// Vector embeddings for Slack messages (RAG)
export const slackMessageEmbedding = pgTable('SlackMessageEmbedding', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: uuid('messageId')
    .notNull()
    .references(() => slackMessage.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id),
  content: text('content').notNull(), // The message text that was embedded
  contextInfo: json('contextInfo').notNull(), // Channel name, username, timestamp, etc.
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-ada-002 dimension
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  // Create vector similarity index for fast retrieval
  index('slack_embedding_cosine_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

export type SlackMessageEmbedding = InferSelectModel<typeof slackMessageEmbedding>;
