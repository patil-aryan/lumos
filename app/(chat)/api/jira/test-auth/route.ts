import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
import { jiraWorkspace } from '@/lib/db/schema-jira';
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

    console.log('Testing Jira authentication...');

    // Get user's Jira workspace
    const workspace = await db
      .select()
      .from(jiraWorkspace)
      .where(
        and(
          eq(jiraWorkspace.userId, session.user.id as string),
          eq(jiraWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({
        success: false,
        error: 'No Jira workspace found. Please connect to Jira first.',
        needsAuth: true
      });
    }

    const jiraWorkspaceData = workspace[0];
    
    console.log('Found workspace:', {
      id: jiraWorkspaceData.id,
      name: jiraWorkspaceData.name,
      cloudId: jiraWorkspaceData.cloudId,
      hasAccessToken: !!jiraWorkspaceData.accessToken,
      hasRefreshToken: !!jiraWorkspaceData.refreshToken,
      expiresAt: jiraWorkspaceData.expiresAt,
      scopes: jiraWorkspaceData.scopes
    });

    // Check token expiry
    const now = new Date();
    const tokenExpired = jiraWorkspaceData.expiresAt && jiraWorkspaceData.expiresAt <= now;
    
    if (tokenExpired) {
      console.log('Token is expired, attempting refresh...');
      
      if (!jiraWorkspaceData.refreshToken) {
        return NextResponse.json({
          success: false,
          error: 'Token expired and no refresh token available',
          needsAuth: true
        });
      }

      try {
        // Refresh the token
        const tokenResponse = await JiraClient.refreshAccessToken(jiraWorkspaceData.refreshToken);
        
        const newExpiresAt = tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null;

        // Update the workspace with new tokens
        await db
          .update(jiraWorkspace)
          .set({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: newExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(jiraWorkspace.id, jiraWorkspaceData.id));

        console.log('Token refreshed successfully');
        
        // Update workspace data for testing
        jiraWorkspaceData.accessToken = tokenResponse.access_token;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json({
          success: false,
          error: 'Token refresh failed',
          details: refreshError instanceof Error ? refreshError.message : 'Unknown error',
          needsAuth: true
        });
      }
    }

    // Test API calls one by one
    const testResults = {
      serverInfo: null as any,
      projects: null as any,
      users: null as any,
      issues: null as any
    };

    const jiraClient = new JiraClient(jiraWorkspaceData.accessToken, jiraWorkspaceData.cloudId);

    // Test 1: Server Info
    try {
      console.log('Testing server info...');
      testResults.serverInfo = await jiraClient.getServerInfo();
      console.log('Server info test: SUCCESS');
    } catch (error: any) {
      console.error('Server info test: FAILED', error.response?.status, error.message);
      testResults.serverInfo = { 
        error: error.message, 
        status: error.response?.status,
        statusText: error.response?.statusText 
      };
    }

    // Test 2: Projects
    try {
      console.log('Testing projects...');
      const projects = await jiraClient.getProjects();
      testResults.projects = { count: projects.length, success: true };
      console.log('Projects test: SUCCESS', projects.length, 'projects found');
    } catch (error: any) {
      console.error('Projects test: FAILED', error.response?.status, error.message);
      testResults.projects = { 
        error: error.message, 
        status: error.response?.status,
        statusText: error.response?.statusText 
      };
    }

    // Test 3: Users
    try {
      console.log('Testing users...');
      const users = await jiraClient.getUsers(10);
      testResults.users = { count: users.length, success: true };
      console.log('Users test: SUCCESS', users.length, 'users found');
    } catch (error: any) {
      console.error('Users test: FAILED', error.response?.status, error.message);
      testResults.users = { 
        error: error.message, 
        status: error.response?.status,
        statusText: error.response?.statusText 
      };
    }

    // Test 4: Issues (simple search)
    try {
      console.log('Testing issues...');
      const result = await jiraClient.searchIssues('created >= -7d ORDER BY created DESC', undefined, undefined, 10);
      testResults.issues = { count: result.issues.length, total: result.total, success: true };
      console.log('Issues test: SUCCESS', result.issues.length, 'issues found');
    } catch (error: any) {
      console.error('Issues test: FAILED', error.response?.status, error.message);
      testResults.issues = { 
        error: error.message, 
        status: error.response?.status,
        statusText: error.response?.statusText 
      };
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: jiraWorkspaceData.id,
        name: jiraWorkspaceData.name,
        url: jiraWorkspaceData.url,
        cloudId: jiraWorkspaceData.cloudId,
        scopes: jiraWorkspaceData.scopes,
        tokenExpiry: jiraWorkspaceData.expiresAt
      },
      testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Jira test auth error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 