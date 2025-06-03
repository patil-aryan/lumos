import { ConfluenceClient, ConfluenceSpace, ConfluencePage, ConfluenceUser } from './client';
import { 
  confluenceWorkspace, 
  confluenceSpace, 
  confluencePage, 
  confluenceUser,
  confluenceSyncLog,
  type ConfluenceWorkspace,
  type ConfluenceSpace as DBConfluenceSpace,
  type ConfluencePage as DBConfluencePage,
  type ConfluenceUser as DBConfluenceUser
} from '@/lib/db/schema-confluence';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, inArray } from 'drizzle-orm';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export interface SyncOptions {
  workspaceId: string;
  syncType: 'full' | 'incremental' | 'spaces' | 'pages' | 'users';
  forceRefresh?: boolean;
  spaceKeys?: string[];
}

export interface SyncResult {
  success: boolean;
  syncLogId: string;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  errors: string[];
  duration: number;
  details: {
    spaces?: number;
    pages?: number;
    users?: number;
  };
}

export class ConfluenceSyncService {
  private confluenceClient: ConfluenceClient;
  private workspace: ConfluenceWorkspace;

  constructor(confluenceClient: ConfluenceClient, workspace: ConfluenceWorkspace) {
    this.confluenceClient = confluenceClient;
    this.workspace = workspace;
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalItems = 0;
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;

    // Create sync log entry
    const syncLogResult = await db
      .insert(confluenceSyncLog)
      .values({
        workspaceId: options.workspaceId,
        syncType: options.syncType,
        status: 'running',
        totalItems: 0,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
      })
      .returning({ id: confluenceSyncLog.id });

    const syncLogId = syncLogResult[0].id;

    try {
      console.log(`Starting ${options.syncType} sync for workspace ${this.workspace.name}`);

      let syncDetails = {
        spaces: 0,
        pages: 0,
        users: 0
      };

      // Sync based on type
      switch (options.syncType) {
        case 'full':
          syncDetails = await this.fullSync(options, errors);
          break;
        case 'spaces':
          syncDetails.spaces = await this.syncSpaces(options, errors);
          break;
        case 'pages':
          syncDetails.pages = await this.syncPages(options, errors);
          break;
        case 'users':
          syncDetails.users = await this.syncUsers(options, errors);
          break;
        case 'incremental':
          syncDetails = await this.incrementalSync(options, errors);
          break;
      }

      totalItems = syncDetails.spaces + syncDetails.pages + syncDetails.users;
      processedItems = totalItems;
      successfulItems = totalItems - errors.length;
      failedItems = errors.length;

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Update sync log
      await db
        .update(confluenceSyncLog)
        .set({
          status: errors.length === 0 ? 'completed' : 'failed',
          totalItems,
          processedItems,
          successfulItems,
          failedItems,
          completedAt: new Date(),
          duration,
          results: syncDetails,
          errors: errors.length > 0 ? errors : null,
        })
        .where(eq(confluenceSyncLog.id, syncLogId));

      // Update workspace last sync time
      await db
        .update(confluenceWorkspace)
        .set({
          lastSyncAt: new Date(),
          lastFullSyncAt: options.syncType === 'full' ? new Date() : undefined,
          totalSpaces: syncDetails.spaces || this.workspace.totalSpaces,
          totalPages: syncDetails.pages || this.workspace.totalPages,
          totalUsers: syncDetails.users || this.workspace.totalUsers,
          updatedAt: new Date(),
        })
        .where(eq(confluenceWorkspace.id, options.workspaceId));

      console.log(`Sync completed in ${duration}s:`, syncDetails);

      return {
        success: errors.length === 0,
        syncLogId,
        totalItems,
        processedItems,
        successfulItems,
        failedItems,
        errors,
        duration,
        details: syncDetails,
      };

    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      // Update sync log with error
      await db
        .update(confluenceSyncLog)
        .set({
          status: 'failed',
          completedAt: new Date(),
          duration,
          errors: [errorMessage],
        })
        .where(eq(confluenceSyncLog.id, syncLogId));

      console.error('Sync failed:', error);

      return {
        success: false,
        syncLogId,
        totalItems: 0,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 1,
        errors,
        duration,
        details: { spaces: 0, pages: 0, users: 0 },
      };
    }
  }

  private async fullSync(options: SyncOptions, errors: string[]): Promise<{ spaces: number; pages: number; users: number }> {
    const spacesCount = await this.syncSpaces(options, errors);
    const pagesCount = await this.syncPages(options, errors);
    const usersCount = await this.syncUsers(options, errors);

    return {
      spaces: spacesCount,
      pages: pagesCount,
      users: usersCount
    };
  }

  private async incrementalSync(options: SyncOptions, errors: string[]): Promise<{ spaces: number; pages: number; users: number }> {
    // For incremental sync, only sync pages that have been updated since last sync
    const lastSync = this.workspace.lastSyncAt;
    
    if (!lastSync) {
      // No previous sync, do a full sync
      return this.fullSync(options, errors);
    }

    // For now, implement as a lightweight full sync
    // In the future, we could use CQL queries to find updated content
    const spacesCount = await this.syncSpaces(options, errors);
    const pagesCount = await this.syncPages(options, errors);
    
    return {
      spaces: spacesCount,
      pages: pagesCount,
      users: 0 // Skip users in incremental sync
    };
  }

  private async syncSpaces(options: SyncOptions, errors: string[]): Promise<number> {
    try {
      console.log('Syncing Confluence spaces...');
      
      const spaces = await this.confluenceClient.getAllSpaces();
      console.log(`Found ${spaces.length} spaces to sync`);

      let syncedCount = 0;

      for (const space of spaces) {
        try {
          // Check if space already exists
          const existingSpace = await db
            .select()
            .from(confluenceSpace)
            .where(
              and(
                eq(confluenceSpace.workspaceId, options.workspaceId),
                eq(confluenceSpace.spaceId, space.id)
              )
            )
            .limit(1);

          const spaceData = {
            workspaceId: options.workspaceId,
            spaceId: space.id,
            key: space.key,
            name: space.name,
            description: space.description?.plain?.value || null,
            type: space.type || 'global',
            status: space.status || 'current',
            homepageId: space.homepage?.id || null,
            metadata: space.metadata || null,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          };

          if (existingSpace.length > 0) {
            // Update existing space
            await db
              .update(confluenceSpace)
              .set(spaceData)
              .where(eq(confluenceSpace.id, existingSpace[0].id));
          } else {
            // Insert new space
            await db
              .insert(confluenceSpace)
              .values({
                ...spaceData,
                createdAt: new Date(),
              });
          }

          syncedCount++;
        } catch (error) {
          const errorMsg = `Failed to sync space ${space.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`Synced ${syncedCount} spaces`);
      return syncedCount;

    } catch (error) {
      const errorMsg = `Failed to fetch spaces: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return 0;
    }
  }

  private async syncPages(options: SyncOptions, errors: string[]): Promise<number> {
    try {
      console.log('Syncing Confluence pages...');

      // Get spaces to sync pages for
      let spacesToSync: DBConfluenceSpace[] = [];

      if (options.spaceKeys && options.spaceKeys.length > 0) {
        spacesToSync = await db
          .select()
          .from(confluenceSpace)
          .where(
            and(
              eq(confluenceSpace.workspaceId, options.workspaceId),
              inArray(confluenceSpace.key, options.spaceKeys)
            )
          );
      } else {
        spacesToSync = await db
          .select()
          .from(confluenceSpace)
          .where(eq(confluenceSpace.workspaceId, options.workspaceId));
      }

      let totalSyncedPages = 0;

      for (const space of spacesToSync) {
        try {
          console.log(`Syncing pages for space: ${space.key}`);
          
          const pages = await this.confluenceClient.getAllContent(space.key, 'page');
          console.log(`Found ${pages.length} pages in space ${space.key}`);

          for (const page of pages) {
            try {
              // Check if page already exists
              const existingPage = await db
                .select()
                .from(confluencePage)
                .where(
                  and(
                    eq(confluencePage.workspaceId, options.workspaceId),
                    eq(confluencePage.pageId, page.id)
                  )
                )
                .limit(1);

              const pageData = {
                workspaceId: options.workspaceId,
                spaceId: space.id,
                pageId: page.id,
                title: page.title,
                type: page.type || 'page',
                status: page.status || 'current',
                content: page.body?.storage?.value || null,
                contentHtml: page.body?.view?.value || null,
                authorId: page.version?.by?.accountId || null,
                authorDisplayName: page.version?.by?.displayName || null,
                version: page.version?.number || 1,
                webUrl: page._links?.webui || null,
                publishedAt: page.version?.when ? new Date(page.version.when) : null,
                lastSyncAt: new Date(),
                updatedAt: new Date(),
              };

              if (existingPage.length > 0) {
                // Update existing page
                await db
                  .update(confluencePage)
                  .set(pageData)
                  .where(eq(confluencePage.id, existingPage[0].id));
              } else {
                // Insert new page
                await db
                  .insert(confluencePage)
                  .values({
                    ...pageData,
                    createdAt: new Date(),
                  });
              }

              totalSyncedPages++;
            } catch (error) {
              const errorMsg = `Failed to sync page ${page.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(errorMsg);
              errors.push(errorMsg);
            }
          }

          // Update space page count
          await db
            .update(confluenceSpace)
            .set({
              pageCount: pages.length,
              lastSyncAt: new Date(),
            })
            .where(eq(confluenceSpace.id, space.id));

        } catch (error) {
          const errorMsg = `Failed to sync pages for space ${space.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`Synced ${totalSyncedPages} pages total`);
      return totalSyncedPages;

    } catch (error) {
      const errorMsg = `Failed to sync pages: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return 0;
    }
  }

  private async syncUsers(options: SyncOptions, errors: string[]): Promise<number> {
    try {
      console.log('Syncing Confluence users...');
      
      const users = await this.confluenceClient.getUsers(200, 0);
      console.log(`Found ${users.length} users to sync`);

      let syncedCount = 0;

      for (const user of users) {
        try {
          // Check if user already exists
          const existingUser = await db
            .select()
            .from(confluenceUser)
            .where(
              and(
                eq(confluenceUser.workspaceId, options.workspaceId),
                eq(confluenceUser.accountId, user.accountId)
              )
            )
            .limit(1);

          const userData = {
            workspaceId: options.workspaceId,
            accountId: user.accountId,
            displayName: user.displayName,
            emailAddress: user.email || null,
            accountType: user.accountType || 'atlassian',
            active: true,
            timeZone: user.timeZone || null,
            locale: user.locale || null,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          };

          if (existingUser.length > 0) {
            // Update existing user
            await db
              .update(confluenceUser)
              .set(userData)
              .where(eq(confluenceUser.id, existingUser[0].id));
          } else {
            // Insert new user
            await db
              .insert(confluenceUser)
              .values({
                ...userData,
                createdAt: new Date(),
              });
          }

          syncedCount++;
        } catch (error) {
          const errorMsg = `Failed to sync user ${user.accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`Synced ${syncedCount} users`);
      return syncedCount;

    } catch (error) {
      const errorMsg = `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return 0;
    }
  }

  static async createSyncService(workspaceId: string): Promise<ConfluenceSyncService | null> {
    try {
      // Get workspace from database
      const workspace = await db
        .select()
        .from(confluenceWorkspace)
        .where(eq(confluenceWorkspace.id, workspaceId))
        .limit(1);

      if (!workspace.length) {
        console.error(`Workspace ${workspaceId} not found`);
        return null;
      }

      const workspaceData = workspace[0];

      // Create Confluence client
      const confluenceClient = new ConfluenceClient(
        workspaceData.accessToken,
        workspaceData.cloudId
      );

      return new ConfluenceSyncService(confluenceClient, workspaceData);
    } catch (error) {
      console.error('Failed to create sync service:', error);
      return null;
    }
  }
} 