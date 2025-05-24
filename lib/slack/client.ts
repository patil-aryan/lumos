import { WebClient } from '@slack/web-api';
import axios from 'axios';

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  scope: string;
  user_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
  };
  bot_user_id?: string;
  error?: string;
}

export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  files?: Array<{
    id: string;
    name: string;
    title?: string;
    mimetype: string;
    filetype: string;
    size: number;
    url_private: string;
  }>;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
}

export class SlackClient {
  private client: WebClient;

  constructor(accessToken: string) {
    this.client = new WebClient(accessToken);
  }

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

  async getWorkspaceInfo() {
    try {
      const result = await this.client.team.info();
      return result.team;
    } catch (error) {
      console.error('Error fetching workspace info:', error);
      throw error;
    }
  }

  async getChannels(): Promise<any[]> {
    try {
      const result = await this.client.conversations.list({
        exclude_archived: true,
        types: 'public_channel,private_channel',
        limit: 200,
      });
      return result.channels || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  async getUsers(cursor?: string): Promise<{ 
    members: any[], 
    response_metadata?: { next_cursor?: string } 
  }> {
    try {
      const params: any = {
        limit: 200,
      };
      
      if (cursor) {
        params.cursor = cursor;
      }

      const result = await this.client.users.list(params);
      return {
        members: result.members || [],
        response_metadata: result.response_metadata,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async getUserInfo(userId: string): Promise<any> {
    try {
      const result = await this.client.users.info({ user: userId });
      return result.user;
    } catch (error) {
      console.warn(`Could not get user info for ${userId}:`, error);
      return null;
    }
  }

  async getChannelHistory(channelId: string, oldest?: string): Promise<SlackMessage[]> {
    try {
      const params: any = {
        channel: channelId,
        limit: 100,
      };
      
      if (oldest) {
        params.oldest = oldest;
      }

      const result = await this.client.conversations.history(params);
      return (result.messages || []) as SlackMessage[];
    } catch (error) {
      console.error(`Error fetching history for channel ${channelId}:`, error);
      throw error;
    }
  }

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

  async getFiles(channelId?: string): Promise<any[]> {
    try {
      const result = await this.client.files.list({
        channel: channelId,
        count: 100,
      });

      return result.files || [];
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }

  async getChannelInfo(channelId: string): Promise<any> {
    try {
      const result = await this.client.conversations.info({ 
        channel: channelId,
        include_num_members: true 
      });
      return result.channel;
    } catch (error) {
      console.warn(`Could not get channel info for ${channelId}:`, error);
      return null;
    }
  }

  async checkBotMembership(channelId: string): Promise<{ isMember: boolean; error?: string }> {
    try {
      // Try to get channel info - this will fail if bot is not a member
      const result = await this.client.conversations.info({ 
        channel: channelId,
        include_num_members: true 
      });
      return { isMember: true };
    } catch (error: any) {
      if (error?.data?.error === 'not_in_channel') {
        return { isMember: false, error: 'not_in_channel' };
      } else if (error?.data?.error === 'channel_not_found') {
        return { isMember: false, error: 'channel_not_found' };
      } else {
        return { isMember: false, error: error?.data?.error || 'unknown' };
      }
    }
  }
} 