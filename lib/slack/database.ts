import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { slackWorkspace, slackMessage, slackFile, type SlackWorkspace, type SlackMessage as DBSlackMessage, type SlackFile } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SlackMessage, SlackOAuthResponse } from './client';

// Initialize database connection (same as in queries.ts)
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

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
      })
      .returning();

    return workspace;
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

  static async updateWorkspaceToken(workspaceId: string, accessToken: string): Promise<void> {
    await db
      .update(slackWorkspace)
      .set({
        accessToken,
        updatedAt: new Date(),
      })
      .where(eq(slackWorkspace.id, workspaceId));
  }

  static async deactivateWorkspace(workspaceId: string): Promise<void> {
    await db
      .update(slackWorkspace)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(slackWorkspace.id, workspaceId));
  }

  static async saveMessage(
    message: SlackMessage,
    workspaceId: string,
    channelId: string,
    channelName?: string,
    userName?: string
  ): Promise<DBSlackMessage> {
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
  }

  static async saveFile(
    file: any,
    workspaceId: string,
    messageId?: string,
    content?: string
  ): Promise<SlackFile> {
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

  static async checkMessageExists(messageId: string, workspaceId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: slackMessage.id })
      .from(slackMessage)
      .where(and(
        eq(slackMessage.messageId, messageId),
        eq(slackMessage.workspaceId, workspaceId)
      ))
      .limit(1);

    return !!existing;
  }

  static async checkFileExists(fileId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: slackFile.id })
      .from(slackFile)
      .where(eq(slackFile.fileId, fileId))
      .limit(1);

    return !!existing;
  }
} 