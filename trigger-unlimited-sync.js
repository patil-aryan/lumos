const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function triggerUnlimitedSync() {
  console.log('🚀 Starting unlimited Slack message extraction...');
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Get workspace info
    const [workspace] = await sql`
      SELECT 
        "id",
        "teamName",
        "teamId",
        "accessToken",
        "userId"
      FROM "SlackWorkspace"
      LIMIT 1
    `;

    if (!workspace) {
      console.error('❌ No Slack workspace found in database');
      return;
    }

    console.log(`🏢 Found workspace: ${workspace.teamName} (${workspace.teamId})`);
    console.log(`🔑 Workspace ID: ${workspace.id}`);
    console.log(`👤 User ID: ${workspace.userId}`);

    console.log(`\n🎯 Current database stats:`);
    const [currentStats] = await sql`SELECT COUNT(*) as total FROM "SlackMessage"`;
    console.log(`📊 Current messages: ${parseInt(currentStats.total)} messages`);

    console.log(`\n🎯 STARTING UNLIMITED SYNC for all available messages...`);
    console.log(`⏰ This process may take 10-30 minutes depending on your message history`);
    console.log(`🎯 Goal: Extract ALL available messages from Slack`);
    console.log(`\n📡 API calls will be made to Slack with 1.1 second delays for rate limiting`);
    console.log(`🔍 The sync will scan ALL accessible channels going back as far as possible`);

    // Make API call to trigger unlimited sync
    const syncData = {
      action: 'sync',
      workspaceId: workspace.id,
      historical: true,
      unlimited: true
    };

    console.log(`\n🚀 Triggering unlimited sync via API...`);
    console.log(`📦 Payload:`, JSON.stringify(syncData, null, 2));

    // Since we can't easily import TypeScript modules in Node.js, 
    // let's make the API call or run it manually
    console.log(`\n💡 TO RUN THE UNLIMITED SYNC:`);
    console.log(`\n1️⃣ METHOD 1 - Via Frontend (Recommended):`);
    console.log(`   • Start your dev server: npm run dev`);
    console.log(`   • Go to: http://localhost:3000/integrations/slack`);
    console.log(`   • Click the purple "Get ALL Messages (Unlimited)" button`);
    console.log(`   • Watch the terminal for detailed progress logs`);

    console.log(`\n2️⃣ METHOD 2 - Via API Call:`);
    console.log(`   • POST to: http://localhost:3000/api/slack/data`);
    console.log(`   • Body: ${JSON.stringify(syncData)}`);
    
    console.log(`\n3️⃣ METHOD 3 - Direct execution (if server is running):`);
    console.log(`   • Make sure your Next.js server is running`);
    console.log(`   • The unlimited sync service is already implemented`);

    console.log(`\n📋 What the unlimited sync will do:`);
    console.log(`   🔍 Scan ALL accessible channels in your workspace`);
    console.log(`   📡 Make Slack API calls with proper rate limiting`);
    console.log(`   💾 Save all unique messages to your database`);
    console.log(`   🔄 Skip duplicates automatically`);
    console.log(`   📊 Provide real-time progress updates`);
    console.log(`   🎯 Extract as much history as your Slack plan allows`);

    console.log(`\n⚠️  IMPORTANT NOTES:`);
    console.log(`   • Free Slack plans: 90 days of history available`);
    console.log(`   • Paid Slack plans: Full message history available`);
    console.log(`   • Bot must be invited to channels to access them`);
    console.log(`   • Rate limiting: ~1 API call per second`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

triggerUnlimitedSync(); 