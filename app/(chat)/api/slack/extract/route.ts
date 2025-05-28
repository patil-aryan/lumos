import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { SlackDatabaseService } from '@/lib/slack/database';
import { SimpleSlackExtractor, type SimpleExtractionOptions } from '@/lib/slack/simple-extractor';
import { SlackEmbeddingService } from '@/lib/slack/embeddings';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, workspaceId, ...options } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    switch (action) {
      case 'extract-all': {
        const { startDate, endDate } = options;

        if (!startDate || !endDate) {
          return NextResponse.json({ 
            error: 'Start date and end date are required' 
          }, { status: 400 });
        }

        const extractionOptions: SimpleExtractionOptions = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        };

        // Start extraction in background
        SimpleSlackExtractor.performExtraction(
          workspaceId,
          session.user.id,
          extractionOptions,
          (progress) => {
            console.log('Extraction progress:', progress);
          }
        ).then(async (result) => {
          console.log('✅ Extraction completed:', result);
          
          // REMOVED: Automatic embedding generation
          // User wants to control when embeddings are created
          
        }).catch((error) => {
          console.error('❌ Extraction failed:', error);
        });

        return NextResponse.json({
          success: true,
          message: `Extraction started for ${startDate} to ${endDate}. Messages will be automatically converted to embeddings for RAG.`,
          options: extractionOptions,
        });
      }

      case 'cleanup-database': {
        console.log(`🗑️ Cleaning up Slack data for workspace ${workspaceId}`);
        
        await SlackDatabaseService.deleteAllWorkspaceData(workspaceId);

        return NextResponse.json({
          success: true,
          message: 'All Slack data has been deleted from the database',
        });
      }

      case 'export-json': {
        const { startDate, endDate } = options;
        
        if (!startDate || !endDate) {
          return NextResponse.json({ 
            error: 'Start date and end date are required for export' 
          }, { status: 400 });
        }

        // Create simplified JSON export from database
        const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
        const messages = await SlackDatabaseService.getMessagesByWorkspace(workspaceId, 10000);
        const files = await SlackDatabaseService.getFilesByWorkspace(workspaceId, 1000);

        const exportData = {
          workspace: {
            id: workspaceId,
            totalMessages: stats.totalMessages,
            totalFiles: stats.totalFiles,
          },
          dateRange: {
            startDate,
            endDate,
          },
          messages,
          files,
          exportedAt: new Date().toISOString(),
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="slack-export-${startDate}-to-${endDate}.json"`,
          },
        });
      }

      case 'export-dec-to-now': {
        const { startDate, endDate } = options;
        
        console.log(`📥 Exporting messages from ${startDate} to ${endDate}`);

        // Get messages from database with date filtering
        const messages = await SlackDatabaseService.getMessagesByDateRange(
          workspaceId, 
          new Date(startDate), 
          new Date(endDate),
          50000 // Large limit to get all messages
        );

        // Format messages with human-readable dates and sort in ascending order
        const formattedMessages = messages
          .map((msg: any) => {
            const messageDate = new Date(parseFloat(msg.timestamp) * 1000);
            return {
              id: msg.id,
              messageId: msg.messageId,
              timestamp: msg.timestamp,
              date: messageDate.toISOString().split('T')[0], // YYYY-MM-DD format
              datetime: messageDate.toISOString(), // Full ISO datetime
              humanDate: messageDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              }),
              humanTime: messageDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }),
              channelId: msg.channelId,
              channelName: msg.channelName,
              userId: msg.userId,
              userName: msg.userName,
              text: msg.text,
              messageType: msg.messageType,
              threadTs: msg.threadTs,
              hasFiles: msg.hasFiles,
              createdAt: msg.createdAt
            };
          })
          .sort((a: any, b: any) => parseFloat(a.timestamp) - parseFloat(b.timestamp)); // Ascending order (oldest first)

        // Get workspace stats
        const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);

        const exportData = {
          exportInfo: {
            title: 'Slack Messages Export - December 2024 to Current',
            description: 'All Slack messages from December 1, 2024 to current date, sorted chronologically (oldest first)',
            dateRange: {
              startDate,
              endDate,
              startDateFormatted: new Date(startDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
              endDateFormatted: new Date(endDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            },
            totalMessages: formattedMessages.length,
            exportedAt: new Date().toISOString(),
            sortOrder: 'ascending (oldest first)'
          },
          workspace: {
            id: workspaceId,
            totalMessagesInDB: stats.totalMessages,
            totalFilesInDB: stats.totalFiles,
            totalUsersInDB: stats.totalUsers,
            totalChannelsInDB: stats.totalChannels
          },
          messages: formattedMessages,
          summary: {
            messagesByChannel: formattedMessages.reduce((acc: Record<string, number>, msg: any) => {
              acc[msg.channelName] = (acc[msg.channelName] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            messagesByDate: formattedMessages.reduce((acc: Record<string, number>, msg: any) => {
              acc[msg.date] = (acc[msg.date] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            dateRange: {
              firstMessage: formattedMessages[0]?.datetime || null,
              lastMessage: formattedMessages[formattedMessages.length - 1]?.datetime || null
            }
          }
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="slack-messages-dec2024-to-${endDate}.json"`,
          },
        });
      }

      case 'get-stats': {
        const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
        const embeddingStats = await SlackEmbeddingService.getEmbeddingStats(workspaceId);
        
        return NextResponse.json({
          success: true,
          stats: {
            ...stats,
            ...embeddingStats,
          },
        });
      }

      case 'disconnect': {
        console.log(`🔌 Disconnecting Slack workspace ${workspaceId} for user ${session.user.id}`);
        
        await SlackDatabaseService.disconnectWorkspace(workspaceId, session.user.id);

        return NextResponse.json({
          success: true,
          message: 'Slack workspace disconnected successfully',
        });
      }

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: extract-all, export-json, export-dec-to-now, cleanup-database, get-stats, disconnect' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Slack extract API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    // Get current stats
    const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
    const embeddingStats = await SlackEmbeddingService.getEmbeddingStats(workspaceId);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        ...embeddingStats,
      },
    });

  } catch (error) {
    console.error('Slack extract GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 