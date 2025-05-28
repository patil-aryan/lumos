import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { SlackDatabaseService } from '@/lib/slack/database';
import { DateRangeSlackSyncService, type DateRangeSyncOptions } from '@/lib/slack/date-range-sync';

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
      case 'date-range-sync': {
        const { 
          startDate, 
          endDate, 
          includeChannels = true, 
          includeDirectMessages = true, 
          includeBots = false,
          exportAsJson = false 
        } = options;

        if (!startDate || !endDate) {
          return NextResponse.json({ 
            error: 'Start date and end date are required' 
          }, { status: 400 });
        }

        const syncOptions: DateRangeSyncOptions = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          includeChannels,
          includeDirectMessages,
          includeBots,
          exportAsJson,
        };

        // Start sync in background
        DateRangeSlackSyncService.performDateRangeWorkspaceSync(
          workspaceId,
          session.user.id,
          syncOptions,
          (progress) => {
            // Could implement WebSocket or Server-Sent Events for real-time updates
            console.log('Sync progress:', progress);
          }
        ).then((result) => {
          console.log('Date range sync completed:', result);
        }).catch((error) => {
          console.error('Date range sync failed:', error);
        });

        return NextResponse.json({
          success: true,
          message: `Date range sync started for ${startDate} to ${endDate}`,
          options: syncOptions,
        });
      }

      case 'export-json': {
        const { startDate, endDate } = options;
        
        if (!startDate || !endDate) {
          return NextResponse.json({ 
            error: 'Start date and end date are required for export' 
          }, { status: 400 });
        }

        const syncOptions: DateRangeSyncOptions = {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          includeChannels: true,
          includeDirectMessages: true,
          includeBots: false,
          exportAsJson: true,
        };

        const result = await DateRangeSlackSyncService.performDateRangeWorkspaceSync(
          workspaceId,
          session.user.id,
          syncOptions
        );

        if (result.exportData) {
          // Return JSON data for download
          return new NextResponse(JSON.stringify(result.exportData, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="slack-export-${startDate}-to-${endDate}.json"`,
            },
          });
        } else {
          return NextResponse.json({ 
            error: 'No data found for the specified date range' 
          }, { status: 404 });
        }
      }

      case 'cleanup-database': {
        console.log(`🗑️ Cleaning up Slack data for workspace ${workspaceId}`);
        
        await SlackDatabaseService.deleteAllWorkspaceData(workspaceId);

        return NextResponse.json({
          success: true,
          message: 'All Slack data has been deleted from the database',
        });
      }

      case 'get-current-range': {
        // Get the current date range of messages in the database
        const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
        
        // Get actual message date range from database
        const client = require('postgres')(process.env.POSTGRES_URL);
        const [dateRange] = await client`
          SELECT 
            MIN("timestamp") as oldest_ts,
            MAX("timestamp") as newest_ts,
            COUNT(*) as total_messages
          FROM "SlackMessage"
          WHERE "workspaceId" = ${workspaceId}
        `;
        
        await client.end();

        let currentRange = null;
        if (dateRange && dateRange.total_messages > 0) {
          currentRange = {
            oldestDate: new Date(parseFloat(dateRange.oldest_ts) * 1000).toISOString(),
            newestDate: new Date(parseFloat(dateRange.newest_ts) * 1000).toISOString(),
            totalMessages: parseInt(dateRange.total_messages),
          };
        }

        return NextResponse.json({
          success: true,
          currentRange,
          stats,
        });
      }

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: date-range-sync, export-json, cleanup-database, get-current-range' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Date range API error:', error);
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

    // Get current data range and stats
    const stats = await SlackDatabaseService.getWorkspaceStats(workspaceId);
    
    // Get actual message date range from database
    const client = require('postgres')(process.env.POSTGRES_URL);
    const [dateRange] = await client`
      SELECT 
        MIN("timestamp") as oldest_ts,
        MAX("timestamp") as newest_ts,
        COUNT(*) as total_messages
      FROM "SlackMessage"
      WHERE "workspaceId" = ${workspaceId}
    `;
    
    await client.end();

    let currentRange = null;
    if (dateRange && dateRange.total_messages > 0) {
      currentRange = {
        oldestDate: new Date(parseFloat(dateRange.oldest_ts) * 1000).toISOString(),
        newestDate: new Date(parseFloat(dateRange.newest_ts) * 1000).toISOString(),
        totalMessages: parseInt(dateRange.total_messages),
      };
    }

    return NextResponse.json({
      success: true,
      currentRange,
      stats,
    });

  } catch (error) {
    console.error('Date range GET API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 