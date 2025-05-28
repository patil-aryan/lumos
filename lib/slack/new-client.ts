import { WebClient } from '@slack/web-api';
import axios from 'axios';

// Comprehensive interfaces based on Slack API documentation
export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
    domain: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  user: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  parent_user_id?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  is_starred?: boolean;
  pinned_to?: string[];
  reactions?: SlackReaction[];
  files?: SlackFile[];
  attachments?: any[];
  blocks?: any[];
  edited?: {
    user: string;
    ts: string;
  };
  bot_id?: string;
  bot_profile?: any;
  client_msg_id?: string;
  team?: string;
  permalink?: string;
  metadata?: any;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title?: string;
  mimetype: string;
  filetype: string;
  pretty_type?: string;
  user: string;
  editable: boolean;
  size: number;
  mode: string;
  is_external: boolean;
  external_type?: string;
  is_public: boolean;
  public_url_shared: boolean;
  display_as_bot: boolean;
  username?: string;
  url_private: string;
  url_private_download?: string;
  permalink: string;
  permalink_public?: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_160?: string;
  thumb_360?: string;
  thumb_480?: string;
  thumb_720?: string;
  thumb_800?: string;
  thumb_960?: string;
  thumb_1024?: string;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  has_rich_preview?: boolean;
  preview?: string;
  preview_highlight?: string;
  lines?: number;
  lines_more?: number;
  preview_is_truncated?: boolean;
  comments_count?: number;
  is_starred?: boolean;
  shares?: any;
  channels?: string[];
  groups?: string[];
  ims?: string[];
  initial_comment?: any;
}

export interface SlackChannel {
  id: string;
  name?: string;
  name_normalized?: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  created: number;
  is_archived: boolean;
  is_general: boolean;
  unlinked: number;
  creator: string;
  is_shared: boolean;
  is_ext_shared: boolean;
  is_org_shared: boolean;
  shared_team_ids?: string[];
  pending_shared?: string[];
  pending_connected_team_ids?: string[];
  is_pending_ext_shared?: boolean;
  is_member: boolean;
  is_open?: boolean;
  last_read?: string;
  latest?: SlackMessage;
  unread_count?: number;
  unread_count_display?: number;
  is_starred?: boolean;
  priority?: number;
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members?: number;
  locale?: string;
  user?: string; // For DMs
  is_user_deleted?: boolean; // For DMs
}

export interface SlackUser {
  id: string;
  team_id?: string;
  name: string;
  deleted: boolean;
  color?: string;
  real_name?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  profile: {
    title?: string;
    phone?: string;
    skype?: string;
    real_name?: string;
    real_name_normalized?: string;
    display_name?: string;
    display_name_normalized?: string;
    fields?: any;
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
    avatar_hash?: string;
    first_name?: string;
    last_name?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    image_1024?: string;
    image_original?: string;
    status_text_canonical?: string;
    team?: string;
    email?: string;
  };
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  is_bot: boolean;
  is_stranger?: boolean;
  updated: number;
  is_email_confirmed?: boolean;
  who_can_share_contact_card?: string;
  locale?: string;
}

export interface SlackTeam {
  id: string;
  name: string;
  domain: string;
  email_domain?: string;
  icon?: {
    image_34?: string;
    image_44?: string;
    image_68?: string;
    image_88?: string;
    image_102?: string;
    image_132?: string;
    image_230?: string;
    image_default?: boolean;
  };
  enterprise_id?: string;
  enterprise_name?: string;
}

export interface ConversationMember {
  id: string;
  is_admin?: boolean;
  date_joined?: number;
}

export interface ThreadReply {
  messages: SlackMessage[];
  has_more: boolean;
  ok: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

export class SlackClient {
  private client: WebClient;

  constructor(accessToken: string) {
    this.client = new WebClient(accessToken);
  }

  // OAuth flow
  static async exchangeCodeForToken(code: string): Promise<SlackOAuthResponse> {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        code,
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  // Team/Workspace info
  async getTeamInfo(): Promise<SlackTeam> {
    try {
      const result = await this.client.team.info();
      return result.team as SlackTeam;
    } catch (error) {
      console.error('Error fetching team info:', error);
      throw error;
    }
  }

  // Get all conversation types: channels, groups, DMs, multiparty DMs
  async getAllConversations(cursor?: string): Promise<{
    channels: SlackChannel[];
    response_metadata?: { next_cursor?: string };
  }> {
    try {
      const params: any = {
        exclude_archived: false, // Include archived to get full history
        types: 'public_channel,private_channel,mpim,im', // All conversation types
        limit: 200,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await this.client.conversations.list(params);
      return {
        channels: (result.channels || []) as SlackChannel[],
        response_metadata: result.response_metadata,
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Get all users with pagination
  async getAllUsers(cursor?: string): Promise<{
    members: SlackUser[];
    response_metadata?: { next_cursor?: string };
  }> {
    try {
      const params: any = {
        limit: 200,
        include_locale: true,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await this.client.users.list(params);
      return {
        members: (result.members || []) as SlackUser[],
        response_metadata: result.response_metadata,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Get detailed conversation info
  async getConversationInfo(channelId: string): Promise<SlackChannel | null> {
    try {
      const result = await this.client.conversations.info({
        channel: channelId,
        include_num_members: true,
      });
      return result.channel as SlackChannel;
    } catch (error) {
      console.warn(`Could not get conversation info for ${channelId}:`, error);
      return null;
    }
  }

  // Get conversation members
  async getConversationMembers(channelId: string, cursor?: string): Promise<{
    members: string[];
    response_metadata?: { next_cursor?: string };
  }> {
    try {
      const params: any = {
        channel: channelId,
        limit: 200,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await this.client.conversations.members(params);
      return {
        members: (result.members || []) as string[],
        response_metadata: result.response_metadata,
      };
    } catch (error) {
      console.error(`Error fetching members for ${channelId}:`, error);
      throw error;
    }
  }

  // Get conversation history with comprehensive message data
  async getConversationHistory(
    channelId: string,
    oldest?: string,
    latest?: string,
    cursor?: string,
    limit: number = 200
  ): Promise<{
    messages: SlackMessage[];
    has_more: boolean;
    response_metadata?: { next_cursor?: string };
  }> {
    try {
      const params: any = {
        channel: channelId,
        limit,
        include_all_metadata: true,
      };

      if (oldest) params.oldest = oldest;
      if (latest) params.latest = latest;
      if (cursor) params.cursor = cursor;

      const result = await this.client.conversations.history(params);
      return {
        messages: (result.messages || []) as SlackMessage[],
        has_more: result.has_more || false,
        response_metadata: result.response_metadata,
      };
    } catch (error) {
      console.error(`Error fetching history for ${channelId}:`, error);
      throw error;
    }
  }

  // Get thread replies for a message
  async getThreadReplies(
    channelId: string,
    threadTs: string,
    cursor?: string,
    limit: number = 200
  ): Promise<ThreadReply> {
    try {
      const params: any = {
        channel: channelId,
        ts: threadTs,
        limit,
        include_all_metadata: true,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await this.client.conversations.replies(params);
      return result as ThreadReply;
    } catch (error) {
      console.error(`Error fetching thread replies for ${threadTs}:`, error);
      throw error;
    }
  }

  // Get user info
  async getUserInfo(userId: string): Promise<SlackUser | null> {
    try {
      const result = await this.client.users.info({ 
        user: userId,
        include_locale: true 
      });
      return result.user as SlackUser;
    } catch (error) {
      console.warn(`Could not get user info for ${userId}:`, error);
      return null;
    }
  }

  // Get user presence
  async getUserPresence(userId: string): Promise<{ presence: string; online: boolean } | null> {
    try {
      const result = await this.client.users.getPresence({ user: userId });
      return {
        presence: result.presence as string,
        online: result.online as boolean,
      };
    } catch (error) {
      console.warn(`Could not get presence for ${userId}:`, error);
      return null;
    }
  }

  // Get all files
  async getFiles(
    channelId?: string,
    userId?: string,
    tsFrom?: string,
    tsTo?: string,
    page: number = 1,
    count: number = 100
  ): Promise<{
    files: SlackFile[];
    paging: {
      count: number;
      total: number;
      page: number;
      pages: number;
    };
  }> {
    try {
      const params: any = {
        count,
        page,
      };

      if (channelId) params.channel = channelId;
      if (userId) params.user = userId;
      if (tsFrom) params.ts_from = tsFrom;
      if (tsTo) params.ts_to = tsTo;

      const result = await this.client.files.list(params);
      return {
        files: (result.files || []) as SlackFile[],
        paging: result.paging as any,
      };
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }

  // Download file content
  async downloadFile(fileUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(fileUrl, {
        headers: {
          Authorization: `Bearer ${this.client.token}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  // Get file info
  async getFileInfo(fileId: string): Promise<SlackFile | null> {
    try {
      const result = await this.client.files.info({ file: fileId });
      return result.file as SlackFile;
    } catch (error) {
      console.warn(`Could not get file info for ${fileId}:`, error);
      return null;
    }
  }

  // Test API connection and permissions
  async testConnection(): Promise<{
    ok: boolean;
    url: string;
    team: string;
    user: string;
    team_id: string;
    user_id: string;
    bot_id?: string;
  }> {
    try {
      const result = await this.client.auth.test();
      return result as any;
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  }

  // Check bot permissions and access
  async checkBotPermissions(): Promise<{
    scopes: string[];
    canReadChannels: boolean;
    canReadGroups: boolean;
    canReadIms: boolean;
    canReadMpims: boolean;
    canReadFiles: boolean;
    canReadUsers: boolean;
  }> {
    try {
      const authTest = await this.testConnection();
      
      // Get bot info to check scopes
      const botInfo = await this.client.bots.info({ bot: authTest.bot_id });
      const scopes = (botInfo.bot as any)?.app_id ? [] : []; // Simplified for now

      return {
        scopes,
        canReadChannels: true, // Will be determined by actual API calls
        canReadGroups: true,
        canReadIms: true,
        canReadMpims: true,
        canReadFiles: true,
        canReadUsers: true,
      };
    } catch (error) {
      console.error('Error checking bot permissions:', error);
      throw error;
    }
  }

  // Rate limiting helper
  async rateLimitedCall<T>(apiCall: () => Promise<T>, retryCount = 3): Promise<T> {
    for (let i = 0; i < retryCount; i++) {
      try {
        return await apiCall();
      } catch (error: any) {
        if (error?.data?.error === 'rate_limited') {
          const retryAfter = error?.data?.headers?.['retry-after'] || Math.pow(2, i);
          console.log(`Rate limited, waiting ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }
} 