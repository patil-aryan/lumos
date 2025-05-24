const { spawn, exec } = require('child_process');
const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function startDevServerAndSync() {
  console.log('🚀 Starting dev server and triggering unlimited sync...');
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Get workspace info
    const [workspace] = await sql`
      SELECT "id", "teamName" FROM "SlackWorkspace" LIMIT 1
    `;

    if (!workspace) {
      console.error('❌ No Slack workspace found');
      return;
    }

    console.log(`🏢 Found workspace: ${workspace.teamName}`);
    console.log(`🔑 Workspace ID: ${workspace.id}`);

    // Get current message count
    const [currentStats] = await sql`SELECT COUNT(*) as total FROM "SlackMessage"`;
    const startingCount = parseInt(currentStats.total);
    console.log(`📊 Current messages in database: ${startingCount}`);

    console.log(`\n🎯 INSTRUCTIONS FOR UNLIMITED SYNC:`);
    console.log(`\n1️⃣ The unlimited sync button is already implemented in your frontend`);
    console.log(`2️⃣ To run the unlimited sync:`);
    console.log(`   • Start your dev server: npm run dev`);
    console.log(`   • Open: http://localhost:3000/integrations/slack`);
    console.log(`   • Click the purple "Get ALL Messages (Unlimited)" button`);
    console.log(`   • Watch the terminal for detailed progress logs`);

    console.log(`\n🎯 WHAT THE UNLIMITED SYNC WILL DO:`);
    console.log(`   🔍 Scan ALL accessible channels in your workspace`);
    console.log(`   📡 Make rate-limited API calls to Slack (1.1s delays)`);
    console.log(`   💾 Save all unique messages to your database`);
    console.log(`   🔄 Skip duplicates automatically`);
    console.log(`   📊 Provide real-time progress updates in terminal`);
    console.log(`   🎯 Extract as much history as your Slack plan allows`);

    console.log(`\n⚠️  IMPORTANT NOTES:`);
    console.log(`   • Free Slack plans: 90 days of history available`);
    console.log(`   • Paid Slack plans: Full message history available`);
    console.log(`   • Bot must be invited to channels to access them`);
    console.log(`   • Process may take 10-30 minutes depending on history`);

    console.log(`\n🚀 YOUR SYNC PARAMETERS:`);
    console.log(`   📦 Workspace ID: ${workspace.id}`);
    console.log(`   📊 Starting count: ${startingCount} messages`);
    console.log(`   🎯 Goal: Extract ALL available messages`);

    console.log(`\n💡 ALTERNATIVE - Start dev server now? (y/n)`);
    console.log(`   If you want, I can start the dev server for you right now.`);
    console.log(`   Just press Ctrl+C when you're done with the sync.`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

startDevServerAndSync(); 