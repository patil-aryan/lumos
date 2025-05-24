import { SlackClient } from './client';
import { SlackDatabaseService } from './database';
import type { SlackWorkspace } from '@/lib/db/schema';

export interface EnhancedSyncProgress {
  totalChannels: number;
  processedChannels: number;
  totalMessages: number;
  processedMessages: number;
  totalFiles: number;
  processedFiles: number;
  totalUsers: number;
  processedUsers: number;
  currentChannel?: string;
  currentOperation?: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
  isHistoricalSync?: boolean;
  diagnostics: {
    slackPlanLimit?: boolean;
    botAccessIssues: string[];
    estimatedMaxMessages: number;
    actualMessageDensity: number;
    channelAccessSummary: {
      accessible: number;
      inaccessible: number;
      totalChannels: number;
    };
    dateRangeIssues?: string[];
  };
}

export class EnhancedSlackSyncService {
  private client: SlackClient;
  private workspace: SlackWorkspace;

  constructor(workspace: SlackWorkspace) {
    this.workspace = workspace;
    this.client = new SlackClient(workspace.accessToken);
  }

  async performDiagnosticSync(
    onProgress?: (progress: EnhancedSyncProgress) => void,
    historicalSync: boolean = false
  ): Promise<EnhancedSyncProgress> {
    const progress: EnhancedSyncProgress = {
      totalChannels: 0,
      processedChannels: 0,
      totalMessages: 0,
      processedMessages: 0,
      totalFiles: 0,
      processedFiles: 0,
      totalUsers: 0,
      processedUsers: 0,
      status: 'running',
      isHistoricalSync: historicalSync,
      diagnostics: {
        botAccessIssues: [],
        estimatedMaxMessages: 0,
        actualMessageDensity: 0,
        channelAccessSummary: {
          accessible: 0,
          inaccessible: 0,
          totalChannels: 0
        },
        dateRangeIssues: []
      }
    };

    try {
      console.log(`🚀 Starting ENHANCED ${historicalSync ? 'HISTORICAL' : 'REGULAR'} sync for workspace: ${this.workspace.teamName}`);

      // Step 1: Get all channels and check bot access
      progress.currentOperation = 'Analyzing channel access';
      onProgress?.(progress);
      
      const allChannels = await this.client.getChannels();
      progress.totalChannels = allChannels.length;
      progress.diagnostics.channelAccessSummary.totalChannels = allChannels.length;

      console.log(`📊 Found ${allChannels.length} total channels in workspace`);

      const accessibleChannels = [];
      const inaccessibleChannels = [];

      for (const channel of allChannels) {
        const membership = await this.client.checkBotMembership(channel.id);
        
        if (membership.isMember) {
          accessibleChannels.push(channel);
          console.log(`✅ Bot has access to #${channel.name}`);
        } else {
          inaccessibleChannels.push({ channel, error: membership.error });
          progress.diagnostics.botAccessIssues.push(`#${channel.name}: ${membership.error}`);
          console.log(`🚫 Bot cannot access #${channel.name}: ${membership.error}`);
        }
      }

      progress.diagnostics.channelAccessSummary.accessible = accessibleChannels.length;
      progress.diagnostics.channelAccessSummary.inaccessible = inaccessibleChannels.length;

      console.log(`\n📊 CHANNEL ACCESS SUMMARY:`);
      console.log(`   ✅ Accessible: ${accessibleChannels.length}/${allChannels.length}`);
      console.log(`   🚫 Inaccessible: ${inaccessibleChannels.length}/${allChannels.length}`);

      if (inaccessibleChannels.length > 0) {
        console.log(`\n💡 TO ACCESS MORE CHANNELS:`);
        inaccessibleChannels.forEach(({ channel }) => {
          console.log(`   • Go to #${channel.name} and type: /invite @YourBot`);
        });
      }

      // Step 2: Estimate message volume per channel
      progress.currentOperation = 'Estimating message volume';
      onProgress?.(progress);

      let totalEstimatedMessages = 0;
      const channelEstimates = [];

      for (const channel of accessibleChannels.slice(0, 3)) { // Sample first 3 channels
        try {
          console.log(`📊 Sampling #${channel.name} for message density...`);
          
          // Get a small sample to estimate density
          const sampleMessages = await this.client.getChannelHistory(channel.id);
          
          if (sampleMessages.length > 0) {
            const newest = parseFloat(sampleMessages[0].ts);
            const oldest = parseFloat(sampleMessages[sampleMessages.length - 1].ts);
            const sampleDays = Math.max(1, (newest - oldest) / (24 * 60 * 60));
            const messagesPerDay = sampleMessages.length / sampleDays;
            
            // Estimate for the historical period (6 months = 180 days)
            const estimatedMessages = messagesPerDay * 180;
            channelEstimates.push({
              channel: channel.name,
              messagesPerDay: messagesPerDay.toFixed(2),
              estimated6MonthMessages: Math.round(estimatedMessages)
            });
            
            totalEstimatedMessages += estimatedMessages;
            
            console.log(`   📈 #${channel.name}: ~${messagesPerDay.toFixed(1)} msgs/day → ~${Math.round(estimatedMessages)} msgs (6mo)`);
          }
          
          await this.sleep(1000); // Rate limiting
        } catch (error) {
          console.log(`   ⚠️  Could not sample #${channel.name}: ${error}`);
        }
      }

      progress.diagnostics.estimatedMaxMessages = Math.round(totalEstimatedMessages);
      
      console.log(`\n📊 MESSAGE VOLUME ESTIMATE:`);
      console.log(`   🎯 Estimated 6-month total: ~${Math.round(totalEstimatedMessages)} messages`);
      
      // Check for Slack plan limitations
      if (totalEstimatedMessages > 10000) {
        progress.diagnostics.slackPlanLimit = true;
        console.log(`   ⚠️  WARNING: Estimated messages exceed Slack free plan limit (10,000)`);
        console.log(`   💡 Consider upgrading to Slack Pro for unlimited history`);
      }

      // Step 3: Perform actual sync with detailed logging
      progress.currentOperation = 'Syncing messages with diagnostic logging';
      onProgress?.(progress);

      const syncStartTime = Date.now();
      let actualMessagesSynced = 0;

      // Calculate sync date range
      const now = new Date();
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
      let syncFromDate: Date;

      if (historicalSync || !this.workspace.lastSyncAt) {
        syncFromDate = sixMonthsAgo;
        console.log(`📅 Historical sync from: ${syncFromDate.toISOString()}`);
      } else {
        syncFromDate = new Date(this.workspace.lastSyncAt.getTime() - 60 * 60 * 1000);
        console.log(`📅 Regular sync from: ${syncFromDate.toISOString()}`);
      }

      for (const channel of accessibleChannels) {
        progress.currentChannel = channel.name;
        onProgress?.(progress);

        console.log(`\n🔄 Syncing #${channel.name}...`);
        
        try {
          const channelMessages = await this.syncChannelWithDiagnostics(
            channel.id,
            channel.name,
            syncFromDate,
            progress,
            onProgress
          );
          
          actualMessagesSynced += channelMessages;
          progress.processedChannels++;
          onProgress?.(progress);

        } catch (error) {
          console.error(`❌ Error syncing #${channel.name}:`, error);
          progress.diagnostics.botAccessIssues.push(`#${channel.name}: Sync error - ${error}`);
        }
      }

      // Step 4: Calculate final diagnostics
      const syncDuration = (Date.now() - syncStartTime) / 1000;
      progress.diagnostics.actualMessageDensity = actualMessagesSynced / Math.max(1, syncDuration / 86400); // messages per day

      console.log(`\n🎯 SYNC RESULTS:`);
      console.log(`   📨 Messages synced: ${actualMessagesSynced}`);
      console.log(`   ⏱️  Sync duration: ${syncDuration.toFixed(1)}s`);
      console.log(`   📊 Density: ${progress.diagnostics.actualMessageDensity.toFixed(1)} msgs/day`);

      // Final recommendations
      console.log(`\n💡 RECOMMENDATIONS:`);
      
      if (progress.diagnostics.slackPlanLimit) {
        console.log(`   1. 📞 Check Slack plan - you may be hitting the 10,000 message limit`);
      }
      
      if (inaccessibleChannels.length > 0) {
        console.log(`   2. 🤖 Invite bot to ${inaccessibleChannels.length} more channels for complete sync`);
      }
      
      if (progress.diagnostics.actualMessageDensity < 5) {
        console.log(`   3. ⚠️  Low message density suggests this workspace may naturally have few messages`);
      }

      progress.status = 'completed';
      progress.currentOperation = 'Diagnostic sync completed';
      onProgress?.(progress);

      return progress;

    } catch (error) {
      console.error('❌ Enhanced sync error:', error);
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(progress);
      throw error;
    }
  }

  private async syncChannelWithDiagnostics(
    channelId: string,
    channelName: string,
    fromDate: Date,
    progress: EnhancedSyncProgress,
    onProgress?: (progress: EnhancedSyncProgress) => void
  ): Promise<number> {
    let messageCount = 0;
    let oldest: string | undefined;
    let hasMore = true;
    const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
    let batchCount = 0;

    console.log(`📅 Syncing #${channelName} from ${fromDate.toISOString()}`);

    while (hasMore && batchCount < 50) { // Safety limit
      try {
        batchCount++;
        const messages = await this.client.getChannelHistory(channelId, oldest);
        
        if (messages.length === 0) {
          console.log(`   📭 No more messages available for #${channelName}`);
          break;
        }

        console.log(`   📨 Batch ${batchCount}: ${messages.length} messages from Slack API`);

        let newMessages = 0;
        let duplicates = 0;

        for (const message of messages) {
          const messageTime = parseFloat(message.ts);
          
          // Stop if we've reached our date limit
          if (progress.isHistoricalSync && messageTime < fromTimestamp) {
            console.log(`   🎯 Reached target date for #${channelName}`);
            hasMore = false;
            break;
          }

          // Check for duplicates
          const exists = await SlackDatabaseService.checkMessageExists(message.ts, this.workspace.id);
          if (exists) {
            duplicates++;
            continue;
          }

          // Save new message
          await SlackDatabaseService.saveMessage(
            message,
            this.workspace.id,
            channelId,
            channelName,
            message.user
          );

          newMessages++;
          messageCount++;
          progress.processedMessages++;
        }

        console.log(`   💾 #${channelName} batch ${batchCount}: ${newMessages} new, ${duplicates} duplicates`);

        oldest = messages[messages.length - 1].ts;
        
        if (messages.length < 100) {
          hasMore = false;
        }

        await this.sleep(1200); // Rate limiting
        onProgress?.(progress);

      } catch (error) {
        console.error(`   ❌ Batch error for #${channelName}:`, error);
        break;
      }
    }

    console.log(`   ✅ #${channelName} complete: ${messageCount} new messages synced`);
    return messageCount;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 