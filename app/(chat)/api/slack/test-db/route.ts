import { NextRequest, NextResponse } from 'next/server';
import { SlackDatabaseService } from '@/lib/slack/database';

export async function GET(req: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    // Test if we can query workspaces with a valid UUID
    const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // Valid UUID for testing
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(testUserId);
    
    return NextResponse.json({
      message: 'Database test successful',
      workspaceCount: workspaces.length,
      canConnect: true,
      testUserId,
    });
  } catch (error) {
    console.error('Database test failed:', error);
    return NextResponse.json({
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      canConnect: false,
    }, { status: 500 });
  }
} 