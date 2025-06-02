import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { JiraClient } from '@/lib/jira/client';
import { JiraTokenManager } from '@/lib/jira/token-manager';
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
      return NextResponse.json(
        { error: 'No Jira workspace found' },
        { status: 404 }
      );
    }

    const jiraWorkspaceData = workspace[0];

    console.log('=== TESTING JIRA ISSUE DATA ===');

    // Test issue fetching with different field configurations
    const testConfigurations = [
      {
        name: 'Default fields',
        fields: undefined,
        jql: 'ORDER BY created DESC'
      },
      {
        name: 'Minimal fields',
        fields: ['summary', 'status', 'priority', 'assignee', 'created', 'updated', 'project'],
        jql: 'ORDER BY created DESC'
      },
      {
        name: 'Just key and summary',
        fields: ['summary'],
        jql: 'ORDER BY created DESC'
      }
    ];

    const results = [];

    for (const config of testConfigurations) {
      try {
        console.log(`Testing ${config.name}...`);
        
        const issues = await JiraTokenManager.handleTokenRefresh(
          jiraWorkspaceData,
          async (jiraClient: JiraClient) => {
            const result = await jiraClient.searchIssues(config.jql, config.fields, undefined, 3);
            return result.issues;
          }
        );

        const transformedIssues = issues.map((issue: any) => ({
          key: issue.key,
          summary: issue.fields?.summary,
          status: issue.fields?.status?.name,
          priority: issue.fields?.priority?.name,
          assignee: issue.fields?.assignee?.displayName,
          created: issue.fields?.created,
          updated: issue.fields?.updated,
          project: issue.fields?.project?.name,
          projectKey: issue.fields?.project?.key,
          rawFields: Object.keys(issue.fields || {}),
          rawIssue: issue // Include full raw data for debugging
        }));

        results.push({
          configuration: config.name,
          success: true,
          issueCount: issues.length,
          sampleIssue: transformedIssues[0] || null,
          allIssues: transformedIssues
        });

        console.log(`${config.name} - Success: ${issues.length} issues`);

      } catch (error: any) {
        console.error(`${config.name} - Error:`, error.message);
        results.push({
          configuration: config.name,
          success: false,
          error: error.message,
          statusCode: error.response?.status,
          responseData: error.response?.data
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workspace: {
        id: jiraWorkspaceData.id,
        name: jiraWorkspaceData.name,
        cloudId: jiraWorkspaceData.cloudId
      },
      testResults: results
    });

  } catch (error) {
    console.error('Test issues endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 