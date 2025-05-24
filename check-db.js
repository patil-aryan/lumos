const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkDatabase() {
  console.log('Checking Slack message database...');
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Check total messages
    const totalMessages = await sql`SELECT COUNT(*) as count FROM "SlackMessage"`;
    console.log('📊 Total messages in database:', parseInt(totalMessages[0].count));

    // Check messages by workspace
    const workspaceMessages = await sql`
      SELECT 
        sw."teamName",
        sw."id" as workspace_id,
        COUNT(sm.*) as message_count
      FROM "SlackWorkspace" sw
      LEFT JOIN "SlackMessage" sm ON sm."workspaceId" = sw."id"
      GROUP BY sw."id", sw."teamName"
      ORDER BY message_count DESC
    `;

    console.log('\n🔍 Messages by workspace:');
    workspaceMessages.forEach(ws => {
      console.log(`  📁 ${ws.teamName}: ${ws.message_count} messages`);
    });

    // Check recent messages sample
    const recentMessages = await sql`
      SELECT 
        "channelName",
        "userName", 
        "timestamp",
        "createdAt",
        LEFT("text", 50) as text_preview
      FROM "SlackMessage"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    console.log('\n📝 Recent messages sample:');
    recentMessages.forEach((msg, idx) => {
      const humanTime = new Date(parseFloat(msg.timestamp) * 1000).toISOString();
      console.log(`  ${idx + 1}. #${msg.channelName} - ${msg.userName} at ${humanTime}`);
      console.log(`     Text: ${msg.text_preview}...`);
    });

    // Check for duplicate detection
    const duplicates = await sql`
      SELECT "messageId", "workspaceId", COUNT(*) as count
      FROM "SlackMessage"
      GROUP BY "messageId", "workspaceId"
      HAVING COUNT(*) > 1
      LIMIT 10
    `;

    if (duplicates.length > 0) {
      console.log('\n⚠️  Found duplicate messages:');
      duplicates.forEach(dup => {
        console.log(`  Message ${dup.messageId}: ${dup.count} duplicates`);
      });
    } else {
      console.log('\n✅ No duplicate messages found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

checkDatabase(); 