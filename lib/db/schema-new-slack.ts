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
  userId: uuid('userId').notNull(),
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
  permissions: json('permissions'),
  metadata: json('metadata'),
});

export const slackUser = pgTable('SlackUser', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: varchar('userId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
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
  presence: varchar('presence', { length: 10 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastActive: timestamp('lastActive'),
  metadata: json('metadata'),
});

export const slackChannel = pgTable('SlackChannel', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
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
});

export const slackMessage = pgTable('SlackMessage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: varchar('messageId', { length: 64 }).notNull(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  channelName: text('channelName'),
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  userDisplayName: text('userDisplayName'),
  text: text('text'),
  timestamp: varchar('timestamp', { length: 32 }).notNull(),
  messageType: varchar('messageType', { length: 32 }).notNull().default('message'),
  subtype: varchar('subtype', { length: 32 }),
  workspaceId: uuid('workspaceId').notNull(),
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
  blocks: json('blocks'),
  attachments: json('attachments'),
  reactions: json('reactions'),
  reactionCount: integer('reactionCount').default(0),
  // Timestamps
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  slackCreatedAt: timestamp('slackCreatedAt'),
  slackUpdatedAt: timestamp('slackUpdatedAt'),
  metadata: json('metadata'),
});

// New table for individual message reactions
export const slackReaction = pgTable('SlackReaction', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: uuid('messageId').notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  emoji: varchar('emoji', { length: 64 }).notNull(),
  emojiUnicode: text('emojiUnicode'),
  count: integer('count').notNull().default(1),
  users: json('users').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// Enhanced file table
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
  content: text('content'),
  preview: text('preview'),
  plainText: text('plainText'),
  previewHighlight: text('previewHighlight'),
  lines: integer('lines'),
  linesMore: integer('linesMore'),
  hasRichPreview: boolean('hasRichPreview').notNull().default(false),
  // User and workspace info
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  workspaceId: uuid('workspaceId').notNull(),
  messageId: uuid('messageId'),
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
  metadata: json('metadata'),
});

// Table for tracking conversation members
export const slackChannelMember = pgTable('SlackChannelMember', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  userId: varchar('userId', { length: 32 }).notNull(),
  workspaceId: uuid('workspaceId').notNull(),
  isAdmin: boolean('isAdmin').notNull().default(false),
  dateJoined: timestamp('dateJoined'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// Table for sync status tracking
export const slackSyncLog = pgTable('SlackSyncLog', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  workspaceId: uuid('workspaceId').notNull(),
  syncType: varchar('syncType', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  startedAt: timestamp('startedAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
  duration: integer('duration'),
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
  dateRange: json('dateRange'),
  channelFilter: json('channelFilter'),
  configuration: json('configuration'),
  metadata: json('metadata'),
});

// Export types
export type SlackWorkspace = typeof slackWorkspace.$inferSelect;
export type SlackUser = typeof slackUser.$inferSelect;
export type SlackChannel = typeof slackChannel.$inferSelect;
export type SlackMessage = typeof slackMessage.$inferSelect;
export type SlackReaction = typeof slackReaction.$inferSelect;
export type SlackFile = typeof slackFile.$inferSelect;
export type SlackChannelMember = typeof slackChannelMember.$inferSelect;
export type SlackSyncLog = typeof slackSyncLog.$inferSelect; 