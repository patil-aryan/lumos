import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { jiraWorkspace } from '@/lib/db/schema-jira';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Initialize database connection
    const client = postgres(process.env.POSTGRES_URL || '');
    const db = drizzle(client);

    // Delete the workspace
    const result = await db
      .delete(jiraWorkspace)
      .where(
        and(
          eq(jiraWorkspace.id, workspaceId),
          eq(jiraWorkspace.userId, session.user.id as string)
        )
      )
      .returning({ id: jiraWorkspace.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Jira workspace disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Jira workspace:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect workspace' },
      { status: 500 }
    );
  }
} 