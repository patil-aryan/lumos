const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

// Note: We'll define the schema inline since we're in CommonJS and the schema is TypeScript
const { pgTable, text, timestamp, boolean, integer, jsonb, uuid } = require('drizzle-orm/pg-core');

// Simplified confluence workspace schema for deletion
const confluenceWorkspace = pgTable('confluence_workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  cloudId: text('cloud_id').notNull().unique(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  scopes: text('scopes'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  lastSyncAt: timestamp('last_sync_at'),
  lastFullSyncAt: timestamp('last_full_sync_at'),
  totalSpaces: integer('total_spaces').default(0),
  totalPages: integer('total_pages').default(0),
  totalBlogPosts: integer('total_blog_posts').default(0),
  totalUsers: integer('total_users').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Script to clear existing Confluence connection so you can reconnect with updated scopes
async function clearConfluenceConnection() {
  console.log('🧹 Clearing Existing Confluence Connection');
  console.log('==========================================\n');

  try {
    // Initialize database connection
    const client = postgres(process.env.POSTGRES_URL || '');
    const db = drizzle(client);

    console.log('📋 Checking existing Confluence connections...');
    
    // Get current connections
    const existingConnections = await db
      .select()
      .from(confluenceWorkspace)
      .execute();

    if (existingConnections.length === 0) {
      console.log('✅ No existing Confluence connections found');
      await client.end();
      return;
    }

    console.log(`📊 Found ${existingConnections.length} Confluence connection(s):`);
    existingConnections.forEach((conn, index) => {
      console.log(`   ${index + 1}. ${conn.name} (${conn.cloudId})`);
      console.log(`      Scopes: ${conn.scopes || 'Not recorded'}`);
      console.log(`      Created: ${conn.createdAt}`);
      console.log('');
    });

    console.log('🗑️  Removing existing connections...');
    
    // Delete all existing Confluence connections
    await db
      .delete(confluenceWorkspace)
      .execute();

    console.log(`✅ Successfully removed ${existingConnections.length} Confluence connection(s)`);
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Go to your app and navigate to integrations page');
    console.log('   2. Click "Connect Confluence" to start fresh OAuth flow');
    console.log('   3. The new connection will use all the scopes you added to the developer console');
    console.log('   4. ✨ You should now have access to comprehensive Confluence data!');

    await client.end();

  } catch (error) {
    console.error('❌ Error clearing Confluence connection:', error);
    console.error('');
    console.error('Manual cleanup instructions:');
    console.error('1. Go to your database admin interface');
    console.error('2. Delete all rows from the "confluence_workspace" table');
    console.error('3. Then try reconnecting Confluence in your app');
  }
}

// Run the cleanup
clearConfluenceConnection().catch(console.error); 