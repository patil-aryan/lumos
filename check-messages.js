const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { slackMessage, slackWorkspace } = require('./lib/db/schema');
const { eq, count } = require('drizzle-orm');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkMessages() {
  console.log('Checking Slack message counts...');
  
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  try {
    // Get total count of all messages
    const [totalResult] = await db.select({ count: count() }).from(slackMessage);
    console.log('📊 Total messages in database:', totalResult.count);

    // Get messages grouped by workspace
    const workspaceMessages = await db
      .select({
        workspaceId: slackMessage.workspaceId,
        count: count()
      })
      .from(slackMessage)
      .groupBy(slackMessage.workspaceId);
    
    console.log('\n🔍 Messages by workspace:');
    for (const ws of workspaceMessages) {
      // Get workspace name
      const [workspace] = await db
        .select({ teamName: slackWorkspace.teamName })
        .from(slackWorkspace)
        .where(eq(slackWorkspace.id, ws.workspaceId))
        .limit(1);
      
      console.log(`  📁 ${workspace?.teamName || 'Unknown'} (${ws.workspaceId}): ${ws.count} messages`);
    }

    // Get a sample of recent messages
    console.log('\n📝 Sample recent messages:');
    const recentMessages = await db
      .select({
        messageId: slackMessage.messageId,
        channelName: slackMessage.channelName,
        userName: slackMessage.userName,
        timestamp: slackMessage.timestamp,
        createdAt: slackMessage.createdAt,
        text: slackMessage.text
      })
      .from(slackMessage)
      .orderBy(slackMessage.createdAt)
      .limit(5);

    recentMessages.forEach((msg, idx) => {
      const humanTime = new Date(parseFloat(msg.timestamp) * 1000).toISOString();
      console.log(`  ${idx + 1}. #${msg.channelName} - ${msg.userName} at ${humanTime}`);
      console.log(`     Text: ${msg.text?.substring(0, 100)}${msg.text?.length > 100 ? '...' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMessages(); 