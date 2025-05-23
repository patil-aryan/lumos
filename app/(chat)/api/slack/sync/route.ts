import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { SlackDatabaseService } from '@/lib/slack/database';
import { SlackSyncService } from '@/lib/slack/sync';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return new NextResponse('Workspace ID required', { status: 400 });
    }

    // Verify the workspace belongs to the user
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(session.user.id);
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) {
      return new NextResponse('Workspace not found', { status: 404 });
    }

    // Start sync in background (in a real app, use a queue system)
    const syncService = new SlackSyncService(workspace);
    
    // For now, we'll run it synchronously but in production you'd want to use a job queue
    const progress = await syncService.syncWorkspaceData();

    return NextResponse.json({
      success: true,
      progress,
      message: 'Sync completed successfully',
    });
  } catch (error) {
    console.error('Slack sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's workspaces with sync status
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(session.user.id);
    
    const workspacesWithStats = await Promise.all(
      workspaces.map(async (workspace) => {
        const messages = await SlackDatabaseService.getMessagesByWorkspace(workspace.id, 1);
        const files = await SlackDatabaseService.getFilesByWorkspace(workspace.id, 1);
        
        return {
          ...workspace,
          lastSyncAt: messages[0]?.createdAt || null,
          hasData: messages.length > 0 || files.length > 0,
        };
      })
    );

    return NextResponse.json(workspacesWithStats);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 