import postgres from 'postgres';
import { UnlimitedSlackSyncService } from './lib/slack/unlimited-sync';

// Load environment variables the same way as the working scripts
require('dotenv').config({ path: '.env.local' });

async function runUnlimitedSync() {
  console.log('🚀 UNLIMITED SLACK MESSAGE EXTRACTION STARTING...');
  console.log('⏰ Time:', new Date().toISOString());
  
  const sql = postgres(process.env.POSTGRES_URL as string);

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
    const startingMessageCount = parseInt(currentStats.total as string);
    console.log(`📊 Starting with: ${startingMessageCount} messages`);

    console.log(`\n🎯 STARTING UNLIMITED MESSAGE EXTRACTION...`);
    console.log(`🔥 This will extract ALL available messages from your Slack workspace`);
    console.log(`⏰ Expected duration: 5-30 minutes depending on message history`);
    console.log(`📡 Rate limited to ~1 API call per second`);

    // Create progress tracker
    let lastProgressTime = Date.now();
    const onProgress = (progress: any) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastProgressTime;
      
      // Only log progress every 10 seconds to avoid spam
      if (timeSinceLastUpdate > 10000) {
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

    const startTime = Date.now();
    
    console.log(`\n🚀 SYNC STARTED - ${new Date().toISOString()}`);
    
    // Run unlimited sync using the static method
    const result = await UnlimitedSlackSyncService.performUnlimitedWorkspaceSync(
      workspace.id,
      workspace.userId,
      onProgress
    );
    
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
    const finalMessageCount = parseInt(finalStats.total as string);
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
    console.error('\n🔍 Error details:', (error as Error).message);
    if ((error as Error).stack) {
      console.error('\n📋 Stack trace:', (error as Error).stack);
    }
  } finally {
    await sql.end();
    console.log('\n🏁 Script completed');
  }
}

runUnlimitedSync(); 