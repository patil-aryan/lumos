import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { SlackDatabaseService } from '@/lib/slack/database';
import { SlackSyncService } from '@/lib/slack/sync';
import { UnlimitedSlackSyncService } from '@/lib/slack/unlimited-sync';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    // Add debug logging
    console.log('Session debug:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userType: session?.user?.type,
      userEmail: session?.user?.email,
    });
    
    if (!session?.user?.id) {
      console.log('Authentication failed - no session or user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'sync') {
      // Trigger sync for a specific workspace
      const workspaceId = url.searchParams.get('workspaceId');
      const historical = url.searchParams.get('historical') === 'true';
      const unlimited = url.searchParams.get('unlimited') === 'true';

      if (!workspaceId) {
        return NextResponse.json({ error: 'Workspace ID required for sync' }, { status: 400 });
      }

      try {
        const progress = await SlackSyncService.syncWorkspace(
          workspaceId, 
          undefined // No progress callback for API
        );

        return NextResponse.json({ 
          success: true, 
          progress,
          message: unlimited ? 'Unlimited historical sync completed' : 
                   historical ? 'Historical sync completed' : 'Sync completed successfully' 
        });
      } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ 
          error: 'Sync failed', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
    }

    // Default: Return aggregate stats for all workspaces
    console.log('Querying workspaces for user ID:', session.user.id);
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(session.user.id);
    console.log('Found workspaces:', workspaces.length, workspaces.map(w => ({ id: w.id, teamName: w.teamName, userId: w.userId })));
    
    const workspaceData = await Promise.all(
      workspaces.map(async (workspace) => {
        const stats = await SlackDatabaseService.getWorkspaceStats(workspace.id);
        
        // Get detailed users and channels
        const users = await SlackDatabaseService.getUsersByWorkspace(workspace.id, 50); // Top 50 users
        const channels = await SlackDatabaseService.getChannelsByWorkspace(workspace.id, 50); // Top 50 channels
        
        return {
          id: workspace.id,
          teamId: workspace.teamId,
          teamName: workspace.teamName,
          isActive: workspace.isActive,
          createdAt: workspace.createdAt,
          lastSyncAt: workspace.lastSyncAt,
          syncStartDate: stats.syncStartDate,
          stats: {
            totalUsers: stats.totalUsers,
            totalChannels: stats.totalChannels,
            totalMessages: stats.totalMessages,
            totalFiles: stats.totalFiles,
          },
          // Status indicators
          hasData: stats.totalMessages > 0 || stats.totalUsers > 0,
          syncStatus: workspace.lastSyncAt ? 
            (Date.now() - workspace.lastSyncAt.getTime() < 6 * 60 * 60 * 1000 ? 'recent' : 'stale') : 
            'never',
          // Detailed data
          users: users.map((user: any) => ({
            id: user.userId,
            username: user.username,
            realName: user.realName,
            displayName: user.displayName,
            email: user.email,
            profileImage: user.profileImage,
            isBot: user.isBot,
            isAdmin: user.isAdmin,
            status: user.status,
          })),
          channels: channels.map((channel: any) => ({
            id: channel.channelId,
            name: channel.name,
            purpose: channel.purpose,
            topic: channel.topic,
            isPrivate: channel.isPrivate,
            isArchived: channel.isArchived,
            memberCount: parseInt(channel.memberCount || '0'),
          })),
        };
      })
    );

    console.log('Returning workspace data:', { totalWorkspaces: workspaces.length, hasData: workspaceData.length > 0 });

    return NextResponse.json({ 
      success: true, 
      workspaces: workspaceData,
      totalWorkspaces: workspaces.length,
    });

  } catch (error) {
    console.error('Error fetching Slack data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Slack data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, workspaceId, historical, unlimited } = await req.json();

    if (action === 'sync') {
      if (!workspaceId) {
        return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
      }

      // Use unlimited sync service if unlimited flag is true
      if (unlimited) {
        console.log(`🚀 Starting UNLIMITED sync for workspace ${workspaceId}`);
        
        // Start unlimited sync in background and return immediately
        UnlimitedSlackSyncService.performUnlimitedWorkspaceSync(workspaceId, session.user.id)
          .then((progress) => {
            console.log(`✅ Unlimited sync completed for workspace ${workspaceId}:`, {
              messagesProcessed: progress.processedMessages,
              newMessagesSaved: progress.newMessagesSaved,
              channelsProcessed: progress.processedChannels
            });
          })
          .catch(error => console.error(`❌ Unlimited sync failed for workspace ${workspaceId}:`, error));

        return NextResponse.json({ 
          success: true, 
          message: 'Unlimited sync started - extracting ALL available messages (this may take 10+ minutes)',
          workspaceId,
          syncType: 'unlimited',
          note: 'Check terminal for detailed progress logs'
        });
      } else {
        // Use regular sync service for normal/historical sync
        SlackSyncService.syncWorkspace(workspaceId, undefined)
          .then(() => console.log(`Sync completed for workspace ${workspaceId}`))
          .catch(error => console.error(`Sync failed for workspace ${workspaceId}:`, error));

        return NextResponse.json({ 
          success: true, 
          message: historical ? 'Historical sync started in background' : 'Sync started in background',
          workspaceId,
          historical: !!historical,
          syncType: historical ? 'historical' : 'recent'
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in Slack data POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 