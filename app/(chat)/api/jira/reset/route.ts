import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { jiraWorkspace } from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Resetting Jira workspace for user:', session.user.id);

    // Delete/deactivate existing Jira workspace for this user
    const result = await db
      .update(jiraWorkspace)
      .set({
        isActive: false,
        accessToken: '',
        refreshToken: '',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jiraWorkspace.userId, session.user.id as string),
          eq(jiraWorkspace.isActive, true)
        )
      );

    console.log('Jira workspace reset completed');

    return NextResponse.json({
      success: true,
      message: 'Jira workspace reset successfully. Please reconnect to Jira.'
    });

  } catch (error) {
    console.error('Error resetting Jira workspace:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset Jira workspace',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 