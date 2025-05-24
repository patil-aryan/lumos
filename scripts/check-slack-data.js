const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function checkSlackData() {
  const sql = postgres(process.env.POSTGRES_URL);
  
  try {
    console.log('🔍 Checking all Slack data...\n');
    
    // Get all workspaces
    const workspaces = await sql`
      SELECT id, "teamId", "teamName", "userId", "createdAt", "isActive",
             "totalChannels", "totalUsers", "lastSyncAt"
      FROM "SlackWorkspace" 
      ORDER BY "createdAt" DESC
    `;
    
    console.log(`📊 Found ${workspaces.length} workspace(s):\n`);
    
    for (const workspace of workspaces) {
      console.log(`🏢 Workspace: ${workspace.teamName}`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Team ID: ${workspace.teamId}`);
      console.log(`   User ID: ${workspace.userId}`);
      console.log(`   Active: ${workspace.isActive}`);
      console.log(`   Created: ${workspace.createdAt}`);
      console.log(`   Total Channels: ${workspace.totalChannels || '0'}`);
      console.log(`   Total Users: ${workspace.totalUsers || '0'}`);
      console.log(`   Last Sync: ${workspace.lastSyncAt || 'Never'}`);
      
      // Check messages for this workspace
      const messages = await sql`
        SELECT COUNT(*) as count, 
               MIN("createdAt") as earliest,
               MAX("createdAt") as latest
        FROM "SlackMessage" 
        WHERE "workspaceId" = ${workspace.id}
      `;
      
      console.log(`   Messages: ${messages[0].count}`);
      if (messages[0].count > 0) {
        console.log(`   Date Range: ${messages[0].earliest} to ${messages[0].latest}`);
      }
      
      // Check channels for this workspace
      const channels = await sql`
        SELECT COUNT(*) as count
        FROM "SlackChannel" 
        WHERE "workspaceId" = ${workspace.id}
      `;
      
      console.log(`   Channels: ${channels[0].count}`);
      
      // Check users for this workspace
      const users = await sql`
        SELECT COUNT(*) as count
        FROM "SlackUser" 
        WHERE "workspaceId" = ${workspace.id}
      `;
      
      console.log(`   Users: ${users[0].count}`);
      
      // Check embeddings for this workspace
      const embeddings = await sql`
        SELECT COUNT(*) as count
        FROM "SlackMessageEmbedding" 
        WHERE "workspaceId" = ${workspace.id}
      `;
      
      console.log(`   Embeddings: ${embeddings[0].count}`);
      console.log('');
    }
    
    // Show some sample messages from the workspace with most messages
    const workspaceWithMostMessages = await sql`
      SELECT sm."workspaceId", sw."teamName", COUNT(*) as message_count
      FROM "SlackMessage" sm
      JOIN "SlackWorkspace" sw ON sm."workspaceId" = sw.id
      GROUP BY sm."workspaceId", sw."teamName"
      ORDER BY message_count DESC
      LIMIT 1
    `;
    
    if (workspaceWithMostMessages.length > 0) {
      const activeWorkspace = workspaceWithMostMessages[0];
      console.log(`🎯 Workspace with most messages: ${activeWorkspace.teamName} (${activeWorkspace.workspaceId})`);
      console.log(`   Message count: ${activeWorkspace.message_count}\n`);
      
      // Show sample messages
      const sampleMessages = await sql`
        SELECT "messageId", "channelName", "userName", "text", "timestamp", "createdAt"
        FROM "SlackMessage" 
        WHERE "workspaceId" = ${activeWorkspace.workspaceId}
        ORDER BY "createdAt" DESC
        LIMIT 5
      `;
      
      console.log('📝 Sample messages:');
      sampleMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.channelName}] ${msg.userName}: ${(msg.text || '').substring(0, 60)}${(msg.text || '').length > 60 ? '...' : ''}`);
        console.log(`      Time: ${msg.createdAt} | Slack TS: ${msg.timestamp}`);
      });
    }
    
    console.log('\n🔍 Checking for frontend workspace ID: cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8');
    const frontendWorkspace = await sql`
      SELECT id, "teamId", "teamName", "userId", "isActive"
      FROM "SlackWorkspace" 
      WHERE id = 'cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8'
    `;
    
    if (frontendWorkspace.length > 0) {
      const ws = frontendWorkspace[0];
      console.log(`✅ Found frontend workspace: ${ws.teamName}`);
      console.log(`   Team ID: ${ws.teamId}`);
      console.log(`   Active: ${ws.isActive}`);
      
      const frontendMessages = await sql`
        SELECT COUNT(*) as count
        FROM "SlackMessage" 
        WHERE "workspaceId" = 'cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8'
      `;
      
      console.log(`   Messages: ${frontendMessages[0].count}`);
    } else {
      console.log('❌ Frontend workspace ID not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

// Check if we're running this script directly
if (require.main === module) {
  checkSlackData();
}

module.exports = { checkSlackData }; 