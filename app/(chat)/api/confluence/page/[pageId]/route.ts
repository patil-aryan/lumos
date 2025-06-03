import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { ConfluenceClient } from '@/lib/confluence/client';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    // Get user's Confluence workspace
    const workspace = await db
      .select()
      .from(confluenceWorkspace)
      .where(
        and(
          eq(confluenceWorkspace.userId, session.user.id as string),
          eq(confluenceWorkspace.isActive, true)
        )
      )
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: 'No Confluence workspace found' },
        { status: 404 }
      );
    }

    const confluenceWorkspaceData = workspace[0];

    // Create Confluence client
    const confluenceClient = new ConfluenceClient(
      confluenceWorkspaceData.accessToken,
      confluenceWorkspaceData.cloudId
    );

    // Fetch the page content with full expansions
    // Try multiple approaches since API v2 structure seems different
    let page;
    try {
      page = await confluenceClient.getContentById(pageId, [
        'space',
        'version', 
        'body.storage',
        'body.view',
        'body.atlas_doc_format',
        'ancestors',
        '_links'
      ]);
    } catch (error) {
      console.log('First attempt failed, trying with minimal expansions:', error);
      try {
        page = await confluenceClient.getContentById(pageId, ['body.storage', 'body.view']);
      } catch (error2) {
        console.log('Second attempt failed, trying without expansions:', error2);
        page = await confluenceClient.getContentById(pageId);
      }
    }

    console.log('Fetched page content:', {
      id: page.id,
      title: page.title,
      hasSpace: !!page.space,
      hasVersion: !!page.version,
      hasBody: !!page.body,
      bodyKeys: page.body ? Object.keys(page.body) : 'no body',
      hasView: !!page.body?.view,
      hasStorage: !!page.body?.storage,
      viewValue: page.body?.view?.value ? 'has content' : 'no content',
      storageValue: page.body?.storage?.value ? 'has content' : 'no content',
      hasLinks: !!page._links
    });

    return NextResponse.json({
      success: true,
      data: {
        id: page.id,
        title: page.title,
        space: page.space,
        version: page.version,
        body: page.body,
        ancestors: page.ancestors,
        _links: {
          webui: page._links?.webui ? 
            (page._links.webui.startsWith('http') ? page._links.webui : `${confluenceWorkspaceData.url}/wiki${page._links.webui}`) :
            `${confluenceWorkspaceData.url}/wiki/spaces/${page.space?.key}/pages/${page.id}`
        },
        workspace: {
          name: confluenceWorkspaceData.name,
          url: confluenceWorkspaceData.url
        }
      }
    });

  } catch (error) {
    console.error('Error fetching Confluence page:', error);
    
    if (error instanceof Error && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Page not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch page content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 