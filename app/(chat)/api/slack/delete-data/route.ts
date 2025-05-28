import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { 
  slackWorkspace, 
  slackUser, 
  slackChannel, 
  slackMessage, 
  slackFile, 
  slackReaction,
  slackChannelMember,
  slackSyncLog
} from '@/lib/db/schema-new-slack';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get the workspace to verify ownership
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId as string))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify workspace belongs to user
    if (workspace[0].userId !== (session.user.id as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete all data in correct order (respecting foreign key constraints)
    console.log('Deleting Slack data for workspace:', workspaceId);

    await db.delete(slackReaction).where(eq(slackReaction.workspaceId, workspaceId as string));
    await db.delete(slackFile).where(eq(slackFile.workspaceId, workspaceId as string));
    await db.delete(slackMessage).where(eq(slackMessage.workspaceId, workspaceId as string));
    await db.delete(slackChannelMember).where(eq(slackChannelMember.workspaceId, workspaceId as string));
    await db.delete(slackChannel).where(eq(slackChannel.workspaceId, workspaceId as string));
    await db.delete(slackUser).where(eq(slackUser.workspaceId, workspaceId as string));
    await db.delete(slackSyncLog).where(eq(slackSyncLog.workspaceId, workspaceId as string));
    
    // Reset workspace stats
    await db.update(slackWorkspace)
      .set({
        lastSyncAt: null,
        lastFullSyncAt: null,
        totalChannels: '0',
        totalUsers: '0',
        totalMessages: '0',
        totalReactions: '0',
        totalThreads: '0',
        updatedAt: new Date(),
      })
      .where(eq(slackWorkspace.id, workspaceId as string));

    console.log('Successfully deleted all Slack data for workspace:', workspaceId);

    return NextResponse.json({ 
      message: 'All Slack data deleted successfully',
      workspaceId 
    });

  } catch (error) {
    console.error('Error deleting Slack data:', error);
    return NextResponse.json(
      { error: 'Failed to delete Slack data' },
      { status: 500 }
    );
  }
} 