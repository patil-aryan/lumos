import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { UnlimitedSlackSyncService } from '@/lib/slack/unlimited-sync';

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

    console.log(`🚀 Starting unlimited sync for workspace ${workspaceId} by user ${session.user.id}`);

    // Start unlimited sync
    const progress = await UnlimitedSlackSyncService.performUnlimitedWorkspaceSync(
      workspaceId,
      session.user.id,
      undefined // No progress callback for API
    );

    return NextResponse.json({
      success: true,
      progress,
      message: `Unlimited sync completed! ${progress.newMessagesSaved} new messages saved.`,
      summary: {
        messagesProcessed: progress.processedMessages,
        newMessagesSaved: progress.newMessagesSaved,
        duplicatesSkipped: progress.duplicatesSkipped,
        channelsProcessed: progress.processedChannels,
        totalChannels: progress.totalChannels,
        apiCallsMade: progress.apiCallCount,
        channelSummary: progress.channelSummary,
      }
    });

  } catch (error) {
    console.error('Unlimited sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unlimited sync failed',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 