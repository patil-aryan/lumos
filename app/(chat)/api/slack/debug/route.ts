import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { SlackDatabaseService } from '@/lib/slack/database';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const type = url.searchParams.get('type') || 'overview';
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const export_format = url.searchParams.get('export'); // 'json' for download

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user owns this workspace
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(session.user.id);
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let data: any = {};

    switch (type) {
      case 'export-all':
        // Export ALL data for download
        const allMessages = await SlackDatabaseService.getMessagesByWorkspace(workspaceId, 10000); // Get up to 10k messages
        const allUsers = await SlackDatabaseService.getUsersByWorkspace(workspaceId, 1000);
        const allChannels = await SlackDatabaseService.getChannelsByWorkspace(workspaceId, 1000);
        const allFiles = await SlackDatabaseService.getFilesByWorkspace(workspaceId, 1000);
        const workspaceStats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
        
        data = {
          workspace: {
            id: workspace.id,
            teamId: workspace.teamId,
            teamName: workspace.teamName,
            createdAt: workspace.createdAt,
            lastSyncAt: workspace.lastSyncAt,
            syncStartDate: workspace.syncStartDate
          },
          stats: workspaceStats,
          messages: allMessages.map(msg => ({
            id: msg.id,
            messageId: msg.messageId,
            timestamp: msg.timestamp,
            channelId: msg.channelId,
            channelName: msg.channelName,
            userId: msg.userId,
            userName: msg.userName,
            text: msg.text,
            messageType: msg.messageType,
            threadTs: msg.threadTs,
            hasFiles: msg.hasFiles,
            createdAt: msg.createdAt,
            // Convert timestamp to human readable
            humanTime: new Date(parseFloat(msg.timestamp) * 1000).toISOString()
          })),
          users: allUsers,
          channels: allChannels,
          files: allFiles,
          exportedAt: new Date().toISOString(),
          messageCount: allMessages.length,
          dateRange: allMessages.length > 0 ? {
            oldest: new Date(parseFloat(allMessages[allMessages.length - 1].timestamp) * 1000).toISOString(),
            newest: new Date(parseFloat(allMessages[0].timestamp) * 1000).toISOString()
          } : null
        };

        // If export=json, return as downloadable file
        if (export_format === 'json') {
          const headers = new Headers();
          headers.set('Content-Type', 'application/json');
          headers.set('Content-Disposition', `attachment; filename="slack-export-${workspace.teamName}-${new Date().toISOString().split('T')[0]}.json"`);
          
          return new NextResponse(JSON.stringify(data, null, 2), {
            status: 200,
            headers
          });
        }
        break;

      case 'messages':
        const messages = await SlackDatabaseService.getMessagesByWorkspace(workspaceId, limit);
        data = {
          type: 'messages',
          workspace: { id: workspace.id, name: workspace.teamName },
          count: messages.length,
          messages: messages.map(msg => ({
            id: msg.id,
            timestamp: msg.timestamp,
            channelName: msg.channelName,
            userName: msg.userName,
            text: msg.text?.substring(0, 100) + (msg.text && msg.text.length > 100 ? '...' : ''),
            hasFiles: msg.hasFiles,
            createdAt: msg.createdAt,
            humanTime: new Date(parseFloat(msg.timestamp) * 1000).toISOString()
          }))
        };
        break;

      case 'users':
        const users = await SlackDatabaseService.getUsersByWorkspace(workspaceId, limit);
        data = {
          type: 'users',
          workspace: { id: workspace.id, name: workspace.teamName },
          count: users.length,
          users: users.map(user => ({
            id: user.id,
            userId: user.userId,
            username: user.username,
            realName: user.realName,
            email: user.email,
            isBot: user.isBot,
            isAdmin: user.isAdmin,
            isDeleted: user.isDeleted,
            createdAt: user.createdAt
          }))
        };
        break;

      case 'channels':
        const channels = await SlackDatabaseService.getChannelsByWorkspace(workspaceId, limit);
        data = {
          type: 'channels',
          workspace: { id: workspace.id, name: workspace.teamName },
          count: channels.length,
          channels: channels.map(channel => ({
            id: channel.id,
            channelId: channel.channelId,
            name: channel.name,
            purpose: channel.purpose,
            isPrivate: channel.isPrivate,
            isArchived: channel.isArchived,
            memberCount: channel.memberCount,
            createdAt: channel.createdAt
          }))
        };
        break;

      case 'files':
        const files = await SlackDatabaseService.getFilesByWorkspace(workspaceId, limit);
        data = {
          type: 'files',
          workspace: { id: workspace.id, name: workspace.teamName },
          count: files.length,
          files: files.map(file => ({
            id: file.id,
            fileId: file.fileId,
            name: file.name,
            filetype: file.filetype,
            size: file.size,
            hasContent: !!file.content,
            contentLength: file.content?.length || 0,
            createdAt: file.createdAt
          }))
        };
        break;

      default: // overview
        const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
        const recentMessages = await SlackDatabaseService.getMessagesByWorkspace(workspaceId, 5);
        const recentUsers = await SlackDatabaseService.getUsersByWorkspace(workspaceId, 5);
        
        data = {
          type: 'overview',
          workspace: {
            id: workspace.id,
            name: workspace.teamName,
            teamId: workspace.teamId,
            createdAt: workspace.createdAt,
            lastSyncAt: workspace.lastSyncAt,
            syncStartDate: workspace.syncStartDate
          },
          stats,
          hasData: stats.totalMessages > 0 || stats.totalUsers > 0,
          canLoadHistorical: !workspace.lastSyncAt || stats.totalMessages === 0,
          syncStatus: workspace.lastSyncAt ? 
            (Date.now() - workspace.lastSyncAt.getTime() < 6 * 60 * 60 * 1000 ? 'recent' : 'stale') : 
            'never',
          recentMessages: recentMessages.map(msg => ({
            channelName: msg.channelName,
            userName: msg.userName,
            text: msg.text?.substring(0, 50) + '...',
            timestamp: msg.timestamp,
            humanTime: new Date(parseFloat(msg.timestamp) * 1000).toISOString()
          })),
          recentUsers: recentUsers.map(user => ({
            username: user.username,
            realName: user.realName,
            isBot: user.isBot
          }))
        };
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 