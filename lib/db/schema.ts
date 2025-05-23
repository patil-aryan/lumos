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

// Slack Integration Tables
export const slackWorkspace = pgTable('SlackWorkspace', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  teamId: varchar('teamId', { length: 32 }).notNull().unique(),
  teamName: text('teamName').notNull(),
  accessToken: text('accessToken').notNull(),
  botUserId: varchar('botUserId', { length: 32 }),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  isActive: boolean('isActive').notNull().default(true),
});

export type SlackWorkspace = InferSelectModel<typeof slackWorkspace>;

export const slackMessage = pgTable('SlackMessage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  messageId: varchar('messageId', { length: 64 }).notNull(),
  channelId: varchar('channelId', { length: 32 }).notNull(),
  channelName: text('channelName'),
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  text: text('text'),
  timestamp: varchar('timestamp', { length: 32 }).notNull(),
  messageType: varchar('messageType', { length: 16 }).notNull().default('message'),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id),
  threadTs: varchar('threadTs', { length: 32 }),
  hasFiles: boolean('hasFiles').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  metadata: json('metadata'),
});

export type SlackMessage = InferSelectModel<typeof slackMessage>;

export const slackFile = pgTable('SlackFile', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  fileId: varchar('fileId', { length: 32 }).notNull().unique(),
  name: text('name').notNull(),
  title: text('title'),
  mimetype: varchar('mimetype', { length: 128 }),
  filetype: varchar('filetype', { length: 32 }),
  size: varchar('size', { length: 32 }),
  urlPrivate: text('urlPrivate'),
  content: text('content'), // extracted text content
  userId: varchar('slackUserId', { length: 32 }).notNull(),
  userName: text('userName'),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => slackWorkspace.id),
  messageId: uuid('messageId').references(() => slackMessage.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  extractedAt: timestamp('extractedAt'),
  metadata: json('metadata'),
});

export type SlackFile = InferSelectModel<typeof slackFile>;
