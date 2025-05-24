const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function detailedCheck() {
  console.log('🔍 Detailed analysis of Slack sync...');
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Check total messages
    const totalMessages = await sql`SELECT COUNT(*) as count FROM "SlackMessage"`;
    console.log('📊 Total messages in database:', parseInt(totalMessages[0].count));

    // Check messages by channel
    const channelBreakdown = await sql`
      SELECT 
        "channelName",
        COUNT(*) as message_count,
        MIN("timestamp") as oldest_ts,
        MAX("timestamp") as newest_ts,
        MIN("createdAt") as oldest_created,
        MAX("createdAt") as newest_created
      FROM "SlackMessage"
      GROUP BY "channelName"
      ORDER BY message_count DESC
    `;

    console.log('\n📋 Messages by channel:');
    let totalFromChannels = 0;
    channelBreakdown.forEach(ch => {
      const oldestDate = new Date(parseFloat(ch.oldest_ts) * 1000).toISOString().substring(0, 10);
      const newestDate = new Date(parseFloat(ch.newest_ts) * 1000).toISOString().substring(0, 10);
      console.log(`  📁 #${ch.channelName}: ${ch.message_count} messages`);
      console.log(`     Date range: ${oldestDate} to ${newestDate}`);
      console.log(`     DB created: ${ch.oldest_created?.toISOString()?.substring(0, 10)} to ${ch.newest_created?.toISOString()?.substring(0, 10)}`);
      totalFromChannels += parseInt(ch.message_count);
    });

    console.log(`\n🧮 Total from channels: ${totalFromChannels}`);

    // Check for potential duplicates by messageId
    const potentialDuplicates = await sql`
      SELECT 
        "messageId",
        "channelName",
        COUNT(*) as count
      FROM "SlackMessage"
      GROUP BY "messageId", "channelName"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 5
    `;

    if (potentialDuplicates.length > 0) {
      console.log('\n⚠️  Potential duplicates found:');
      potentialDuplicates.forEach(dup => {
        console.log(`  Message ${dup.messageId} in #${dup.channelName}: ${dup.count} copies`);
      });
    } else {
      console.log('\n✅ No duplicates found in database');
    }

    // Check message creation times to see sync patterns
    const syncPattern = await sql`
      SELECT 
        DATE("createdAt") as sync_date,
        COUNT(*) as messages_saved
      FROM "SlackMessage"
      GROUP BY DATE("createdAt")
      ORDER BY sync_date DESC
    `;

    console.log('\n📅 Messages saved by sync date:');
    syncPattern.forEach(pattern => {
      console.log(`  ${pattern.sync_date}: ${pattern.messages_saved} messages saved`);
    });

    // Check if there are messages with same timestamp but different content
    const sameTimestamp = await sql`
      SELECT 
        "timestamp",
        "channelName",
        COUNT(*) as count,
        array_agg(DISTINCT LEFT("text", 30)) as text_samples
      FROM "SlackMessage"
      GROUP BY "timestamp", "channelName"
      HAVING COUNT(*) > 1
      LIMIT 5
    `;

    if (sameTimestamp.length > 0) {
      console.log('\n🕐 Messages with same timestamp:');
      sameTimestamp.forEach(msg => {
        console.log(`  ${msg.timestamp} in #${msg.channelName}: ${msg.count} messages`);
        console.log(`     Samples: ${msg.text_samples}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

detailedCheck(); 