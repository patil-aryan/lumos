import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { ConfluenceSyncService, type SyncOptions } from '@/lib/confluence/sync';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch (error) {
      console.warn('Failed to parse request body, using defaults:', error);
    }
    
    const { syncType = 'incremental', spaceKeys } = body as any;

    // Validate sync type
    const validSyncTypes = ['full', 'incremental', 'spaces', 'pages', 'users'];
    if (!validSyncTypes.includes(syncType)) {
      return NextResponse.json({ 
        error: `Invalid sync type. Must be one of: ${validSyncTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Get user's Confluence workspace
    const workspace = await db
      .select()
      .from(confluenceWorkspace)
      .where(
        and(
          eq(confluenceWorkspace.userId, session.user.id as string),
          eq(confluenceWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: 'No Confluence workspace found. Please connect your Confluence account first.' },
        { status: 404 }
      );
    }

    const confluenceWorkspaceData = workspace[0];

    console.log(`Starting ${syncType} sync for workspace:`, {
      id: confluenceWorkspaceData.id,
      name: confluenceWorkspaceData.name,
      cloudId: confluenceWorkspaceData.cloudId
    });

    // Create sync service
    const syncService = await ConfluenceSyncService.createSyncService(confluenceWorkspaceData.id);
    if (!syncService) {
      return NextResponse.json(
        { error: 'Failed to create sync service' },
        { status: 500 }
      );
    }

    // Prepare sync options
    const syncOptions: SyncOptions = {
      workspaceId: confluenceWorkspaceData.id,
      syncType,
      spaceKeys: Array.isArray(spaceKeys) ? spaceKeys : undefined,
    };

    // Start sync (runs in background)
    const syncResult = await syncService.sync(syncOptions);

    return NextResponse.json({
      success: syncResult.success,
      message: `${syncType} sync ${syncResult.success ? 'completed' : 'failed'}`,
      sync: {
        id: syncResult.syncLogId,
        type: syncType,
        workspace: {
          id: confluenceWorkspaceData.id,
          name: confluenceWorkspaceData.name,
        },
        result: {
          totalItems: syncResult.totalItems,
          processedItems: syncResult.processedItems,
          successfulItems: syncResult.successfulItems,
          failedItems: syncResult.failedItems,
          duration: syncResult.duration,
          details: syncResult.details,
        },
        errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in Confluence sync endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to start Confluence sync',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Confluence workspace
    const workspace = await db
      .select()
      .from(confluenceWorkspace)
      .where(
        and(
          eq(confluenceWorkspace.userId, session.user.id as string),
          eq(confluenceWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: 'No Confluence workspace found' },
        { status: 404 }
      );
    }

    const confluenceWorkspaceData = workspace[0];

    return NextResponse.json({
      workspace: {
        id: confluenceWorkspaceData.id,
        name: confluenceWorkspaceData.name,
        url: confluenceWorkspaceData.url,
        lastSyncAt: confluenceWorkspaceData.lastSyncAt,
        lastFullSyncAt: confluenceWorkspaceData.lastFullSyncAt,
        stats: {
          totalSpaces: confluenceWorkspaceData.totalSpaces || 0,
          totalPages: confluenceWorkspaceData.totalPages || 0,
          totalUsers: confluenceWorkspaceData.totalUsers || 0,
        },
      },
      availableSyncTypes: [
        { type: 'incremental', description: 'Sync recent changes' },
        { type: 'full', description: 'Full sync of all data' },
        { type: 'spaces', description: 'Sync spaces only' },
        { type: 'pages', description: 'Sync pages only' },
        { type: 'users', description: 'Sync users only' },
      ],
    });

  } catch (error) {
    console.error('Error getting Confluence sync status:', error);
    
    return NextResponse.json({
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 