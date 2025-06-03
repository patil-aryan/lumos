import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
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

    console.log('Disconnecting Confluence for user:', session.user.id);

    // Delete all Confluence workspaces for this user
    const deleted = await db
      .delete(confluenceWorkspace)
      .where(eq(confluenceWorkspace.userId, session.user.id as string));

    console.log('Confluence workspaces deleted:', deleted);

    return NextResponse.json({ 
      success: true, 
      message: 'Confluence disconnected successfully' 
    });

  } catch (error) {
    console.error('Error disconnecting Confluence:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Confluence' },
      { status: 500 }
    );
  }
} 