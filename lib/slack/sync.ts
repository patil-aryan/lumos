import { SlackClient } from './client';
import { SlackDatabaseService } from './database';
import type { SlackWorkspace } from '@/lib/db/schema';

export interface SyncProgress {
  totalChannels: number;
  processedChannels: number;
  totalMessages: number;
  processedMessages: number;
  totalFiles: number;
  processedFiles: number;
  currentChannel?: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

export class SlackSyncService {
  private client: SlackClient;
  private workspace: SlackWorkspace;

  constructor(workspace: SlackWorkspace) {
    this.workspace = workspace;
    this.client = new SlackClient(workspace.accessToken);
  }

  async syncWorkspaceData(
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncProgress> {
    const progress: SyncProgress = {
      totalChannels: 0,
      processedChannels: 0,
      totalMessages: 0,
      processedMessages: 0,
      totalFiles: 0,
      processedFiles: 0,
      status: 'running',
    };

    try {
      // Get all channels
      const channels = await this.client.getChannels();
      const filteredChannels = channels.filter(ch => !ch.is_archived);
      
      progress.totalChannels = filteredChannels.length;
      onProgress?.(progress);

      // Process each channel
      for (const channel of filteredChannels) {
        progress.currentChannel = channel.name;
        onProgress?.(progress);

        try {
          await this.syncChannelMessages(channel.id, channel.name, progress, onProgress);
        } catch (error) {
          console.error(`Error syncing channel ${channel.name}:`, error);
          // Continue with other channels
        }

        progress.processedChannels++;
        onProgress?.(progress);
      }

      // Sync standalone files
      await this.syncStandaloneFiles(progress, onProgress);

      progress.status = 'completed';
      onProgress?.(progress);

      return progress;
    } catch (error) {
      console.error('Error during Slack sync:', error);
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(progress);
      throw error;
    }
  }

  private async syncChannelMessages(
    channelId: string,
    channelName: string,
    progress: SyncProgress,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    let oldest: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const messages = await this.client.getChannelHistory(channelId, oldest);
      
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      progress.totalMessages += messages.length;

      for (const message of messages) {
        // Skip messages without text content
        if (!message.text && (!message.files || message.files.length === 0)) {
          continue;
        }

        // Check if message already exists
        const messageExists = await SlackDatabaseService.checkMessageExists(
          message.ts,
          this.workspace.id
        );

        if (!messageExists) {
          // Get user info for better context
          const userInfo = await this.client.getUserInfo(message.user);
          const userName = userInfo?.real_name || userInfo?.name || message.user;

          // Save message
          const savedMessage = await SlackDatabaseService.saveMessage(
            message,
            this.workspace.id,
            channelId,
            channelName,
            userName
          );

          // Process files in the message
          if (message.files && message.files.length > 0) {
            progress.totalFiles += message.files.length;
            
            for (const file of message.files) {
              await this.processFile(file, savedMessage.id, progress, onProgress);
            }
          }
        }

        progress.processedMessages++;
        onProgress?.(progress);
      }

      // Set oldest to the last message timestamp for pagination
      oldest = messages[messages.length - 1].ts;
      
      // If we got fewer messages than requested, we've reached the end
      if (messages.length < 200) {
        hasMore = false;
      }
    }
  }

  private async syncStandaloneFiles(
    progress: SyncProgress,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    try {
      const files = await this.client.getFiles();
      progress.totalFiles += files.length;

      for (const file of files) {
        const fileExists = await SlackDatabaseService.checkFileExists(file.id);
        
        if (!fileExists) {
          await this.processFile(file, undefined, progress, onProgress);
        }
      }
    } catch (error) {
      console.error('Error syncing standalone files:', error);
    }
  }

  private async processFile(
    file: any,
    messageId: string | undefined,
    progress: SyncProgress,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    try {
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

  private isTextFile(mimetype: string, filetype: string): boolean {
    const textTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/csv',
    ];

    const textFiletypes = [
      'text', 'javascript', 'python', 'java', 'html', 'css',
      'markdown', 'csv', 'json', 'xml', 'yaml', 'sql',
    ];

    return textTypes.some(type => mimetype?.startsWith(type)) ||
           textFiletypes.includes(filetype);
  }

  private extractTextContent(buffer: Buffer, mimetype: string, filetype: string): string {
    // For now, just handle basic text files
    // You can extend this to handle PDF, Word docs, etc. with appropriate libraries
    if (mimetype?.startsWith('text/') || this.isTextFile(mimetype, filetype)) {
      return buffer.toString('utf-8');
    }
    
    return '';
  }

  static async syncWorkspace(
    workspaceId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncProgress> {
    const workspaces = await SlackDatabaseService.getWorkspacesByUserId(''); // You'll need to get the user ID
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const syncService = new SlackSyncService(workspace);
    return await syncService.syncWorkspaceData(onProgress);
  }
} 