const postgres = require('postgres');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Import the unlimited sync service using dynamic import
async function runUnlimitedSync() {
  console.log('🚀 UNLIMITED SLACK MESSAGE EXTRACTION STARTING...');
  console.log('⏰ Time:', new Date().toISOString());
  
  const sql = postgres(process.env.POSTGRES_URL);

  try {
    // Get workspace info
    const [workspace] = await sql`
      SELECT * FROM "SlackWorkspace" LIMIT 1
    `;

    if (!workspace) {
      console.error('❌ No Slack workspace found');
      return;
    }

    console.log(`\n🏢 WORKSPACE: ${workspace.teamName}`);
    console.log(`🔑 ID: ${workspace.id}`);
    console.log(`👤 User: ${workspace.userId}`);

    // Get current stats
    const [currentStats] = await sql`SELECT COUNT(*) as total FROM "SlackMessage"`;
    const startingMessageCount = parseInt(currentStats.total);
    console.log(`📊 Starting with: ${startingMessageCount} messages`);

    // Dynamic import of the unlimited sync service
    console.log(`\n🔧 Loading unlimited sync service...`);
    
    // Create workspace object
    const workspaceObj = {
      id: workspace.id,
      teamId: workspace.teamId,
      teamName: workspace.teamName,
      accessToken: workspace.accessToken,
      botUserId: workspace.botUserId,
      userId: workspace.userId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      isActive: workspace.isActive,
      syncStartDate: workspace.syncStartDate,
      lastSyncAt: workspace.lastSyncAt,
      totalChannels: workspace.totalChannels,
      totalUsers: workspace.totalUsers,
      syncSettings: workspace.syncSettings
    };

    // Load the classes dynamically
    const { UnlimitedSlackSyncService } = await import('./lib/slack/unlimited-sync.js');
    
    console.log(`✅ Service loaded successfully`);
    console.log(`\n🎯 STARTING UNLIMITED MESSAGE EXTRACTION...`);
    console.log(`🔥 This will extract ALL available messages from your Slack workspace`);
    console.log(`⏰ Expected duration: 5-30 minutes depending on message history`);
    console.log(`📡 Rate limited to ~1 API call per second`);

    // Create progress tracker
    let lastProgressTime = Date.now();
    const onProgress = (progress) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastProgressTime;
      
      // Only log progress every 5 seconds to avoid spam
      if (timeSinceLastUpdate > 5000) {
        const percent = progress.totalChannels > 0 ? 
          Math.round((progress.processedChannels / progress.totalChannels) * 100) : 0;
        
        console.log(`\n🔄 PROGRESS [${percent}%] - ${new Date().toLocaleTimeString()}`);
        console.log(`   📁 Channels: ${progress.processedChannels}/${progress.totalChannels}`);
        console.log(`   📨 Messages: ${progress.processedMessages.toLocaleString()} processed`);
        console.log(`   💾 New saves: ${progress.newMessagesSaved.toLocaleString()}`);
        console.log(`   🌐 API calls: ${progress.apiCallCount}`);
        
        if (progress.currentChannel) {
          console.log(`   🔍 Current: #${progress.currentChannel}`);
        }
        
        if (progress.estimatedTimeRemaining) {
          const mins = Math.floor(progress.estimatedTimeRemaining / 60);
          const secs = progress.estimatedTimeRemaining % 60;
          console.log(`   ⏱️  ETA: ${mins}m ${secs}s`);
        }
        
        lastProgressTime = now;
      }
    };

    // Create and run the unlimited sync service
    const syncService = new UnlimitedSlackSyncService(workspaceObj);
    const startTime = Date.now();
    
    console.log(`\n🚀 SYNC STARTED - ${new Date().toISOString()}`);
    const result = await syncService.performUnlimitedSync(onProgress);
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.round(durationMs / 60000);

    console.log(`\n\n🎉 UNLIMITED SYNC COMPLETED! 🎉`);
    console.log(`⏰ Duration: ${durationMinutes} minutes (${Math.round(durationMs/1000)}s)`);
    console.log(`📅 Completed: ${new Date().toISOString()}`);

    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`   📁 Channels processed: ${result.processedChannels}/${result.totalChannels}`);
    console.log(`   📨 Messages processed: ${result.processedMessages.toLocaleString()}`);
    console.log(`   💾 NEW messages saved: ${result.newMessagesSaved.toLocaleString()}`);
    console.log(`   🔄 Duplicates skipped: ${result.duplicatesSkipped.toLocaleString()}`);
    console.log(`   📄 Files processed: ${result.processedFiles.toLocaleString()}`);
    console.log(`   🌐 Total API calls: ${result.apiCallCount.toLocaleString()}`);

    // Get updated database stats
    const [finalStats] = await sql`SELECT COUNT(*) as total FROM "SlackMessage"`;
    const finalMessageCount = parseInt(finalStats.total);
    const newMessagesExtracted = finalMessageCount - startingMessageCount;

    console.log(`\n🔥 DATABASE GROWTH:`);
    console.log(`   📈 Before: ${startingMessageCount.toLocaleString()} messages`);
    console.log(`   📈 After: ${finalMessageCount.toLocaleString()} messages`);
    console.log(`   🚀 EXTRACTED: ${newMessagesExtracted.toLocaleString()} NEW MESSAGES!`);

    if (result.channelSummary && result.channelSummary.length > 0) {
      console.log(`\n📋 TOP CHANNELS BY NEW MESSAGES:`);
      result.channelSummary
        .sort((a, b) => b.newMessagesSaved - a.newMessagesSaved)
        .slice(0, 10)
        .forEach((channel, index) => {
          console.log(`   ${index + 1}. #${channel.name}: ${channel.newMessagesSaved} new messages`);
          if (channel.oldestDate && channel.newestDate) {
            console.log(`      📅 Date range: ${channel.oldestDate} to ${channel.newestDate}`);
          }
        });
    }

    console.log(`\n✅ Unlimited sync completed successfully!`);
    console.log(`💡 You can now search and analyze ${finalMessageCount.toLocaleString()} messages in your database`);

  } catch (error) {
    console.error('\n❌ UNLIMITED SYNC FAILED:', error);
    console.error('\n🔍 Error details:', error.message);
    if (error.stack) {
      console.error('\n📋 Stack trace:', error.stack);
    }
  } finally {
    await sql.end();
    console.log('\n🏁 Script completed');
  }
}

runUnlimitedSync(); 