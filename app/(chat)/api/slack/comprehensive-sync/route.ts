import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { slackWorkspace } from '@/lib/db/schema-new-slack';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ComprehensiveSlackSync } from '@/lib/slack/comprehensive-sync';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get the workspace
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId as string))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify workspace belongs to user
    if (workspace[0].userId !== (session.user.id as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Start comprehensive sync
    const syncConfig = {
      syncType: 'full' as const,
      includePublicChannels: true,
      includePrivateChannels: true,
      includeGroupMessages: true,
      includeDirectMessages: false, // Skip DMs for now
      includeThreadReplies: true,
      includeReactions: true,
      includeFiles: true,
      downloadFiles: false,
      includeDeletedMessages: false,
      includeEditHistory: false,
      batchSize: 200,
      maxConcurrentRequests: 3,
      rateLimitDelay: 1000,
      maxRetries: 3,
      extractFileContent: false,
      generateEmbeddings: false,
      skipExistingMessages: true,
    };

    // Create sync instance and start in background
    const sync = new ComprehensiveSlackSync(
      workspace[0],
      syncConfig,
      (progress) => {
        // TODO: Store progress in database or send to client via WebSocket
        console.log('Sync progress:', progress.currentOperation);
      }
    );

    // Start sync in background (don't await)
    sync.performComprehensiveSync().catch(error => {
      console.error('Sync failed:', error);
    });

    return NextResponse.json({ 
      message: 'Sync started successfully',
      syncId: workspaceId 
    });

  } catch (error) {
    console.error('Error starting sync:', error);
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
} 