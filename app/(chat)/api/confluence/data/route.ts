import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { ConfluenceClient, ConfluenceUser, ConfluenceSpace, ConfluencePage } from '@/lib/confluence/client';
import { confluenceWorkspace } from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

async function refreshTokenIfNeeded(workspace: any) {
  // Check if token is expired or expires soon (within 5 minutes)
  if (workspace.expiresAt && new Date(workspace.expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    console.log('Token expires soon, refreshing...');
    
    try {
      const tokenResponse = await ConfluenceClient.refreshAccessToken(workspace.refreshToken);
      
      // Update workspace with new tokens
      const expiresAt = tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      await db
        .update(confluenceWorkspace)
        .set({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(confluenceWorkspace.id, workspace.id));

      console.log('Confluence token refreshed successfully');
      return tokenResponse.access_token;
    } catch (error) {
      console.error('Failed to refresh Confluence token:', error);
      throw new Error('Token refresh failed');
    }
  }
  
  return workspace.accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    console.log('Fetching Confluence data for workspace:', {
      id: confluenceWorkspaceData.id,
      name: confluenceWorkspaceData.name,
      cloudId: confluenceWorkspaceData.cloudId
    });

    // Check and refresh token if needed
    const accessToken = await refreshTokenIfNeeded(confluenceWorkspaceData);

    // Create Confluence client
    const confluenceClient = new ConfluenceClient(
      accessToken,
      confluenceWorkspaceData.cloudId
    );

    // Test connection first
    const isConnected = await confluenceClient.testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Failed to connect to Confluence' },
        { status: 503 }
      );
    }

    console.log('Confluence connection successful, fetching data...');

    try {
      // Fetch spaces (with error handling)
      let spaces: ConfluenceSpace[] = [];
      try {
        const spacesResponse = await confluenceClient.getSpaces(50, undefined, ['description', '_links']);
        spaces = spacesResponse.results || [];
        console.log(`Fetched ${spaces.length} spaces`);
      } catch (error) {
        console.error('Failed to fetch spaces:', error);
        spaces = [];
      }

      // Fetch recent content from multiple spaces with proper expansions
      let recentContent: ConfluencePage[] = [];
      let totalContent = 0;

      if (spaces.length > 0) {
        // Fetch content from the first 5 spaces to avoid overwhelming the API
        const spacesToFetch = spaces.slice(0, 5);
        
        for (const space of spacesToFetch) {
          try {
            // Use the default expand parameters which should include version data
            const contentResponse = await confluenceClient.getPages(space.key, 20, undefined);
            const spaceContent = contentResponse.results || [];
            
            // Debug logging to see what data we're actually getting
            if (spaceContent.length > 0) {
              const samplePage = spaceContent[0];
              console.log(`Sample page data from space ${space.key}:`, {
                id: samplePage.id,
                title: samplePage.title,
                hasSpace: !!samplePage.space,
                spaceKey: samplePage.space?.key,
                spaceName: samplePage.space?.name,
                hasVersion: !!samplePage.version,
                versionNumber: samplePage.version?.number,
                versionWhen: samplePage.version?.when,
                hasAuthor: !!samplePage.version?.by,
                authorName: samplePage.version?.by?.displayName,
                authorAccountId: samplePage.version?.by?.accountId,
                hasLinks: !!samplePage._links,
                webUILink: samplePage._links?.webui,
                allVersionFields: samplePage.version ? Object.keys(samplePage.version) : 'no version',
                allPageFields: Object.keys(samplePage)
              });
            }
            
            recentContent = [...recentContent, ...spaceContent];
            totalContent += contentResponse.size || spaceContent.length;
            
            console.log(`Fetched ${spaceContent.length} pages from space ${space.key}`);
          } catch (error) {
            console.error(`Failed to fetch content for space ${space.key}:`, error);
          }
        }
      } else {
        // Fallback: fetch all content if no spaces found
        try {
          const contentResponse = await confluenceClient.getPages(undefined, 50, undefined);
          recentContent = contentResponse.results || [];
          totalContent = contentResponse.size || recentContent.length;
          
          if (recentContent.length > 0) {
            const samplePage = recentContent[0];
            console.log('Sample page data (fallback):', {
              id: samplePage.id,
              title: samplePage.title,
              hasSpace: !!samplePage.space,
              spaceKey: samplePage.space?.key,
              hasVersion: !!samplePage.version,
              versionNumber: samplePage.version?.number,
              versionWhen: samplePage.version?.when,
              hasAuthor: !!samplePage.version?.by,
              authorName: samplePage.version?.by?.displayName,
              hasLinks: !!samplePage._links,
              webUILink: samplePage._links?.webui
            });
          }
          
          console.log(`Fetched ${recentContent.length} pages (fallback)`);
        } catch (error) {
          console.error('Failed to fetch content (fallback):', error);
          recentContent = [];
        }
      }

      // Sort content by last modified date
      recentContent.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.version?.createdAt || a.version?.when || 0);
        const dateB = new Date(b.createdAt || b.version?.createdAt || b.version?.when || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Create a simple space lookup map
      const spaceLookup = new Map(spaces.map(space => [space.id, space]));

      // Collect all unique author IDs for user lookup
      const authorIds = new Set<string>();
      recentContent.forEach(page => {
        if (page.authorId) authorIds.add(page.authorId);
        if (page.version?.authorId) authorIds.add(page.version.authorId);
      });

      // Fetch user information for authors
      const userLookup = new Map<string, string>();
      console.log(`Found ${authorIds.size} unique author IDs, attempting to fetch user details...`);
      
      for (const authorId of authorIds) {
        try {
          const user = await confluenceClient.getUserById(authorId);
          userLookup.set(authorId, user.displayName || user.publicName || `User ${authorId}`);
          console.log(`Fetched user: ${authorId} -> ${user.displayName || user.publicName}`);
        } catch (error) {
          console.warn(`Failed to fetch user ${authorId}:`, error);
          // Create a cleaner fallback name from the authorId
          let cleanName = 'Unknown User';
          if (authorId && authorId !== 'unknown') {
            // Extract a readable part from account IDs like "712020:26988aed-b484-47be-93ce-99cf99ce872e"
            const parts = authorId.split(':');
            if (parts.length === 2) {
              cleanName = `User ${parts[0]}`;
            } else {
              cleanName = `User ${authorId.substring(0, 8)}`;
            }
          }
          userLookup.set(authorId, cleanName);
        }
      }

      // Fetch users (sample from content creators)
      let users: ConfluenceUser[] = [];
      try {
        users = await confluenceClient.getUsers(50, 0);
        console.log(`Fetched ${users.length} users`);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        users = [];
      }

      // Update workspace stats
      try {
        await db
          .update(confluenceWorkspace)
          .set({
            totalSpaces: spaces.length,
            totalPages: totalContent,
            totalUsers: users.length,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(confluenceWorkspace.id, confluenceWorkspaceData.id));
      } catch (error) {
        console.error('Failed to update workspace stats:', error);
      }

      const response = {
        success: true,
        data: {
          workspace: {
            id: confluenceWorkspaceData.id,
            name: confluenceWorkspaceData.name,
            url: confluenceWorkspaceData.url,
            cloudId: confluenceWorkspaceData.cloudId,
            connectedAt: confluenceWorkspaceData.createdAt?.toISOString() || new Date().toISOString(),
            lastSyncAt: confluenceWorkspaceData.lastSyncAt?.toISOString() || null,
          },
          stats: {
            spaces: spaces.length,
            pages: totalContent,
            users: users.length,
          },
          spacesList: spaces.slice(0, 10).map(space => ({
            id: space.id,
            key: space.key,
            name: space.name,
            _links: {
              webui: space._links?.webui ? 
                (space._links.webui.startsWith('http') ? space._links.webui : `${confluenceWorkspaceData.url}/wiki${space._links.webui}`) :
                `${confluenceWorkspaceData.url}/wiki/spaces/${space.key}`
            },
          })),
          pagesList: recentContent.slice(0, 20).map(page => {
            const pageSpace = spaceLookup.get(page.spaceId || '');
            return {
              id: page.id,
              title: page.title,
              space: page.space || (pageSpace ? {
                id: pageSpace.id,
                key: pageSpace.key,
                name: pageSpace.name
              } : undefined),
              version: {
                number: page.version?.number || 1,
                when: page.createdAt || page.version?.createdAt || page.version?.when || new Date().toISOString(),
                by: {
                  accountId: page.authorId || page.version?.authorId || 'unknown',
                  displayName: userLookup.get(page.authorId || page.version?.authorId || 'unknown') || 'Unknown User',
                  email: undefined
                }
              },
              _links: {
                webui: page._links?.webui ? 
                  (page._links.webui.startsWith('http') ? page._links.webui : `${confluenceWorkspaceData.url}/wiki${page._links.webui}`) :
                  `${confluenceWorkspaceData.url}/wiki/spaces/${pageSpace?.key || 'unknown'}/pages/${page.id}`
              },
            };
          }),
          connectionStatus: 'healthy' as const,
        },
      };

      console.log('Confluence data fetch completed successfully:', {
        spaces: response.data.stats.spaces,
        pages: response.data.stats.pages,
        users: response.data.stats.users
      });

      return NextResponse.json(response);

    } catch (error) {
      console.error('Error fetching Confluence data:', error);
      
      // Check if it's an auth error
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        return NextResponse.json(
          { error: 'Confluence authentication failed. Please reconnect your account.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch Confluence data',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in Confluence data endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 