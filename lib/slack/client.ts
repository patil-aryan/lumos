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

  async getChannels(): Promise<SlackChannel[]> {
    try {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel,im,mpim',
        limit: 200,
      });

      return (result.channels || []) as SlackChannel[];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  async getChannelHistory(channelId: string, oldest?: string): Promise<SlackMessage[]> {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        oldest,
        limit: 200,
      });

      return (result.messages || []) as SlackMessage[];
    } catch (error) {
      console.error(`Error fetching history for channel ${channelId}:`, error);
      throw error;
    }
  }

  async getUserInfo(userId: string) {
    try {
      const result = await this.client.users.info({
        user: userId,
      });
      return result.user;
    } catch (error) {
      console.error(`Error fetching user info for ${userId}:`, error);
      return null;
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
} 