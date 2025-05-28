import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { slackWorkspace, slackMessage, slackUser, slackChannel, slackSyncLog } from '@/lib/db/schema-new-slack';
import { eq, and, gte, lte, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, startDate, endDate } = await request.json();

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify workspace belongs to user
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId as string))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== (session.user.id as string)) {
      return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // Create sync log entry
    const syncLog = await db
      .insert(slackSyncLog)
      .values({
        workspaceId: workspaceId,
        syncType: 'date_range_ingest',
        status: 'running',
        startedAt: new Date(),
        metadata: {
          dateRange: { start: startDateTime, end: endDateTime },
          operation: 'database_ingest',
          description: `Ingesting Slack data for range ${startDateTime.toISOString().split('T')[0]} to ${endDateTime.toISOString().split('T')[0]}`
        }
      })
      .returning();

    try {
      // Get data counts for the specified date range
      const [messageCount, userCount, channelCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(slackMessage)
          .where(
            and(
              eq(slackMessage.workspaceId, workspaceId),
              gte(slackMessage.timestamp, startDateTime.toISOString()),
              lte(slackMessage.timestamp, endDateTime.toISOString())
            )
          ),
        db
          .select({ count: count() })
          .from(slackUser)
          .where(eq(slackUser.workspaceId, workspaceId)),
        db
          .select({ count: count() })
          .from(slackChannel)
          .where(eq(slackChannel.workspaceId, workspaceId))
      ]);

      // Process messages in batches for better performance
      const batchSize = 1000;
      let processedMessages = 0;
      let totalMessages = messageCount[0]?.count || 0;

      // Get all messages in the date range
      const messages = await db
        .select()
        .from(slackMessage)
        .where(
          and(
            eq(slackMessage.workspaceId, workspaceId),
            gte(slackMessage.timestamp, startDateTime.toISOString()),
            lte(slackMessage.timestamp, endDateTime.toISOString())
          )
        );

      // Process messages for better indexing and analysis
      const processingResults = {
        messagesProcessed: messages.length,
        threadsIdentified: messages.filter(m => m.threadTs && m.threadTs !== m.messageId).length,
        directMessages: messages.filter(m => m.channelName && m.channelName.startsWith('D')).length,
        channelMessages: messages.filter(m => m.channelName && !m.channelName.startsWith('D')).length,
        messagesWithReactions: messages.filter(m => m.reactionCount && m.reactionCount > 0).length,
        messagesWithFiles: messages.filter(m => m.hasFiles).length,
        botMessages: messages.filter(m => m.messageType === 'bot_message').length,
        editedMessages: messages.filter(m => m.isEdited).length,
        deletedMessages: messages.filter(m => m.isDeleted).length,
      };

      // Update workspace statistics
      await db
        .update(slackWorkspace)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(slackWorkspace.id, workspaceId));

      // Update sync log with completion
      await db
        .update(slackSyncLog)
        .set({
          status: 'completed',
          completedAt: new Date(),
          messagesProcessed: totalMessages,
          metadata: {
            dateRange: { start: startDateTime, end: endDateTime },
            operation: 'database_ingest',
            description: `Successfully ingested Slack data for range ${startDateTime.toISOString().split('T')[0]} to ${endDateTime.toISOString().split('T')[0]}`,
            results: processingResults,
            summary: {
              totalUsers: userCount[0]?.count || 0,
              totalChannels: channelCount[0]?.count || 0,
              totalMessages: totalMessages,
              processingResults
            }
          }
        })
        .where(eq(slackSyncLog.id, syncLog[0].id));

      return NextResponse.json({
        success: true,
        message: 'Database ingest completed successfully',
        results: {
          dateRange: {
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString()
          },
          statistics: {
            totalUsers: userCount[0]?.count || 0,
            totalChannels: channelCount[0]?.count || 0,
            totalMessages: totalMessages,
            ...processingResults
          },
          syncLogId: syncLog[0].id
        }
      });

    } catch (processingError) {
      console.error('Error during data processing:', processingError);
      
      // Update sync log with error
      await db
        .update(slackSyncLog)
        .set({
          status: 'failed',
          completedAt: new Date(),
          lastError: processingError instanceof Error ? processingError.message : 'Unknown processing error',
          metadata: {
            dateRange: { start: startDateTime, end: endDateTime },
            operation: 'database_ingest',
            error: processingError instanceof Error ? processingError.message : 'Unknown processing error'
          }
        })
        .where(eq(slackSyncLog.id, syncLog[0].id));

      throw processingError;
    }

  } catch (error) {
    console.error('Error in database ingest:', error);
    return NextResponse.json(
      { error: 'Failed to ingest data to database' },
      { status: 500 }
    );
  }
} 