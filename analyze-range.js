const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function analyzeMessageRange() {
  console.log('🔍 Analyzing message date range and historical data availability...');
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Get overall date range
    const [dateRange] = await sql`
      SELECT 
        MIN("timestamp") as oldest_ts,
        MAX("timestamp") as newest_ts,
        MIN("createdAt") as first_sync,
        MAX("createdAt") as last_sync,
        COUNT(*) as total_messages
      FROM "SlackMessage"
    `;

    if (dateRange.total_messages > 0) {
      const oldestDate = new Date(parseFloat(dateRange.oldest_ts) * 1000);
      const newestDate = new Date(parseFloat(dateRange.newest_ts) * 1000);
      const daysCovered = Math.ceil((newestDate - oldestDate) / (24 * 60 * 60 * 1000));
      
      console.log('📅 MESSAGE DATE RANGE:');
      console.log(`  🟢 Oldest message: ${oldestDate.toISOString()} (${oldestDate.toDateString()})`);
      console.log(`  🔴 Newest message: ${newestDate.toISOString()} (${newestDate.toDateString()})`);
      console.log(`  📊 Total span: ${daysCovered} days`);
      console.log(`  📈 Messages per day average: ${(dateRange.total_messages / daysCovered).toFixed(1)}`);
      
      console.log('\n🔄 SYNC INFO:');
      console.log(`  🟦 First sync: ${dateRange.first_sync?.toISOString()}`);
      console.log(`  🟦 Last sync: ${dateRange.last_sync?.toISOString()}`);
    }

    // Check workspace info and sync settings
    const workspaceInfo = await sql`
      SELECT 
        "teamName",
        "createdAt" as workspace_created,
        "lastSyncAt",
        "syncStartDate",
        "totalChannels",
        "totalUsers"
      FROM "SlackWorkspace"
      LIMIT 1
    `;

    if (workspaceInfo.length > 0) {
      const workspace = workspaceInfo[0];
      console.log('\n🏢 WORKSPACE INFO:');
      console.log(`  📛 Name: ${workspace.teamName}`);
      console.log(`  🎂 Workspace created: ${workspace.workspace_created?.toISOString()}`);
      console.log(`  🔄 Last sync: ${workspace.lastSyncAt?.toISOString() || 'Never'}`);
      console.log(`  📅 Sync start date: ${workspace.syncStartDate?.toISOString() || 'Not set'}`);
      
      // Calculate potential missing history
      if (workspace.workspace_created && dateRange.oldest_ts) {
        const workspaceAge = new Date() - workspace.workspace_created;
        const oldestMessage = new Date(parseFloat(dateRange.oldest_ts) * 1000);
        const missingDays = Math.ceil((oldestMessage - workspace.workspace_created) / (24 * 60 * 60 * 1000));
        
        if (missingDays > 0) {
          console.log(`\n⚠️  POTENTIAL MISSING HISTORY:`);
          console.log(`  📉 Gap between workspace creation and oldest message: ${missingDays} days`);
          console.log(`  💡 There might be ${missingDays} days of messages not yet synced`);
        }
      }
    }

    // Check message distribution by month
    const monthlyDistribution = await sql`
      SELECT 
        DATE_TRUNC('month', TO_TIMESTAMP(CAST("timestamp" AS FLOAT))) as month,
        COUNT(*) as message_count,
        COUNT(DISTINCT "channelName") as active_channels
      FROM "SlackMessage"
      GROUP BY DATE_TRUNC('month', TO_TIMESTAMP(CAST("timestamp" AS FLOAT)))
      ORDER BY month DESC
    `;

    console.log('\n📊 MONTHLY MESSAGE DISTRIBUTION:');
    monthlyDistribution.forEach(month => {
      const monthStr = month.month.toISOString().substring(0, 7); // YYYY-MM format
      console.log(`  📅 ${monthStr}: ${month.message_count} messages across ${month.active_channels} channels`);
    });

    // Check for gaps in the data
    const dailyGaps = await sql`
      WITH daily_counts AS (
        SELECT 
          DATE(TO_TIMESTAMP(CAST("timestamp" AS FLOAT))) as message_date,
          COUNT(*) as daily_messages
        FROM "SlackMessage"
        GROUP BY DATE(TO_TIMESTAMP(CAST("timestamp" AS FLOAT)))
        ORDER BY message_date
      ),
      date_series AS (
        SELECT generate_series(
          (SELECT MIN(message_date) FROM daily_counts),
          (SELECT MAX(message_date) FROM daily_counts),
          '1 day'::interval
        )::date as expected_date
      )
      SELECT 
        ds.expected_date,
        COALESCE(dc.daily_messages, 0) as messages
      FROM date_series ds
      LEFT JOIN daily_counts dc ON ds.expected_date = dc.message_date
      WHERE COALESCE(dc.daily_messages, 0) = 0
      ORDER BY ds.expected_date
      LIMIT 10
    `;

    if (dailyGaps.length > 0) {
      console.log('\n📉 DAYS WITH NO MESSAGES (first 10):');
      dailyGaps.forEach(gap => {
        console.log(`  📅 ${gap.expected_date.toISOString().substring(0, 10)}: 0 messages`);
      });
      console.log(`  💭 This could indicate sync gaps or naturally quiet days`);
    } else {
      console.log('\n✅ No gaps found in daily message data');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

analyzeMessageRange(); 