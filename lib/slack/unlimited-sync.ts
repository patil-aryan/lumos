import { SlackClient } from './client';
import { SlackDatabaseService } from './database';
import type { SlackWorkspace } from '@/lib/db/schema';

export interface UnlimitedSyncProgress {
  totalChannels: number;
  processedChannels: number;
  totalMessages: number;
  processedMessages: number;
  newMessagesSaved: number;
  duplicatesSkipped: number;
  totalFiles: number;
  processedFiles: number;
  currentChannel?: string;
  currentOperation?: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
  estimatedTimeRemaining?: number;
  apiCallCount: number;
  channelSummary: Array<{
    name: string;
    messagesProcessed: number;
    newMessagesSaved: number;
    oldestDate?: string;
    newestDate?: string;
  }>;
}

export class UnlimitedSlackSyncService {
  private client: SlackClient;
  private workspace: SlackWorkspace;

  constructor(workspace: SlackWorkspace) {
    this.workspace = workspace;
    this.client = new SlackClient(workspace.accessToken);
  }

  async performUnlimitedSync(
    onProgress?: (progress: UnlimitedSyncProgress) => void
  ): Promise<UnlimitedSyncProgress> {
    const progress: UnlimitedSyncProgress = {
      totalChannels: 0,
      processedChannels: 0,
      totalMessages: 0,
      processedMessages: 0,
      newMessagesSaved: 0,
      duplicatesSkipped: 0,
      totalFiles: 0,
      processedFiles: 0,
      status: 'running',
      apiCallCount: 0,
      channelSummary: [],
    };

    const startTime = Date.now();

    try {
      console.log(`🚀 UNLIMITED SYNC STARTED for workspace: ${this.workspace.teamName}`);
      console.log(`⏰ Start time: ${new Date().toISOString()}`);

      // Step 1: Get all accessible channels
      progress.currentOperation = 'Discovering all channels';
      onProgress?.(progress);

      const allChannels = await this.client.getChannels();
      const accessibleChannels = [];
      const inaccessibleChannels = [];

      progress.totalChannels = allChannels.length;
      console.log(`📊 Found ${allChannels.length} total channels`);

      // Check bot access to each channel
      for (const channel of allChannels) {
        const membership = await this.client.checkBotMembership(channel.id);
        
        if (membership.isMember) {
          accessibleChannels.push(channel);
          console.log(`✅ Bot has access to #${channel.name}`);
        } else {
          inaccessibleChannels.push(channel);
          console.log(`🚫 Bot cannot access #${channel.name}: ${membership.error}`);
        }
        
        await this.sleep(200); // Rate limiting
      }

      console.log(`\n📊 CHANNEL ACCESS SUMMARY:`);
      console.log(`  ✅ Accessible: ${accessibleChannels.length}/${allChannels.length}`);
      console.log(`  🚫 Inaccessible: ${inaccessibleChannels.length}/${allChannels.length}`);
      
      if (inaccessibleChannels.length > 0) {
        console.log(`\n💡 TO ACCESS MORE CHANNELS:`);
        inaccessibleChannels.forEach(channel => {
          console.log(`  • Go to #${channel.name} and type: /invite @YourBot`);
        });
      }

      // Step 2: Sync all accessible channels with unlimited history
      console.log(`\n🔄 Starting unlimited message sync for ${accessibleChannels.length} channels...`);
      
      for (let i = 0; i < accessibleChannels.length; i++) {
        const channel = accessibleChannels[i];
        progress.currentChannel = channel.name;
        progress.currentOperation = `Syncing #${channel.name} (${i + 1}/${accessibleChannels.length})`;
        
        // Estimate time remaining
        if (i > 0) {
          const elapsed = Date.now() - startTime;
          const avgTimePerChannel = elapsed / i;
          const remainingChannels = accessibleChannels.length - i;
          progress.estimatedTimeRemaining = Math.round((avgTimePerChannel * remainingChannels) / 1000);
        }
        
        onProgress?.(progress);

        console.log(`\n🔄 [${i + 1}/${accessibleChannels.length}] Syncing #${channel.name}...`);
        
        try {
          const channelResult = await this.syncChannelUnlimited(
            channel.id,
            channel.name,
            progress,
            onProgress
          );
          
          progress.channelSummary.push(channelResult);
          progress.processedChannels++;
          
          console.log(`✅ #${channel.name} complete: ${channelResult.newMessagesSaved} new messages`);
          
        } catch (error) {
          console.error(`❌ Error syncing #${channel.name}:`, error);
          progress.channelSummary.push({
            name: channel.name,
            messagesProcessed: 0,
            newMessagesSaved: 0,
            oldestDate: undefined,
            newestDate: undefined,
          });
        }

        // Rate limiting between channels
        await this.sleep(1000);
        onProgress?.(progress);
      }

      // Step 3: Final summary
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      
      console.log(`\n🏆 UNLIMITED SYNC COMPLETED!`);
      console.log(`⏰ Total time: ${totalTime}s (${Math.round(totalTime / 60)}m ${totalTime % 60}s)`);
      console.log(`📊 Results:`);
      console.log(`  📨 Total messages processed: ${progress.processedMessages}`);
      console.log(`  💾 New messages saved: ${progress.newMessagesSaved}`);
      console.log(`  🔄 Duplicates skipped: ${progress.duplicatesSkipped}`);
      console.log(`  🌐 API calls made: ${progress.apiCallCount}`);
      console.log(`  📁 Files processed: ${progress.processedFiles}`);

      console.log(`\n📋 CHANNEL RESULTS:`);
      progress.channelSummary
        .sort((a, b) => b.newMessagesSaved - a.newMessagesSaved)
        .forEach(channel => {
          console.log(`  #${channel.name}: ${channel.newMessagesSaved} new messages`);
          if (channel.oldestDate && channel.newestDate) {
            console.log(`    Date range: ${channel.oldestDate} to ${channel.newestDate}`);
          }
        });

      progress.status = 'completed';
      progress.currentOperation = 'Sync completed successfully';
      onProgress?.(progress);

      return progress;

    } catch (error) {
      console.error('💥 Fatal error during unlimited sync:', error);
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      progress.currentOperation = 'Sync failed';
      onProgress?.(progress);
      throw error;
    }
  }

  private async syncChannelUnlimited(
    channelId: string,
    channelName: string,
    progress: UnlimitedSyncProgress,
    onProgress?: (progress: UnlimitedSyncProgress) => void
  ): Promise<{
    name: string;
    messagesProcessed: number;
    newMessagesSaved: number;
    oldestDate?: string;
    newestDate?: string;
  }> {
    let oldest: string | undefined;
    let hasMore = true;
    let channelMessagesProcessed = 0;
    let channelNewMessages = 0;
    let channelDuplicates = 0;
    let batchCount = 0;
    let oldestMessageDate: Date | undefined;
    let newestMessageDate: Date | undefined;

    console.log(`  🔍 Starting unlimited history scan for #${channelName}...`);

    while (hasMore) {
      try {
        batchCount++;
        progress.apiCallCount++;
        
        console.log(`  📡 API call #${progress.apiCallCount}: Fetching batch ${batchCount} for #${channelName}`);
        
        const messages = await this.client.getChannelHistory(channelId, oldest);
        
        if (messages.length === 0) {
          console.log(`  📭 No more messages available for #${channelName}`);
          hasMore = false;
          break;
        }

        progress.totalMessages += messages.length;
        channelMessagesProcessed += messages.length;
        
        console.log(`  📨 Batch ${batchCount}: ${messages.length} messages from Slack API`);

        // Process each message in the batch
        for (const message of messages) {
          const messageTime = parseFloat(message.ts);
          const messageDate = new Date(messageTime * 1000);
          
          // Track date range
          if (!oldestMessageDate || messageDate < oldestMessageDate) {
            oldestMessageDate = messageDate;
          }
          if (!newestMessageDate || messageDate > newestMessageDate) {
            newestMessageDate = messageDate;
          }

          // Skip messages without content
          if (!message.text && (!message.files || message.files.length === 0)) {
            continue;
          }

          // Check if message already exists
          const messageExists = await SlackDatabaseService.checkMessageExists(
            message.ts,
            this.workspace.id
          );

          if (messageExists) {
            channelDuplicates++;
            progress.duplicatesSkipped++;
          } else {
            // Get user info for context
            let userName = message.user;
            try {
              const userInfo = await this.client.getUserInfo(message.user);
              userName = userInfo?.real_name || userInfo?.name || message.user;
            } catch (error) {
              // Use user ID if we can't get user info
            }

            // Save new message
            const savedMessage = await SlackDatabaseService.saveMessage(
              message,
              this.workspace.id,
              channelId,
              channelName,
              userName
            );

            channelNewMessages++;
            progress.newMessagesSaved++;

            // Process files in the message
            if (message.files && message.files.length > 0) {
              progress.totalFiles += message.files.length;
              
              for (const file of message.files) {
                await this.processFile(file, savedMessage.id, progress, onProgress);
              }
            }
          }

          progress.processedMessages++;
        }

        // Log batch results
        console.log(`  💾 Batch ${batchCount} processed: ${messages.length} messages, ${channelNewMessages} new saves`);
        
        if (oldestMessageDate && newestMessageDate) {
          console.log(`  📅 Date range so far: ${oldestMessageDate.toISOString().substring(0, 10)} to ${newestMessageDate.toISOString().substring(0, 10)}`);
        }

        // Set oldest to the last message timestamp for pagination
        oldest = messages[messages.length - 1].ts;
        
        // If we got fewer messages than requested, we've reached the end
        if (messages.length < 100) {
          console.log(`  🏁 Reached end of #${channelName} history (received ${messages.length} < 100 messages)`);
          hasMore = false;
        }

        // Progress callback
        onProgress?.(progress);

        // Rate limiting between API calls
        await this.sleep(1100);

        // Safety break after many batches
        if (batchCount >= 200) {
          console.log(`  ⚠️  Safety limit: Stopping after ${batchCount} batches for #${channelName}`);
          hasMore = false;
        }

      } catch (error) {
        console.error(`  ❌ Error in batch ${batchCount} for #${channelName}:`, error);
        
        // Handle specific Slack errors
        if (error && typeof error === 'object' && 'data' in error) {
          const slackError = (error as any).data?.error;
          
          if (slackError === 'not_in_channel') {
            console.log(`  🚫 Bot not in channel #${channelName} - stopping sync`);
            break;
          } else if (slackError === 'rate_limited') {
            console.log(`  ⏰ Rate limited - waiting 60s before retry...`);
            await this.sleep(60000);
            continue; // Retry the same request
          }
        }
        
        // For other errors, stop syncing this channel
        console.log(`  ⚠️  Stopping sync for #${channelName} due to error`);
        break;
      }
    }

    const result = {
      name: channelName,
      messagesProcessed: channelMessagesProcessed,
      newMessagesSaved: channelNewMessages,
      oldestDate: oldestMessageDate?.toISOString().substring(0, 10),
      newestDate: newestMessageDate?.toISOString().substring(0, 10),
    };

    console.log(`  ✅ #${channelName} unlimited sync complete:`);
    console.log(`    📊 Total processed: ${channelMessagesProcessed} messages`);
    console.log(`    💾 New saves: ${channelNewMessages} messages`);
    console.log(`    🔄 Duplicates: ${channelDuplicates} messages`);
    console.log(`    📅 Date range: ${result.oldestDate || 'None'} to ${result.newestDate || 'None'}`);

    return result;
  }

  private async processFile(
    file: any,
    messageId: string | undefined,
    progress: UnlimitedSyncProgress,
    onProgress?: (progress: UnlimitedSyncProgress) => void
  ): Promise<void> {
    try {
      // Check if file already exists
      const fileExists = await SlackDatabaseService.checkFileExists(file.id);
      if (fileExists) {
        progress.processedFiles++;
        return;
      }

      let content: string | undefined;

      // Extract text content from supported file types
      if (this.isTextFile(file.mimetype, file.filetype)) {
        try {
          const fileBuffer = await this.client.downloadFile(file.url_private);
          content = this.extractTextContent(fileBuffer, file.mimetype, file.filetype);
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
        }
      }

      await SlackDatabaseService.saveFile(
        file,
        this.workspace.id,
        messageId,
        content
      );

      progress.processedFiles++;
      onProgress?.(progress);
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  private isTextFile(mimetype?: string, filetype?: string): boolean {
    if (!mimetype && !filetype) return false;
    
    const textMimetypes = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/javascript',
      'application/typescript',
      'text/html',
      'text/css',
      'application/xml',
    ];

    const textFiletypes = [
      'text',
      'javascript',
      'typescript',
      'python',
      'java',
      'c',
      'cpp',
      'markdown',
      'csv',
      'json',
      'xml',
      'html',
      'css',
    ];

    return textMimetypes.includes(mimetype || '') || 
           textFiletypes.includes(filetype || '');
  }

  private extractTextContent(buffer: Buffer, mimetype?: string, filetype?: string): string {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      console.error('Error extracting text content:', error);
      return '';
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Static method for easy unlimited sync
  static async performUnlimitedWorkspaceSync(
    workspaceId: string,
    userId: string,
    onProgress?: (progress: UnlimitedSyncProgress) => void
  ): Promise<UnlimitedSyncProgress> {
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(userId);
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const syncService = new UnlimitedSlackSyncService(workspace);
    return await syncService.performUnlimitedSync(onProgress);
  }
} 