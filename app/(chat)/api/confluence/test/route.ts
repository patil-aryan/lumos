import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { ConfluenceClient } from '@/lib/confluence/client';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const forceReconnect = searchParams.get('force_reconnect') === 'true';

    // If force reconnect is requested, clear existing connections
    if (forceReconnect) {
      console.log('🔄 Force reconnect requested - clearing existing Confluence connections...');
      try {
        await db
          .delete(confluenceWorkspace)
          .where(eq(confluenceWorkspace.userId, session.user.id as string))
          .execute();
        
        return NextResponse.json({
          success: true,
          message: 'Existing Confluence connections cleared. Please reconnect.',
          action: 'reconnect_required'
        });
      } catch (error) {
        console.error('Failed to clear connections:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to clear existing connections',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // Get the user's Confluence workspace
    const confluenceWorkspaceData = await db
      .select()
      .from(confluenceWorkspace)
      .where(
        and(
          eq(confluenceWorkspace.userId, session.user.id as string),
          eq(confluenceWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (confluenceWorkspaceData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active Confluence workspace found. Please connect Confluence first.',
        action: 'connect_required'
      }, { status: 404 });
    }

    const workspace = confluenceWorkspaceData[0];
    
    // Create Confluence client and test connection
    const confluenceClient = new ConfluenceClient(workspace.accessToken, workspace.cloudId);
    
    console.log('Testing Confluence connection with current scopes:', workspace.scopes);
    
    const isConnected = await confluenceClient.testConnection();
    
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to Confluence API - likely scope mismatch',
        workspace: {
          name: workspace.name,
          url: workspace.url,
          scopes: workspace.scopes
        },
        solution: 'Use ?force_reconnect=true to clear and reconnect with updated scopes'
      }, { status: 503 });
    }

    // Try to fetch a small amount of data to verify permissions
    let testResults = {
      spaces: 0,
      content: 0,
      hasPermissions: true,
      errors: [] as string[],
      scopeValidation: ConfluenceClient.validateScopes(workspace.scopes || '')
    };

    try {
      const spacesResponse = await confluenceClient.getSpaces(5);
      testResults.spaces = spacesResponse.results?.length || 0;
      
      if (testResults.spaces > 0) {
        try {
          const contentResponse = await confluenceClient.getContent('page', undefined, 5);
          testResults.content = contentResponse.results?.length || 0;
        } catch (error) {
          testResults.errors.push('Failed to fetch content: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    } catch (error) {
      testResults.hasPermissions = false;
      testResults.errors.push('Failed to fetch spaces: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    return NextResponse.json({
      success: true,
      connection: 'established',
      workspace: {
        id: workspace.id,
        name: workspace.name,
        url: workspace.url,
        cloudId: workspace.cloudId,
        scopes: workspace.scopes,
        lastSync: workspace.lastSyncAt,
      },
      test: testResults,
      timestamp: new Date().toISOString(),
      actions: {
        force_reconnect: '/api/confluence/test?force_reconnect=true'
      }
    });

  } catch (error) {
    console.error('Error testing Confluence connection:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test Confluence connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 