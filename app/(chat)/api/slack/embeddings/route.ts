import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { slackWorkspace, slackMessage } from '@/lib/db/schema';
import {
  generateSlackMessageEmbeddings,
  saveSlackMessageEmbeddings,
  hasEmbedding,
  getEmbeddingStats,
} from '@/lib/ai/embeddings';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, forceRegenerate = false } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
    }

    // Get all messages for the workspace
    const messages = await db
      .select()
      .from(slackMessage)
      .where(eq(slackMessage.workspaceId, workspaceId));

    if (messages.length === 0) {
      return NextResponse.json({ 
        message: 'No messages found to embed',
        stats: { totalMessages: 0, embeddedMessages: 0, embeddingCoverage: 0 }
      });
    }

    // Filter messages that don't have embeddings (unless force regenerate)
    let messagesToEmbed = messages;
    if (!forceRegenerate) {
      const filteredMessages = [];
      for (const message of messages) {
        const hasExisting = await hasEmbedding(message.id);
        if (!hasExisting) {
          filteredMessages.push(message);
        }
      }
      messagesToEmbed = filteredMessages;
    }

    if (messagesToEmbed.length === 0) {
      const stats = await getEmbeddingStats(workspaceId);
      return NextResponse.json({ 
        message: 'All messages already have embeddings',
        stats
      });
    }

    console.log(`Generating embeddings for ${messagesToEmbed.length} messages...`);

    // Generate embeddings
    const embeddings = await generateSlackMessageEmbeddings(
      messagesToEmbed,
      (message) => ({
        messageId: message.messageId,
        workspaceId: message.workspaceId,
        channelName: message.channelName || 'unknown',
        userName: message.userName || 'unknown',
        timestamp: message.timestamp,
        threadTs: message.threadTs || undefined,
      })
    );

    // Save embeddings to database
    if (embeddings.length > 0) {
      await saveSlackMessageEmbeddings(embeddings);
    }

    // Get updated stats
    const stats = await getEmbeddingStats(workspaceId);

    return NextResponse.json({
      message: `Successfully generated ${embeddings.length} embeddings`,
      processed: embeddings.length,
      skipped: messagesToEmbed.length - embeddings.length,
      stats,
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
    }

    // Get embedding statistics
    const stats = await getEmbeddingStats(workspaceId);

    return NextResponse.json({ stats });

  } catch (error) {
    console.error('Error getting embedding stats:', error);
    return NextResponse.json(
      { error: 'Failed to get embedding statistics' },
      { status: 500 }
    );
  }
} 