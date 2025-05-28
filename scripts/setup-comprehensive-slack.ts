import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Load environment variables
import 'dotenv/config';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not defined');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

export async function setupComprehensiveSlack() {
  console.log('🚀 Setting up Comprehensive Slack Integration...');

  try {
    // 1. Drop existing Slack tables if they exist (in correct order)
    console.log('Cleaning up existing Slack tables...');
    
    await db.execute(sql`DROP TABLE IF EXISTS "SlackReaction" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackFile" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackMessage" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackChannelMember" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackChannel" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackUser" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackSyncLog" CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS "SlackWorkspace" CASCADE;`);

    console.log('✅ Existing tables cleaned up');

    // 2. Create new comprehensive Slack tables
    console.log('Creating new Slack tables...');

    // SlackWorkspace table
    await db.execute(sql`
      CREATE TABLE "SlackWorkspace" (
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

    // SlackUser table
    await db.execute(sql`
      CREATE TABLE "SlackUser" (
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
        UNIQUE("userId", "workspaceId"),
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    // SlackChannel table
    await db.execute(sql`
      CREATE TABLE "SlackChannel" (
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
        UNIQUE("channelId", "workspaceId"),
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    // SlackMessage table
    await db.execute(sql`
      CREATE TABLE "SlackMessage" (
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
        UNIQUE("messageId", "workspaceId"),
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    // SlackReaction table
    await db.execute(sql`
      CREATE TABLE "SlackReaction" (
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
        UNIQUE("messageId", "emoji"),
        FOREIGN KEY ("messageId") REFERENCES "SlackMessage"("id") ON DELETE CASCADE,
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    // SlackFile table
    await db.execute(sql`
      CREATE TABLE "SlackFile" (
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
        "metadata" json,
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE,
        FOREIGN KEY ("messageId") REFERENCES "SlackMessage"("id") ON DELETE SET NULL
      );
    `);

    // SlackChannelMember table
    await db.execute(sql`
      CREATE TABLE "SlackChannelMember" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channelId" varchar(32) NOT NULL,
        "userId" varchar(32) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "isAdmin" boolean DEFAULT false NOT NULL,
        "dateJoined" timestamp,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        UNIQUE("channelId", "userId", "workspaceId"),
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    // SlackSyncLog table
    await db.execute(sql`
      CREATE TABLE "SlackSyncLog" (
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
        "metadata" json,
        FOREIGN KEY ("workspaceId") REFERENCES "SlackWorkspace"("id") ON DELETE CASCADE
      );
    `);

    console.log('✅ Tables created successfully');

    // 3. Create indexes for performance
    console.log('Creating indexes...');

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

    console.log('✅ Indexes created successfully');

    console.log('🎉 Comprehensive Slack Integration setup completed!');
    console.log('\nWhat was set up:');
    console.log('- SlackWorkspace: Team information and access tokens');
    console.log('- SlackUser: Complete user profiles with presence and status');
    console.log('- SlackChannel: All conversation types (channels, groups, DMs)');
    console.log('- SlackMessage: Messages with threading, reactions, and files');
    console.log('- SlackReaction: Individual reaction data with user details');
    console.log('- SlackFile: File metadata with content extraction support');
    console.log('- SlackChannelMember: Channel membership data');
    console.log('- SlackSyncLog: Sync history and progress tracking');
    console.log('\nYou can now:');
    console.log('1. Connect your Slack workspace');
    console.log('2. Run comprehensive sync to extract all data');
    console.log('3. Use the modern UI to view and manage your Slack data');

    return { success: true };

  } catch (error) {
    console.error('❌ Error setting up Comprehensive Slack Integration:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupComprehensiveSlack()
    .then(() => {
      console.log('\n✅ Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
} 