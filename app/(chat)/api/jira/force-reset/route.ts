import { NextRequest, NextResponse } from 'next/server';
import { jiraWorkspace } from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function DELETE(request: NextRequest) {
  try {
    // Force delete ALL Jira workspaces to reset everything
    const result = await db
      .delete(jiraWorkspace)
      .returning({ id: jiraWorkspace.id });

    console.log('Force reset all Jira connections:', {
      deletedWorkspaces: result.length
    });

    return NextResponse.json({
      success: true,
      message: 'All Jira connections force-reset',
      deletedWorkspaces: result.length
    });

  } catch (error) {
    console.error('Error force-resetting Jira:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to force reset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 