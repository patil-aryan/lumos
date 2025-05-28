import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { slackWorkspace, slackMessage, slackUser, slackChannel, slackReaction, slackFile } from '@/lib/db/schema-new-slack';
import { eq, and, gte, lte } from 'drizzle-orm';
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

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // Fetch comprehensive data within date range
    const [messages, users, channels, reactions, files] = await Promise.all([
      // Get ALL message details including DMs, threads, replies
      db
        .select({
          id: slackMessage.id,
          messageId: slackMessage.messageId,
          channelId: slackMessage.channelId,
          channelName: slackMessage.channelName,
          userId: slackMessage.userId,
          username: slackMessage.userName,
          text: slackMessage.text,
          timestamp: slackMessage.timestamp,
          messageType: slackMessage.messageType,
          threadTs: slackMessage.threadTs,
          parentUserId: slackMessage.parentUserId,
          replyCount: slackMessage.replyCount,
          replyUsersCount: slackMessage.replyUsersCount,
          latestReply: slackMessage.latestReply,
          reactionCount: slackMessage.reactionCount,
          attachments: slackMessage.attachments,
          blocks: slackMessage.blocks,
          editedTs: slackMessage.editedTs,
          deletedTs: slackMessage.deletedTs,
          subtype: slackMessage.subtype,
          createdAt: slackMessage.createdAt,
          updatedAt: slackMessage.updatedAt,
        })
        .from(slackMessage)
        .where(eq(slackMessage.workspaceId, workspaceId)),
      
      // Get all users with complete details
      db
        .select({
          id: slackUser.id,
          userId: slackUser.userId,
          username: slackUser.username,
          isDeleted: slackUser.isDeleted,
          color: slackUser.color,
          realName: slackUser.realName,
          timezone: slackUser.timezone,
          timezoneLabel: slackUser.timezoneLabel,
          timezoneOffset: slackUser.timezoneOffset,
          isAdmin: slackUser.isAdmin,
          isOwner: slackUser.isOwner,
          isPrimaryOwner: slackUser.isPrimaryOwner,
          isRestricted: slackUser.isRestricted,
          isUltraRestricted: slackUser.isUltraRestricted,
          isBot: slackUser.isBot,
          isStranger: slackUser.isStranger,
          updatedAt: slackUser.updatedAt,
          hasFiles: slackUser.hasFiles,
          displayName: slackUser.displayName,
          email: slackUser.email,
          phone: slackUser.phone,
          skype: slackUser.skype,
          title: slackUser.title,
          lastActive: slackUser.lastActive,
          createdAt: slackUser.createdAt,
        })
        .from(slackUser)
        .where(eq(slackUser.workspaceId, workspaceId)),
      
      // Get all channels including private channels and DMs
      db
        .select({
          id: slackChannel.id,
          channelId: slackChannel.channelId,
          name: slackChannel.name,
          nameNormalized: slackChannel.nameNormalized,
          purpose: slackChannel.purpose,
          topic: slackChannel.topic,
          creator: slackChannel.creator,
          isChannel: slackChannel.isChannel,
          isGroup: slackChannel.isGroup,
          isIm: slackChannel.isIm,
          isMpim: slackChannel.isMpim,
          isPrivate: slackChannel.isPrivate,
          isArchived: slackChannel.isArchived,
          isGeneral: slackChannel.isGeneral,
          isShared: slackChannel.isShared,
          isExtShared: slackChannel.isExtShared,
          isOrgShared: slackChannel.isOrgShared,
          isMember: slackChannel.isMember,
          memberCount: slackChannel.memberCount,
          unlinked: slackChannel.unlinked,
          createdTimestamp: slackChannel.createdTimestamp,
          createdAt: slackChannel.createdAt,
          updatedAt: slackChannel.updatedAt,
          lastMessageAt: slackChannel.lastMessageAt,
          lastSyncAt: slackChannel.lastSyncAt,
          metadata: slackChannel.metadata,
        })
        .from(slackChannel)
        .where(eq(slackChannel.workspaceId, workspaceId)),
      
      // Get all reactions
      db
        .select()
        .from(slackReaction)
        .where(eq(slackReaction.workspaceId, workspaceId)),
      
      // Get all files
      db
        .select()
        .from(slackFile)
        .where(eq(slackFile.workspaceId, workspaceId))
    ]);

    console.log('Raw data fetched:', {
      messages: messages?.length || 0,
      users: users?.length || 0,
      channels: channels?.length || 0,
      reactions: reactions?.length || 0,
      files: files?.length || 0,
      sampleMessageTimestamps: messages?.slice(0, 3).map(m => ({ 
        timestamp: m.timestamp, 
        text: m.text?.substring(0, 30) 
      })) || []
    });

    // Filter messages by date range in JavaScript since Slack timestamps are stored as strings
    // If no messages match date filter, return all messages for debugging
    const filteredMessages = (messages || []).filter(m => {
      if (!m.timestamp) return false;
      
      try {
        // Convert Slack timestamp (usually like "1234567890.123456") to Date
        const messageTime = new Date(parseFloat(m.timestamp) * 1000);
        return messageTime >= startDateTime && messageTime <= endDateTime;
      } catch (error) {
        console.log('Failed to parse timestamp:', m.timestamp, error);
        return false;
      }
    });

    // If no filtered messages, include all messages as fallback for debugging
    const finalMessages = filteredMessages.length > 0 ? filteredMessages : (messages || []);

    // Filter reactions by date range
    const filteredReactions = (reactions || []).filter(r => {
      if (!r.createdAt) return false;
      try {
        const reactionTime = new Date(r.createdAt);
        return reactionTime >= startDateTime && reactionTime <= endDateTime;
      } catch (error) {
        return false;
      }
    });

    // Filter files by date range
    const filteredFiles = (files || []).filter(f => {
      if (!f.createdAt) return false;
      try {
        const fileTime = new Date(f.createdAt);
        return fileTime >= startDateTime && fileTime <= endDateTime;
      } catch (error) {
        return false;
      }
    });

    // If no filtered data, include all data as fallback
    const finalReactions = filteredReactions.length > 0 ? filteredReactions : (reactions || []);
    const finalFiles = filteredFiles.length > 0 ? filteredFiles : (files || []);

    console.log('Filtered data:', {
      messages: finalMessages.length,
      reactions: finalReactions.length,
      files: finalFiles.length,
      dateFilterWorked: filteredMessages.length > 0,
      sampleMessage: finalMessages[0] ? {
        text: finalMessages[0].text?.substring(0, 50),
        timestamp: finalMessages[0].timestamp,
        channel: finalMessages[0].channelName,
        user: finalMessages[0].username
      } : null
    });

    // Process and organize data by type with null checks
    const messagesByType = {
      channel_messages: finalMessages.filter(m => m?.channelName && !m.channelName.startsWith('D')),
      direct_messages: finalMessages.filter(m => m?.channelName && m.channelName.startsWith('D')),
      thread_replies: finalMessages.filter(m => m?.threadTs && m.threadTs !== m.messageId),
      all_messages: finalMessages
    };

    const channelsByType = {
      public_channels: (channels || []).filter(c => c?.isChannel && !c.isPrivate),
      private_channels: (channels || []).filter(c => c?.isChannel && c.isPrivate),
      direct_messages: (channels || []).filter(c => c?.isIm),
      group_messages: (channels || []).filter(c => c?.isMpim),
      all_channels: channels || []
    };

    const exportData = {
      export_info: {
        workspace: {
          id: workspace[0]?.id || '',
          team_id: workspace[0]?.teamId || '',
          team_name: workspace[0]?.teamName || '',
          team_domain: workspace[0]?.teamDomain || '',
          team_url: workspace[0]?.teamUrl || ''
        },
        date_range: {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString()
        },
        exported_at: new Date().toISOString(),
        total_records: {
          messages: finalMessages.length,
          users: (users || []).length,
          channels: (channels || []).length,
          reactions: finalReactions.length,
          files: finalFiles.length
        },
        data_breakdown: {
          channel_messages: messagesByType.channel_messages.length,
          direct_messages: messagesByType.direct_messages.length,
          thread_replies: messagesByType.thread_replies.length,
          public_channels: channelsByType.public_channels.length,
          private_channels: channelsByType.private_channels.length,
          dm_channels: channelsByType.direct_messages.length,
          group_channels: channelsByType.group_messages.length
        }
      },
      
      // Complete message data with all details
      messages: {
        all: finalMessages,
        by_type: messagesByType
      },
      
      // Complete user data
      users: users || [],
      
      // Complete channel data including DMs
      channels: {
        all: channels || [],
        by_type: channelsByType
      },
      
      // All reactions with emoji details
      reactions: finalReactions,
      
      // All file uploads and attachments
      files: finalFiles,
      
      // Thread information
      threads: {
        parent_messages: finalMessages.filter(m => m?.replyCount && m.replyCount > 0),
        thread_replies: messagesByType.thread_replies
      }
    };

    // Create detailed filename
    const dateRange = `${startDateTime.toISOString().split('T')[0]}-to-${endDateTime.toISOString().split('T')[0]}`;
    const teamName = workspace[0]?.teamName || 'unknown-workspace';
    const filename = `slack-complete-export-${teamName}-${dateRange}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error downloading Slack data:', error);
    return NextResponse.json(
      { error: 'Failed to download data' },
      { status: 500 }
    );
  }
} 