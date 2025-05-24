import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  slackWorkspace, 
  slackMessage, 
  slackFile, 
  slackUser,
  slackChannel,
  type SlackWorkspace, 
  type SlackMessage as DBSlackMessage, 
  type SlackFile,
  type SlackUser,
  type SlackChannel
} from '@/lib/db/schema';
import { eq, and, desc, gte, count, countDistinct, sql } from 'drizzle-orm';
import type { SlackMessage, SlackOAuthResponse } from './client';

// Initialize database connection with shorter timeouts and retry logic
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

function createConnection() {
  if (client) {
    try {
      client.end();
    } catch (error) {
      // Ignore errors when closing old connection
    }
  }
  
  client = postgres(process.env.POSTGRES_URL || '', {
    idle_timeout: 20, // 20 seconds
    connect_timeout: 10, // 10 seconds
    max_lifetime: 60 * 10, // 10 minutes
    max: 1, // Single connection for sync operations
  });
  
  db = drizzle(client);
  return db;
}

// Initialize connection
createConnection();

// Helper to retry database operations with fresh connection
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.log(`Database operation attempt ${attempt} failed:`, error?.code || error?.message);
      
      if (error?.code === 'CONNECTION_CLOSED' || error?.code === 'ECONNRESET' || error?.errno === 'CONNECTION_CLOSED') {
        if (attempt < maxRetries) {
          console.log(`🔄 Recreating database connection (attempt ${attempt + 1}/${maxRetries})`);
          createConnection();
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

export class SlackDatabaseService {
  static async createWorkspace(
    userId: string, 
    oauthData: SlackOAuthResponse
  ): Promise<SlackWorkspace> {
    const [workspace] = await db
      .insert(slackWorkspace)
      .values({
        teamId: oauthData.team.id,
        teamName: oauthData.team.name,
        accessToken: oauthData.access_token,
        botUserId: oauthData.bot_user_id,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Set sync start date to 6 months ago
        syncStartDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6 months ago
      })
      .returning();

    return workspace;
  }

  static async updateWorkspaceToken(workspaceId: string, token: string): Promise<void> {
    await db
      .update(slackWorkspace)
      .set({ 
        accessToken: token,
        updatedAt: new Date()
      })
      .where(eq(slackWorkspace.id, workspaceId));
  }

  static async updateWorkspaceUserId(workspaceId: string, userId: string): Promise<void> {
    await db
      .update(slackWorkspace)
      .set({ 
        userId: userId,
        updatedAt: new Date()
      })
      .where(eq(slackWorkspace.id, workspaceId));
  }

  static async updateWorkspaceSyncStatus(
    workspaceId: string, 
    stats: { totalChannels: number; totalUsers: number }
  ): Promise<void> {
    await db
      .update(slackWorkspace)
      .set({ 
        lastSyncAt: new Date(),
        totalChannels: stats.totalChannels.toString(),
        totalUsers: stats.totalUsers.toString(),
        updatedAt: new Date()
      })
      .where(eq(slackWorkspace.id, workspaceId));
  }

  static async getWorkspaceByTeamId(teamId: string): Promise<SlackWorkspace | null> {
    const [workspace] = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.teamId, teamId))
      .limit(1);

    return workspace || null;
  }

  static async getWorkspacesByUserId(userId: string): Promise<SlackWorkspace[]> {
    return await db
      .select()
      .from(slackWorkspace)
      .where(and(
        eq(slackWorkspace.userId, userId),
        eq(slackWorkspace.isActive, true)
      ))
      .orderBy(desc(slackWorkspace.createdAt));
  }

  // User management
  static async saveUser(userInfo: any, workspaceId: string): Promise<SlackUser> {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(slackUser)
      .where(and(
        eq(slackUser.userId, userInfo.id),
        eq(slackUser.workspaceId, workspaceId)
      ))
      .limit(1);

    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(slackUser)
        .set({
          username: userInfo.name,
          realName: userInfo.real_name,
          displayName: userInfo.profile?.display_name,
          email: userInfo.profile?.email,
          title: userInfo.profile?.title,
          phone: userInfo.profile?.phone,
          isBot: !!userInfo.is_bot,
          isAdmin: !!userInfo.is_admin,
          isOwner: !!userInfo.is_owner,
          isDeleted: !!userInfo.deleted,
          timezone: userInfo.tz,
          profileImage: userInfo.profile?.image_192,
          status: userInfo.profile?.status_text,
          updatedAt: new Date(),
          metadata: userInfo,
        })
        .where(eq(slackUser.id, existingUser.id))
        .returning();
      return updatedUser;
    } else {
      // Create new user
      const [newUser] = await db
        .insert(slackUser)
        .values({
          userId: userInfo.id,
          workspaceId,
          username: userInfo.name,
          realName: userInfo.real_name,
          displayName: userInfo.profile?.display_name,
          email: userInfo.profile?.email,
          title: userInfo.profile?.title,
          phone: userInfo.profile?.phone,
          isBot: !!userInfo.is_bot,
          isAdmin: !!userInfo.is_admin,
          isOwner: !!userInfo.is_owner,
          isDeleted: !!userInfo.deleted,
          timezone: userInfo.tz,
          profileImage: userInfo.profile?.image_192,
          status: userInfo.profile?.status_text,
          metadata: userInfo,
        })
        .returning();
      return newUser;
    }
  }

  // Channel management
  static async saveChannel(channelInfo: any, workspaceId: string): Promise<SlackChannel> {
    // Check if channel already exists
    const [existingChannel] = await db
      .select()
      .from(slackChannel)
      .where(and(
        eq(slackChannel.channelId, channelInfo.id),
        eq(slackChannel.workspaceId, workspaceId)
      ))
      .limit(1);

    if (existingChannel) {
      // Update existing channel
      const [updatedChannel] = await db
        .update(slackChannel)
        .set({
          name: channelInfo.name,
          purpose: channelInfo.purpose?.value,
          topic: channelInfo.topic?.value,
          isPrivate: !!channelInfo.is_private,
          isArchived: !!channelInfo.is_archived,
          memberCount: channelInfo.num_members?.toString() || '0',
          updatedAt: new Date(),
          metadata: channelInfo,
        })
        .where(eq(slackChannel.id, existingChannel.id))
        .returning();
      return updatedChannel;
    } else {
      // Create new channel
      const [newChannel] = await db
        .insert(slackChannel)
        .values({
          channelId: channelInfo.id,
          workspaceId,
          name: channelInfo.name,
          purpose: channelInfo.purpose?.value,
          topic: channelInfo.topic?.value,
          isPrivate: !!channelInfo.is_private,
          isArchived: !!channelInfo.is_archived,
          memberCount: channelInfo.num_members?.toString() || '0',
          metadata: channelInfo,
        })
        .returning();
      return newChannel;
    }
  }

  // Existing message and file methods
  static async saveMessage(
    message: SlackMessage,
    workspaceId: string,
    channelId: string,
    channelName?: string,
    userName?: string
  ): Promise<DBSlackMessage> {
    return withRetry(async () => {
      const [savedMessage] = await db
        .insert(slackMessage)
        .values({
          messageId: message.ts,
          channelId: channelId,
          channelName,
          userId: message.user,
          userName,
          text: message.text,
          timestamp: message.ts,
          messageType: message.type,
          workspaceId,
          threadTs: message.thread_ts,
          hasFiles: (message.files?.length || 0) > 0,
          metadata: {
            original: message,
          },
        })
        .returning();

      return savedMessage;
    });
  }

  static async saveFile(
    file: any,
    workspaceId: string,
    messageId?: string,
    content?: string
  ): Promise<SlackFile> {
    return withRetry(async () => {
      const [savedFile] = await db
        .insert(slackFile)
        .values({
          fileId: file.id,
          name: file.name,
          title: file.title,
          mimetype: file.mimetype,
          filetype: file.filetype,
          size: file.size?.toString(),
          urlPrivate: file.url_private,
          content,
          userId: file.user,
          workspaceId,
          messageId,
          extractedAt: content ? new Date() : undefined,
          metadata: {
            original: file,
          },
        })
        .returning();

      return savedFile;
    });
  }

  static async getMessagesByWorkspace(
    workspaceId: string,
    limit: number = 100
  ): Promise<DBSlackMessage[]> {
    return await db
      .select()
      .from(slackMessage)
      .where(eq(slackMessage.workspaceId, workspaceId))
      .orderBy(desc(slackMessage.timestamp))
      .limit(limit);
  }

  static async getFilesByWorkspace(
    workspaceId: string,
    limit: number = 100
  ): Promise<SlackFile[]> {
    return await db
      .select()
      .from(slackFile)
      .where(eq(slackFile.workspaceId, workspaceId))
      .orderBy(desc(slackFile.createdAt))
      .limit(limit);
  }

  static async getUsersByWorkspace(
    workspaceId: string,
    limit: number = 50
  ): Promise<SlackUser[]> {
    return await db
      .select()
      .from(slackUser)
      .where(and(
        eq(slackUser.workspaceId, workspaceId),
        eq(slackUser.isDeleted, false)
      ))
      .orderBy(desc(slackUser.updatedAt))
      .limit(limit);
  }

  static async getChannelsByWorkspace(
    workspaceId: string,
    limit: number = 50
  ): Promise<SlackChannel[]> {
    return await db
      .select()
      .from(slackChannel)
      .where(and(
        eq(slackChannel.workspaceId, workspaceId),
        eq(slackChannel.isArchived, false)
      ))
      .orderBy(desc(slackChannel.updatedAt))
      .limit(limit);
  }

  // New aggregate stats methods
  static async getWorkspaceStats(workspaceId: string): Promise<{
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    totalFiles: number;
    syncStartDate: Date | null;
    lastSyncAt: Date | null;
  }> {
    // Get workspace info
    const [workspace] = await db
      .select({
        syncStartDate: slackWorkspace.syncStartDate,
        lastSyncAt: slackWorkspace.lastSyncAt,
      })
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    // Get counts using aggregations
    const [userCount] = await db
      .select({ count: count() })
      .from(slackUser)
      .where(and(
        eq(slackUser.workspaceId, workspaceId),
        eq(slackUser.isDeleted, false)
      ));

    const [channelCount] = await db
      .select({ count: count() })
      .from(slackChannel)
      .where(and(
        eq(slackChannel.workspaceId, workspaceId),
        eq(slackChannel.isArchived, false)
      ));

    const [messageCount] = await db
      .select({ count: count() })
      .from(slackMessage)
      .where(eq(slackMessage.workspaceId, workspaceId));

    const [fileCount] = await db
      .select({ count: count() })
      .from(slackFile)
      .where(eq(slackFile.workspaceId, workspaceId));

    return {
      totalUsers: userCount.count,
      totalChannels: channelCount.count,
      totalMessages: messageCount.count,
      totalFiles: fileCount.count,
      syncStartDate: workspace?.syncStartDate || null,
      lastSyncAt: workspace?.lastSyncAt || null,
    };
  }

  // Check if entities exist (for duplicate prevention)
  static async checkMessageExists(messageId: string, workspaceId: string): Promise<boolean> {
    return withRetry(async () => {
      const [existing] = await db
        .select({ id: slackMessage.id })
        .from(slackMessage)
        .where(and(
          eq(slackMessage.messageId, messageId),
          eq(slackMessage.workspaceId, workspaceId)
        ))
        .limit(1);

      return !!existing;
    });
  }

  static async checkFileExists(fileId: string): Promise<boolean> {
    return withRetry(async () => {
      const [existing] = await db
        .select({ id: slackFile.id })
        .from(slackFile)
        .where(eq(slackFile.fileId, fileId))
        .limit(1);

      return !!existing;
    });
  }

  static async checkUserExists(userId: string, workspaceId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: slackUser.id })
      .from(slackUser)
      .where(and(
        eq(slackUser.userId, userId),
        eq(slackUser.workspaceId, workspaceId)
      ))
      .limit(1);

    return !!existing;
  }

  static async checkChannelExists(channelId: string, workspaceId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: slackChannel.id })
      .from(slackChannel)
      .where(and(
        eq(slackChannel.channelId, channelId),
        eq(slackChannel.workspaceId, workspaceId)
      ))
      .limit(1);

    return !!existing;
  }
} 