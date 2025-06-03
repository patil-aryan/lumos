import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Resetting Confluence connection for user:', session.user.id);

    // Delete all Confluence workspaces for this user
    const deleted = await db
      .delete(confluenceWorkspace)
      .where(eq(confluenceWorkspace.userId, session.user.id as string));

    console.log('Confluence workspaces deleted:', deleted);

    return NextResponse.json({ 
      success: true, 
      message: 'Confluence connection reset successfully. You can now reconnect with proper scopes.' 
    });

  } catch (error) {
    console.error('Error resetting Confluence connection:', error);
    return NextResponse.json(
      { error: 'Failed to reset Confluence connection' },
      { status: 500 }
    );
  }
} 