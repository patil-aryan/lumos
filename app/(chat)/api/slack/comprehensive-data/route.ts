import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { slackWorkspace, slackUser, slackChannel, slackMessage, slackFile, slackReaction } from '@/lib/db/schema-new-slack';
import { eq, and, count, desc, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the workspace for this user
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.userId, session.user.id as string))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({ error: 'No Slack workspace found' }, { status: 404 });
    }

    const workspaceData = workspace[0];
    const workspaceUuid = workspaceData.id as string; // Ensure UUID is treated as string

    // Get comprehensive stats
    const [
      totalUsers,
      totalChannels,
      totalMessages,
      totalReactions,
      totalFiles,
    ] = await Promise.all([
      db.select({ count: count() }).from(slackUser).where(eq(slackUser.workspaceId, workspaceUuid)),
      db.select({ count: count() }).from(slackChannel).where(eq(slackChannel.workspaceId, workspaceUuid)),
      db.select({ count: count() }).from(slackMessage).where(eq(slackMessage.workspaceId, workspaceUuid)),
      db.select({ count: count() }).from(slackReaction).where(eq(slackReaction.workspaceId, workspaceUuid)),
      db.select({ count: count() }).from(slackFile).where(eq(slackFile.workspaceId, workspaceUuid)),
    ]);

    // Get recent messages with user and channel info
    const recentMessages = await db
      .select({
        id: slackMessage.id,
        text: slackMessage.text,
        user: slackMessage.userName,
        channel: slackMessage.channelName,
        timestamp: slackMessage.timestamp,
        reactions: slackMessage.reactionCount,
        messageId: slackMessage.messageId,
        channelId: slackMessage.channelId,
        userId: slackMessage.userId,
        threadTs: slackMessage.threadTs,
        replyCount: slackMessage.replyCount,
        messageType: slackMessage.messageType,
      })
      .from(slackMessage)
      .where(and(
        eq(slackMessage.workspaceId, workspaceUuid),
        isNotNull(slackMessage.text)
      ))
      .orderBy(desc(slackMessage.timestamp))
      .limit(20);

    // Get channels with activity
    const channels = await db
      .select({
        id: slackChannel.id,
        channelId: slackChannel.channelId,
        name: slackChannel.name,
        memberCount: slackChannel.memberCount,
        messageCount: slackChannel.memberCount, // Use memberCount as proxy since messageCount doesn't exist
        lastActivity: slackChannel.lastMessageAt,
        isPrivate: slackChannel.isPrivate,
        isArchived: slackChannel.isArchived,
        topic: slackChannel.topic,
        purpose: slackChannel.purpose,
      })
      .from(slackChannel)
      .where(eq(slackChannel.workspaceId, workspaceUuid))
      .orderBy(desc(slackChannel.lastMessageAt))
      .limit(25);

    // Get users with message counts
    const users = await db
      .select({
        id: slackUser.id,
        userId: slackUser.userId,
        realName: slackUser.realName,
        displayName: slackUser.displayName,
        email: slackUser.email,
        isDeleted: slackUser.isDeleted, // Use isDeleted field, will invert in response mapping
        messageCount: slackUser.id, // Use id as proxy since messageCount doesn't exist
        title: slackUser.title,
        timezone: slackUser.timezone,
        isBot: slackUser.isBot,
        isAdmin: slackUser.isAdmin,
        lastActive: slackUser.lastActive,
      })
      .from(slackUser)
      .where(eq(slackUser.workspaceId, workspaceUuid))
      .orderBy(desc(slackUser.realName))
      .limit(30);

    // Calculate thread count (messages with reply_count > 0 or threadTs)
    const threadMessages = await db
      .select({ count: count() })
      .from(slackMessage)
      .where(and(
        eq(slackMessage.workspaceId, workspaceUuid),
        isNotNull(slackMessage.threadTs)
      ));

    const responseData = {
      id: workspaceData.id,
      teamId: workspaceData.teamId,
      teamName: workspaceData.teamName,
      teamDomain: workspaceData.teamDomain || '',
      teamUrl: workspaceData.teamUrl || '',
      isActive: workspaceData.isActive,
      createdAt: workspaceData.createdAt.toISOString(),
      lastSyncAt: workspaceData.lastSyncAt?.toISOString() || null,
      lastFullSyncAt: workspaceData.lastFullSyncAt?.toISOString() || null,
      stats: {
        totalUsers: totalUsers[0]?.count || 0,
        totalChannels: totalChannels[0]?.count || 0,
        totalMessages: totalMessages[0]?.count || 0,
        totalReactions: totalReactions[0]?.count || 0,
        totalFiles: totalFiles[0]?.count || 0,
        totalThreads: threadMessages[0]?.count || 0,
        dataSize: 0, // TODO: Calculate actual data size
      },
      recentMessages: recentMessages.map(msg => ({
        id: msg.id,
        text: msg.text || '',
        user: msg.user || 'Unknown User',
        channel: msg.channel || 'Unknown Channel',
        timestamp: msg.timestamp,
        reactions: msg.reactions || 0,
        messageId: msg.messageId,
        channelId: msg.channelId,
        userId: msg.userId,
        threadTs: msg.threadTs,
        replyCount: msg.replyCount || 0,
        messageType: msg.messageType,
      })),
      channels: channels.map(ch => ({
        id: ch.id,
        channelId: ch.channelId,
        name: ch.name || 'unnamed-channel',
        memberCount: ch.memberCount || 0,
        messageCount: ch.messageCount || 0,
        lastActivity: ch.lastActivity || new Date().toISOString(),
        isPrivate: ch.isPrivate || false,
        isArchived: ch.isArchived || false,
        topic: ch.topic,
        purpose: ch.purpose,
      })),
      users: users.map(user => ({
        id: user.id,
        userId: user.userId,
        realName: user.realName || 'Unknown User',
        displayName: user.displayName || 'unknown',
        email: user.email || '',
        isActive: !user.isDeleted,
        messageCount: user.messageCount || 0,
        title: user.title,
        timezone: user.timezone,
        isBot: user.isBot || false,
        isAdmin: user.isAdmin || false,
        lastActive: user.lastActive,
      })),
      // TODO: Add recentSync data from sync logs
      recentSync: undefined,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching Slack data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Slack data' },
      { status: 500 }
    );
  }
} 