import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not defined');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function migrateSlackTables() {
  console.log('🚀 Starting Slack tables migration...');

  try {
    // Create SlackWorkspace table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackWorkspace" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teamId" varchar(32) UNIQUE NOT NULL,
        "teamName" text NOT NULL,
        "teamDomain" text,
        "teamUrl" text,
        "accessToken" text NOT NULL,
        "botUserId" varchar(32),
        "botAccessToken" text,
        "scope" text,
        "userId" uuid NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "isActive" boolean DEFAULT true NOT NULL,
        "syncStartDate" timestamp,
        "lastSyncAt" timestamp,
        "lastFullSyncAt" timestamp,
        "totalChannels" varchar(16) DEFAULT '0',
        "totalUsers" varchar(16) DEFAULT '0',
        "totalMessages" varchar(16) DEFAULT '0',
        "totalReactions" varchar(16) DEFAULT '0',
        "totalThreads" varchar(16) DEFAULT '0',
        "syncSettings" json,
        "permissions" json,
        "metadata" json
      );
    `);

    // Create SlackUser table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackUser" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "userId" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "username" text,
        "realName" text,
        "displayName" text,
        "email" text,
        "title" text,
        "phone" text,
        "skype" text,
        "firstName" text,
        "lastName" text,
        "isBot" boolean DEFAULT false NOT NULL,
        "isAdmin" boolean DEFAULT false NOT NULL,
        "isOwner" boolean DEFAULT false NOT NULL,
        "isPrimaryOwner" boolean DEFAULT false NOT NULL,
        "isRestricted" boolean DEFAULT false NOT NULL,
        "isUltraRestricted" boolean DEFAULT false NOT NULL,
        "isDeleted" boolean DEFAULT false NOT NULL,
        "isStranger" boolean DEFAULT false NOT NULL,
        "hasFiles" boolean DEFAULT false NOT NULL,
        "timezone" text,
        "timezoneLabel" text,
        "timezoneOffset" integer,
        "profileImage24" text,
        "profileImage32" text,
        "profileImage48" text,
        "profileImage72" text,
        "profileImage192" text,
        "profileImage512" text,
        "profileImage1024" text,
        "profileImageOriginal" text,
        "statusText" text,
        "statusEmoji" text,
        "statusExpiration" timestamp,
        "color" varchar(10),
        "presence" varchar(10),
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastActive" timestamp,
        "metadata" json,
        UNIQUE("userId", "workspaceId")
      );
    `);

    // Create SlackChannel table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackChannel" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channelId" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "name" text NOT NULL,
        "nameNormalized" text,
        "purpose" text,
        "topic" text,
        "creator" varchar(32),
        "isChannel" boolean DEFAULT true NOT NULL,
        "isGroup" boolean DEFAULT false NOT NULL,
        "isIm" boolean DEFAULT false NOT NULL,
        "isMpim" boolean DEFAULT false NOT NULL,
        "isPrivate" boolean DEFAULT false NOT NULL,
        "isArchived" boolean DEFAULT false NOT NULL,
        "isGeneral" boolean DEFAULT false NOT NULL,
        "isShared" boolean DEFAULT false NOT NULL,
        "isExtShared" boolean DEFAULT false NOT NULL,
        "isOrgShared" boolean DEFAULT false NOT NULL,
        "isMember" boolean DEFAULT false NOT NULL,
        "memberCount" integer DEFAULT 0,
        "unlinked" integer DEFAULT 0,
        "createdTimestamp" varchar(32),
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastMessageAt" timestamp,
        "lastSyncAt" timestamp,
        "metadata" json,
        UNIQUE("channelId", "workspaceId")
      );
    `);

    // Create SlackMessage table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackMessage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "messageId" varchar(64) NOT NULL,
        "channelId" varchar(32) NOT NULL,
        "channelName" text,
        "slackUserId" varchar(32) NOT NULL,
        "userName" text,
        "userDisplayName" text,
        "text" text,
        "timestamp" varchar(32) NOT NULL,
        "messageType" varchar(32) DEFAULT 'message' NOT NULL,
        "subtype" varchar(32),
        "workspaceId" uuid NOT NULL,
        "threadTs" varchar(32),
        "parentUserId" varchar(32),
        "replyCount" integer DEFAULT 0,
        "replyUsersCount" integer DEFAULT 0,
        "latestReply" varchar(32),
        "isThreadReply" boolean DEFAULT false NOT NULL,
        "hasFiles" boolean DEFAULT false NOT NULL,
        "hasAttachments" boolean DEFAULT false NOT NULL,
        "fileCount" integer DEFAULT 0,
        "isEdited" boolean DEFAULT false NOT NULL,
        "isDeleted" boolean DEFAULT false NOT NULL,
        "editedTs" varchar(32),
        "deletedTs" varchar(32),
        "blocks" json,
        "attachments" json,
        "reactions" json,
        "reactionCount" integer DEFAULT 0,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "slackCreatedAt" timestamp,
        "slackUpdatedAt" timestamp,
        "metadata" json,
        UNIQUE("messageId", "workspaceId")
      );
    `);

    // Create SlackReaction table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackReaction" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "messageId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "channelId" varchar(32) NOT NULL,
        "emoji" varchar(64) NOT NULL,
        "emojiUnicode" text,
        "count" integer DEFAULT 1 NOT NULL,
        "users" json NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        UNIQUE("messageId", "emoji")
      );
    `);

    // Create SlackFile table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackFile" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "fileId" varchar(32) UNIQUE NOT NULL,
        "name" text NOT NULL,
        "title" text,
        "mimetype" varchar(128),
        "filetype" varchar(32),
        "prettyType" text,
        "size" bigint,
        "mode" varchar(32),
        "isExternal" boolean DEFAULT false NOT NULL,
        "externalType" varchar(32),
        "isStarred" boolean DEFAULT false NOT NULL,
        "isPublic" boolean DEFAULT false NOT NULL,
        "publicUrlShared" boolean DEFAULT false NOT NULL,
        "displayAsBot" boolean DEFAULT false NOT NULL,
        "urlPrivate" text,
        "urlPrivateDownload" text,
        "permalink" text,
        "permalinkPublic" text,
        "thumb64" text,
        "thumb80" text,
        "thumb160" text,
        "thumb360" text,
        "thumb480" text,
        "thumb720" text,
        "thumb800" text,
        "thumb960" text,
        "thumb1024" text,
        "content" text,
        "preview" text,
        "plainText" text,
        "previewHighlight" text,
        "lines" integer,
        "linesMore" integer,
        "hasRichPreview" boolean DEFAULT false NOT NULL,
        "slackUserId" varchar(32) NOT NULL,
        "userName" text,
        "workspaceId" uuid NOT NULL,
        "messageId" uuid,
        "channelId" varchar(32),
        "channelName" text,
        "isProcessed" boolean DEFAULT false NOT NULL,
        "processingError" text,
        "extractedAt" timestamp,
        "downloadedAt" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "slackCreatedAt" timestamp,
        "slackUpdatedAt" timestamp,
        "metadata" json
      );
    `);

    // Create SlackChannelMember table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackChannelMember" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channelId" varchar(32) NOT NULL,
        "userId" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "isAdmin" boolean DEFAULT false NOT NULL,
        "dateJoined" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        UNIQUE("channelId", "userId", "workspaceId")
      );
    `);

    // Create SlackSyncLog table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "SlackSyncLog" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspaceId" uuid NOT NULL,
        "syncType" varchar(32) NOT NULL,
        "status" varchar(32) NOT NULL,
        "startedAt" timestamp DEFAULT now() NOT NULL,
        "completedAt" timestamp,
        "duration" integer,
        "channelsProcessed" integer DEFAULT 0,
        "messagesProcessed" integer DEFAULT 0,
        "filesProcessed" integer DEFAULT 0,
        "reactionsProcessed" integer DEFAULT 0,
        "threadsProcessed" integer DEFAULT 0,
        "errorCount" integer DEFAULT 0,
        "lastError" text,
        "progress" json,
        "dateRange" json,
        "channelFilter" json,
        "configuration" json,
        "metadata" json
      );
    `);

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_user_workspace" ON "SlackUser"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_user_userid" ON "SlackUser"("userId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_channel_workspace" ON "SlackChannel"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_channel_channelid" ON "SlackChannel"("channelId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_message_workspace" ON "SlackMessage"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_message_channel" ON "SlackMessage"("channelId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_message_user" ON "SlackMessage"("slackUserId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_message_timestamp" ON "SlackMessage"("timestamp");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_message_thread" ON "SlackMessage"("threadTs");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_reaction_message" ON "SlackReaction"("messageId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_reaction_workspace" ON "SlackReaction"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_file_workspace" ON "SlackFile"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_file_user" ON "SlackFile"("slackUserId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_file_message" ON "SlackFile"("messageId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_file_channel" ON "SlackFile"("channelId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_channel_member_channel" ON "SlackChannelMember"("channelId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_channel_member_user" ON "SlackChannelMember"("userId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_channel_member_workspace" ON "SlackChannelMember"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_sync_log_workspace" ON "SlackSyncLog"("workspaceId");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_sync_log_status" ON "SlackSyncLog"("status");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_slack_sync_log_started" ON "SlackSyncLog"("startedAt");`);

    console.log('✅ Slack tables migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during Slack tables migration:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateSlackTables()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateSlackTables }; 