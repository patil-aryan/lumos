import { SlackClient, SlackMessage, SlackChannel, SlackUser, SlackFile } from './new-client';
import type { 
  SlackWorkspace,
  SlackUser as DBSlackUser,
  SlackChannel as DBSlackChannel,
  SlackMessage as DBSlackMessage,
  SlackReaction,
  SlackFile as DBSlackFile,
  SlackChannelMember,
  SlackSyncLog
} from '../db/schema-new-slack';
import { 
  slackWorkspace, 
  slackUser, 
  slackChannel, 
  slackMessage, 
  slackFile, 
  slackReaction,
  slackChannelMember,
  slackSyncLog
} from '../db/schema-new-slack';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export interface ComprehensiveSyncProgress {
  // Overall progress
  status: 'initializing' | 'syncing_workspace' | 'syncing_users' | 'syncing_conversations' | 'syncing_messages' | 'syncing_threads' | 'syncing_files' | 'completed' | 'error';
  currentOperation: string;
  startTime: Date;
  
  // Workspace sync
  workspaceInfo?: {
    name: string;
    domain: string;
    totalUsers: number;
    totalConversations: number;
  };
  
  // User sync progress
  totalUsers: number;
  processedUsers: number;
  
  // Conversation sync progress
  totalConversations: number;
  processedConversations: number;
  currentConversation?: string;
  
  // Message sync progress
  totalMessages: number;
  processedMessages: number;
  newMessages: number;
  duplicateMessages: number;
  
  // Thread sync progress
  totalThreads: number;
  processedThreads: number;
  threadReplies: number;
  
  // Reaction sync progress
  totalReactions: number;
  processedReactions: number;
  
  // File sync progress
  totalFiles: number;
  processedFiles: number;
  downloadedFiles: number;
  skippedFiles: number;
  
  // Error tracking
  errors: Array<{
    type: string;
    message: string;
    details?: any;
    timestamp: Date;
  }>;
  
  // Performance metrics
  apiCallCount: number;
  rateLimitHits: number;
  
  // Detailed conversation breakdown
  conversationDetails: Array<{
    id: string;
    name: string;
    type: 'channel' | 'group' | 'im' | 'mpim';
    isPrivate: boolean;
    messagesFound: number;
    threadsFound: number;
    reactionsFound: number;
    filesFound: number;
    oldestMessage?: string;
    newestMessage?: string;
    syncStatus: 'pending' | 'syncing' | 'completed' | 'error';
    error?: string;
  }>;
  
  // Date range info
  dateRange: {
    from?: Date;
    to?: Date;
    syncType: 'full' | 'incremental' | 'date_range';
  };
  
  // Summary stats
  summary: {
    duration?: number; // seconds
    messagesPerSecond?: number;
    apiCallsPerSecond?: number;
    dataSize?: number; // bytes
  };
}

export interface SyncConfiguration {
  // Date range for sync
  dateFrom?: Date;
  dateTo?: Date;
  syncType: 'full' | 'incremental' | 'date_range';
  
  // Conversation filters
  includePublicChannels: boolean;
  includePrivateChannels: boolean;
  includeGroupMessages: boolean;
  includeDirectMessages: boolean;
  specificChannels?: string[]; // Channel IDs to sync specifically
  excludeChannels?: string[]; // Channel IDs to exclude
  
  // Content options
  includeThreadReplies: boolean;
  includeReactions: boolean;
  includeFiles: boolean;
  downloadFiles: boolean;
  includeDeletedMessages: boolean;
  includeEditHistory: boolean;
  
  // Performance options
  batchSize: number;
  maxConcurrentRequests: number;
  rateLimitDelay: number; // ms
  maxRetries: number;
  
  // Processing options
  extractFileContent: boolean;
  generateEmbeddings: boolean;
  skipExistingMessages: boolean;
}

export class ComprehensiveSlackSync {
  private client: SlackClient;
  private workspace: SlackWorkspace;
  private config: SyncConfiguration;
  private progress: ComprehensiveSyncProgress;
  private onProgressCallback?: (progress: ComprehensiveSyncProgress) => void;
  
  // Message deduplication cache
  private processedMessages = new Set<string>();
  private processedThreads = new Set<string>();
  
  constructor(
    workspace: SlackWorkspace,
    config: SyncConfiguration,
    onProgress?: (progress: ComprehensiveSyncProgress) => void
  ) {
    this.workspace = workspace;
    this.config = config;
    this.onProgressCallback = onProgress;
    this.client = new SlackClient(workspace.accessToken);
    
    this.progress = {
      status: 'initializing',
      currentOperation: 'Initializing sync...',
      startTime: new Date(),
      totalUsers: 0,
      processedUsers: 0,
      totalConversations: 0,
      processedConversations: 0,
      totalMessages: 0,
      processedMessages: 0,
      newMessages: 0,
      duplicateMessages: 0,
      totalThreads: 0,
      processedThreads: 0,
      threadReplies: 0,
      totalReactions: 0,
      processedReactions: 0,
      totalFiles: 0,
      processedFiles: 0,
      downloadedFiles: 0,
      skippedFiles: 0,
      errors: [],
      apiCallCount: 0,
      rateLimitHits: 0,
      conversationDetails: [],
      dateRange: {
        syncType: config.syncType,
        from: config.dateFrom,
        to: config.dateTo,
      },
      summary: {},
    };
  }
  
  // Main sync method
  async performComprehensiveSync(): Promise<ComprehensiveSyncProgress> {
    try {
      this.updateProgress('Comprehensive Slack sync started');
      
      // Step 1: Sync workspace info
      await this.syncWorkspaceInfo();
      
      // Step 2: Sync all users
      await this.syncAllUsers();
      
      // Step 3: Sync all conversations
      await this.syncAllConversations();
      
      // Step 4: Sync all messages for each conversation
      await this.syncAllMessages();
      
      // Step 5: Sync thread replies
      await this.syncAllThreadReplies();
      
      // Step 6: Sync files
      await this.syncAllFiles();
      
      // Final summary
      this.progress.status = 'completed';
      this.progress.currentOperation = 'Sync completed successfully';
      this.calculateSummaryStats();
      this.updateProgress('✅ Comprehensive Slack sync completed');
      
      return this.progress;
    } catch (error) {
      this.handleError('sync_failed', error);
      this.progress.status = 'error';
      throw error;
    }
  }
  
  // Step 1: Sync workspace information
  private async syncWorkspaceInfo(): Promise<void> {
    this.progress.status = 'syncing_workspace';
    this.updateProgress('📊 Syncing workspace information...');
    
    try {
      const teamInfo = await this.client.getTeamInfo();
      this.incrementApiCall();
      
      this.progress.workspaceInfo = {
        name: teamInfo.name,
        domain: teamInfo.domain,
        totalUsers: 0, // Will be updated later
        totalConversations: 0, // Will be updated later
      };
      
      // Update workspace in database with latest info
      // TODO: Implement database update
      
      this.updateProgress(`✅ Workspace: ${teamInfo.name} (${teamInfo.domain})`);
    } catch (error) {
      this.handleError('workspace_sync_failed', error);
    }
  }
  
  // Step 2: Sync all users
  private async syncAllUsers(): Promise<void> {
    this.progress.status = 'syncing_users';
    this.updateProgress('👥 Syncing workspace users...');
    
    try {
      let cursor: string | undefined;
      let allUsers: SlackUser[] = [];
      
      do {
        const result = await this.client.getAllUsers(cursor);
        this.incrementApiCall();
        
        allUsers.push(...result.members);
        cursor = result.response_metadata?.next_cursor;
        
        this.updateProgress(`📥 Fetched ${allUsers.length} users...`);
      } while (cursor);
      
      this.progress.totalUsers = allUsers.length;
      
      // Process each user
      for (const user of allUsers) {
        try {
          await this.processUser(user);
          this.progress.processedUsers++;
          
          if (this.progress.processedUsers % 50 === 0) {
            this.updateProgress(`👤 Processed ${this.progress.processedUsers}/${this.progress.totalUsers} users`);
          }
        } catch (error) {
          this.handleError('user_processing_failed', error, { userId: user.id });
        }
      }
      
      if (this.progress.workspaceInfo) {
        this.progress.workspaceInfo.totalUsers = this.progress.totalUsers;
      }
      
      this.updateProgress(`✅ Synced ${this.progress.processedUsers} users`);
    } catch (error) {
      this.handleError('users_sync_failed', error);
    }
  }
  
  // Step 3: Sync all conversations
  private async syncAllConversations(): Promise<void> {
    this.progress.status = 'syncing_conversations';
    this.updateProgress('💬 Discovering all conversations...');
    
    try {
      let cursor: string | undefined;
      let allConversations: SlackChannel[] = [];
      
      do {
        const result = await this.client.getAllConversations(cursor);
        this.incrementApiCall();
        
        allConversations.push(...result.channels);
        cursor = result.response_metadata?.next_cursor;
        
        this.updateProgress(`📥 Discovered ${allConversations.length} conversations...`);
      } while (cursor);
      
      // Filter conversations based on config
      const filteredConversations = this.filterConversations(allConversations);
      this.progress.totalConversations = filteredConversations.length;
      
      if (this.progress.workspaceInfo) {
        this.progress.workspaceInfo.totalConversations = this.progress.totalConversations;
      }
      
      // Process each conversation
      for (const conversation of filteredConversations) {
        try {
          await this.processConversation(conversation);
          this.progress.processedConversations++;
          
          this.updateProgress(
            `📂 Processed ${this.progress.processedConversations}/${this.progress.totalConversations} conversations`
          );
        } catch (error) {
          this.handleError('conversation_processing_failed', error, { 
            conversationId: conversation.id,
            conversationName: conversation.name 
          });
        }
      }
      
      this.updateProgress(`✅ Processed ${this.progress.processedConversations} conversations`);
    } catch (error) {
      this.handleError('conversations_sync_failed', error);
    }
  }
  
  // Step 4: Sync all messages
  private async syncAllMessages(): Promise<void> {
    this.progress.status = 'syncing_messages';
    this.updateProgress('📨 Syncing messages from all conversations...');
    
    for (const convDetail of this.progress.conversationDetails) {
      if (convDetail.syncStatus === 'completed') {
        this.progress.currentConversation = convDetail.name;
        convDetail.syncStatus = 'syncing';
        
        try {
          await this.syncConversationMessages(convDetail.id, convDetail.name);
          convDetail.syncStatus = 'completed';
        } catch (error) {
          convDetail.syncStatus = 'error';
          convDetail.error = error instanceof Error ? error.message : 'Unknown error';
          this.handleError('conversation_messages_sync_failed', error, {
            conversationId: convDetail.id,
            conversationName: convDetail.name,
          });
        }
      }
    }
    
    this.updateProgress(`✅ Synced ${this.progress.processedMessages} messages`);
  }
  
  // Step 5: Sync thread replies
  private async syncAllThreadReplies(): Promise<void> {
    this.progress.status = 'syncing_threads';
    this.updateProgress('🧵 Syncing thread replies...');
    
    if (!this.config.includeThreadReplies) {
      this.updateProgress('⏭️  Skipping thread replies (disabled in config)');
      return;
    }
    
    // TODO: Implement thread reply syncing
    // This would iterate through messages with thread_ts and fetch replies
    
    this.updateProgress(`✅ Synced ${this.progress.threadReplies} thread replies`);
  }
  
  // Step 6: Sync files
  private async syncAllFiles(): Promise<void> {
    this.progress.status = 'syncing_files';
    this.updateProgress('📎 Syncing files...');
    
    if (!this.config.includeFiles) {
      this.updateProgress('⏭️  Skipping files (disabled in config)');
      return;
    }
    
    // TODO: Implement file syncing
    
    this.updateProgress(`✅ Synced ${this.progress.processedFiles} files`);
  }
  
  // Helper methods
  private async processUser(user: SlackUser): Promise<void> {
    // Transform SlackUser to DBSlackUser and insert/update
    const userData = {
      userId: user.id,
      workspaceId: this.workspace.id,
      username: user.name,
      realName: user.profile?.real_name || null,
      displayName: user.profile?.display_name || null,
      email: user.profile?.email || null,
      title: user.profile?.title || null,
      phone: user.profile?.phone || null,
      skype: user.profile?.skype || null,
      firstName: user.profile?.first_name || null,
      lastName: user.profile?.last_name || null,
      isBot: user.is_bot,
      isAdmin: user.is_admin || false,
      isOwner: user.is_owner || false,
      isPrimaryOwner: user.is_primary_owner || false,
      isRestricted: user.is_restricted || false,
      isUltraRestricted: user.is_ultra_restricted || false,
      isDeleted: user.deleted,
      isStranger: user.is_stranger || false,
      timezone: user.tz || null,
      timezoneLabel: user.tz_label || null,
      timezoneOffset: user.tz_offset || null,
      profileImage24: user.profile?.image_24 || null,
      profileImage32: user.profile?.image_32 || null,
      profileImage48: user.profile?.image_48 || null,
      profileImage72: user.profile?.image_72 || null,
      profileImage192: user.profile?.image_192 || null,
      profileImage512: user.profile?.image_512 || null,
      profileImage1024: user.profile?.image_1024 || null,
      profileImageOriginal: user.profile?.image_original || null,
      statusText: user.profile?.status_text || null,
      statusEmoji: user.profile?.status_emoji || null,
      statusExpiration: user.profile?.status_expiration ? new Date(user.profile.status_expiration * 1000) : null,
      color: user.color || null,
      updatedAt: new Date(),
      metadata: user,
    };

    // Insert or update user
    await db.insert(slackUser)
      .values(userData)
      .onConflictDoUpdate({
        target: [slackUser.userId, slackUser.workspaceId],
        set: userData,
      });
  }
  
  private async processConversation(conversation: SlackChannel): Promise<void> {
    // Transform SlackChannel to DBSlackChannel and insert/update
    const channelData = {
      channelId: conversation.id,
      workspaceId: this.workspace.id,
      name: conversation.name || '',
      nameNormalized: conversation.name_normalized || null,
      purpose: conversation.purpose?.value || null,
      topic: conversation.topic?.value || null,
      creator: conversation.creator,
      isChannel: conversation.is_channel,
      isGroup: conversation.is_group,
      isIm: conversation.is_im,
      isMpim: conversation.is_mpim,
      isPrivate: conversation.is_private,
      isArchived: conversation.is_archived,
      isGeneral: conversation.is_general,
      isShared: conversation.is_shared,
      isExtShared: conversation.is_ext_shared,
      isOrgShared: conversation.is_org_shared,
      isMember: conversation.is_member,
      memberCount: conversation.num_members || 0,
      unlinked: conversation.unlinked || 0,
      createdTimestamp: conversation.created?.toString() || null,
      updatedAt: new Date(),
      metadata: conversation,
    };

    // Insert or update channel
    await db.insert(slackChannel)
      .values(channelData)
      .onConflictDoUpdate({
        target: [slackChannel.channelId, slackChannel.workspaceId],
        set: channelData,
      });
    
    // Add to conversation details for progress tracking
    const conversationType: 'channel' | 'group' | 'im' | 'mpim' = 
      conversation.is_im ? 'im' : 
      conversation.is_mpim ? 'mpim' : 
      conversation.is_group ? 'group' : 'channel';
    
    const detail = {
      id: conversation.id,
      name: conversation.name || `${conversation.is_im ? 'DM' : conversation.is_mpim ? 'Group' : 'Channel'}-${conversation.id}`,
      type: conversationType,
      isPrivate: conversation.is_private,
      messagesFound: 0,
      threadsFound: 0,
      reactionsFound: 0,
      filesFound: 0,
      syncStatus: 'completed' as const,
    };
    
    this.progress.conversationDetails.push(detail);
  }
  
  private async syncConversationMessages(conversationId: string, conversationName: string): Promise<void> {
    this.updateProgress(`📨 Syncing messages from ${conversationName}...`);
    
    try {
      let cursor: string | undefined;
      let totalMessagesInConv = 0;
      
      do {
        const result = await this.client.getConversationHistory(
          conversationId,
          this.config.dateFrom?.getTime().toString(),
          this.config.dateTo?.getTime().toString(),
          cursor,
          this.config.batchSize
        );
        this.incrementApiCall();
        
        for (const message of result.messages) {
          await this.processMessage(message, conversationId, conversationName);
          totalMessagesInConv++;
          this.progress.processedMessages++;
        }
        
        cursor = result.response_metadata?.next_cursor;
        
        if (totalMessagesInConv % 100 === 0) {
          this.updateProgress(
            `📨 ${conversationName}: ${totalMessagesInConv} messages processed`
          );
        }
      } while (cursor);
      
      // Update conversation detail
      const convDetail = this.progress.conversationDetails.find(c => c.id === conversationId);
      if (convDetail) {
        convDetail.messagesFound = totalMessagesInConv;
      }
      
    } catch (error) {
      this.handleError('conversation_messages_failed', error, {
        conversationId,
        conversationName,
      });
    }
  }
  
  private async processMessage(
    message: SlackMessage,
    conversationId: string,
    conversationName: string
  ): Promise<void> {
    // Skip if already processed
    if (this.processedMessages.has(message.ts)) {
      this.progress.duplicateMessages++;
      return;
    }
    
    this.processedMessages.add(message.ts);
    
    try {
      // Transform SlackMessage to DBSlackMessage and insert
      const messageData = {
        messageId: message.ts,
        channelId: conversationId,
        channelName: conversationName,
        userId: message.user,
        userName: null, // Will be populated later if needed
        userDisplayName: null,
        text: message.text || null,
        timestamp: message.ts,
        messageType: message.type,
        subtype: message.subtype || null,
        workspaceId: this.workspace.id,
        threadTs: message.thread_ts || null,
        parentUserId: message.parent_user_id || null,
        replyCount: message.reply_count || 0,
        replyUsersCount: message.reply_users_count || 0,
        latestReply: message.latest_reply || null,
        isThreadReply: message.thread_ts !== undefined && message.thread_ts !== message.ts,
        hasFiles: (message.files?.length || 0) > 0,
        hasAttachments: (message.attachments?.length || 0) > 0,
        fileCount: message.files?.length || 0,
        isEdited: message.edited !== undefined,
        editedTs: message.edited?.ts || null,
        blocks: message.blocks || null,
        attachments: message.attachments || null,
        reactions: message.reactions || null,
        reactionCount: message.reactions?.reduce((total, r) => total + r.count, 0) || 0,
        slackCreatedAt: new Date(parseFloat(message.ts) * 1000),
        metadata: message,
      };

      // Insert message
      const insertedMessage = await db.insert(slackMessage)
        .values(messageData)
        .onConflictDoUpdate({
          target: [slackMessage.messageId, slackMessage.workspaceId],
          set: messageData,
        })
        .returning({ id: slackMessage.id });

      // Process reactions
      if (message.reactions && this.config.includeReactions) {
        for (const reaction of message.reactions) {
          await db.insert(slackReaction)
            .values({
              messageId: insertedMessage[0].id,
              workspaceId: this.workspace.id,
              channelId: conversationId,
              emoji: reaction.name,
              count: reaction.count,
              users: reaction.users,
            })
            .onConflictDoUpdate({
              target: [slackReaction.messageId, slackReaction.emoji],
              set: {
                count: reaction.count,
                users: reaction.users,
                updatedAt: new Date(),
              },
            });
          
          this.progress.processedReactions++;
        }
      }
      
      // Process files
      if (message.files && this.config.includeFiles) {
        for (const file of message.files) {
          await this.processFile(file, insertedMessage[0].id, conversationId, conversationName);
          this.progress.processedFiles++;
        }
      }
      
      // Track thread messages
      if (message.thread_ts && message.thread_ts !== message.ts) {
        // This is a thread reply
        this.progress.threadReplies++;
      } else if (message.reply_count && message.reply_count > 0) {
        // This is a parent message with replies
        this.progress.totalThreads++;
        this.processedThreads.add(message.ts);
      }
      
      this.progress.newMessages++;
    } catch (error) {
      this.handleError('message_processing_failed', error, {
        messageTs: message.ts,
        conversationId,
        conversationName,
      });
    }
  }
  
  private async processFile(
    file: SlackFile, 
    messageId: string, 
    channelId: string, 
    channelName: string
  ): Promise<void> {
    try {
      const fileData = {
        fileId: file.id,
        name: file.name,
        title: file.title || null,
        mimetype: file.mimetype,
        filetype: file.filetype,
        prettyType: file.pretty_type || null,
        size: file.size,
        mode: file.mode,
        isExternal: file.is_external,
        externalType: file.external_type || null,
        isStarred: file.is_starred || false,
        isPublic: file.is_public,
        publicUrlShared: file.public_url_shared,
        displayAsBot: file.display_as_bot,
        urlPrivate: file.url_private,
        urlPrivateDownload: file.url_private_download || null,
        permalink: file.permalink,
        permalinkPublic: file.permalink_public || null,
        thumb64: file.thumb_64 || null,
        thumb80: file.thumb_80 || null,
        thumb160: file.thumb_160 || null,
        thumb360: file.thumb_360 || null,
        thumb480: file.thumb_480 || null,
        thumb720: file.thumb_720 || null,
        thumb800: file.thumb_800 || null,
        thumb960: file.thumb_960 || null,
        thumb1024: file.thumb_1024 || null,
        content: null, // TODO: Extract file content if needed
        preview: file.preview || null,
        plainText: null,
        previewHighlight: file.preview_highlight || null,
        lines: file.lines || null,
        linesMore: file.lines_more || null,
        hasRichPreview: file.has_rich_preview || false,
        userId: file.user,
        userName: file.username || null,
        workspaceId: this.workspace.id,
        messageId,
        channelId,
        channelName,
        slackCreatedAt: new Date(file.created * 1000),
        slackUpdatedAt: new Date(file.timestamp * 1000),
        metadata: file,
      };

      await db.insert(slackFile)
        .values(fileData)
        .onConflictDoUpdate({
          target: [slackFile.fileId],
          set: fileData,
        });
    } catch (error) {
      this.handleError('file_processing_failed', error, {
        fileId: file.id,
        fileName: file.name,
      });
    }
  }
  
  private filterConversations(conversations: SlackChannel[]): SlackChannel[] {
    return conversations.filter(conv => {
      // Check type filters
      if (conv.is_channel && !this.config.includePublicChannels && !conv.is_private) return false;
      if (conv.is_channel && !this.config.includePrivateChannels && conv.is_private) return false;
      if (conv.is_group && !this.config.includeGroupMessages) return false;
      if (conv.is_im && !this.config.includeDirectMessages) return false;
      if (conv.is_mpim && !this.config.includeGroupMessages) return false;
      
      // Check specific includes/excludes
      if (this.config.specificChannels && !this.config.specificChannels.includes(conv.id)) return false;
      if (this.config.excludeChannels && this.config.excludeChannels.includes(conv.id)) return false;
      
      return true;
    });
  }
  
  private incrementApiCall(): void {
    this.progress.apiCallCount++;
  }
  
  private handleError(type: string, error: any, details?: any): void {
    const errorEntry = {
      type,
      message: error instanceof Error ? error.message : String(error),
      details,
      timestamp: new Date(),
    };
    
    this.progress.errors.push(errorEntry);
    console.error(`Slack Sync Error [${type}]:`, error, details);
  }
  
  private updateProgress(operation: string): void {
    this.progress.currentOperation = operation;
    console.log(`[Slack Sync] ${operation}`);
    
    if (this.onProgressCallback) {
      this.onProgressCallback(this.progress);
    }
  }
  
  private calculateSummaryStats(): void {
    const duration = (Date.now() - this.progress.startTime.getTime()) / 1000;
    
    this.progress.summary = {
      duration,
      messagesPerSecond: this.progress.processedMessages / duration,
      apiCallsPerSecond: this.progress.apiCallCount / duration,
      dataSize: 0, // TODO: Calculate based on content size
    };
  }
  
  // Public method to get current progress
  getProgress(): ComprehensiveSyncProgress {
    return { ...this.progress };
  }
  
  // Public method to pause sync
  pause(): void {
    // TODO: Implement pause functionality
  }
  
  // Public method to resume sync
  resume(): void {
    // TODO: Implement resume functionality
  }
  
  // Public method to cancel sync
  cancel(): void {
    // TODO: Implement cancellation
    this.progress.status = 'error';
    this.progress.currentOperation = 'Sync cancelled by user';
  }
} 