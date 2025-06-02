import axios, { AxiosInstance } from 'axios';

export interface JiraOAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface JiraResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: {
    accountId: string;
    displayName: string;
  };
  projectTypeKey: string;
  simplified: boolean;
  style: string;
  isPrivate: boolean;
  properties?: any;
  entityId?: string;
  uuid?: string;
  components?: Array<{
    id: string;
    name: string;
  }>;
  versions?: Array<{
    id: string;
    name: string;
    releaseDate?: string;
  }>;
  issueTypes?: Array<{
    id: string;
    name: string;
    subtask: boolean;
  }>;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: any;
    issuetype: {
      id: string;
      name: string;
      subtask: boolean;
    };
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        name: string;
      };
    };
    priority?: {
      id: string;
      name: string;
    };
    resolution?: {
      id: string;
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    reporter: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    creator: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    created: string;
    updated: string;
    duedate?: string;
    resolutiondate?: string;
    labels: string[];
    components: Array<{
      id: string;
      name: string;
    }>;
    fixVersions: Array<{
      id: string;
      name: string;
      releaseDate?: string;
    }>;
    versions: Array<{
      id: string;
      name: string;
      releaseDate?: string;
    }>;
    parent?: {
      key: string;
      fields: {
        summary: string;
        issuetype: {
          name: string;
        };
      };
    };
    subtasks: Array<{
      key: string;
      fields: {
        summary: string;
        status: {
          name: string;
        };
      };
    }>;
    issuelinks: Array<{
      type: {
        name: string;
        inward: string;
        outward: string;
      };
      inwardIssue?: {
        key: string;
        fields: {
          summary: string;
          status: {
            name: string;
          };
        };
      };
      outwardIssue?: {
        key: string;
        fields: {
          summary: string;
          status: {
            name: string;
          };
        };
      };
    }>;
    attachment: Array<{
      id: string;
      filename: string;
      author: {
        accountId: string;
        displayName: string;
      };
      created: string;
      size: number;
      mimeType: string;
      content: string;
      thumbnail?: string;
    }>;
    comment: {
      total: number;
      comments: Array<{
        id: string;
        author: {
          accountId: string;
          displayName: string;
        };
        body: any;
        created: string;
        updated: string;
        visibility?: {
          type: string;
          value: string;
        };
      }>;
    };
    worklog: {
      total: number;
      worklogs: Array<{
        id: string;
        author: {
          accountId: string;
          displayName: string;
        };
        comment?: string;
        started: string;
        timeSpent: string;
        timeSpentSeconds: number;
      }>;
    };
    timetracking: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    votes: {
      votes: number;
      hasVoted: boolean;
    };
    watches: {
      watchCount: number;
      isWatching: boolean;
    };
    // Custom fields will be dynamic
    [key: string]: any;
  };
  changelog?: {
    histories: Array<{
      id: string;
      author: {
        accountId: string;
        displayName: string;
      };
      created: string;
      items: Array<{
        field: string;
        fieldtype: string;
        fieldId?: string;
        from?: string;
        fromString?: string;
        to?: string;
        toString?: string;
      }>;
    }>;
  };
}

export interface JiraUser {
  accountId: string;
  accountType: string;
  emailAddress?: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
  displayName: string;
  active: boolean;
  timeZone?: string;
  locale?: string;
  groups?: {
    size: number;
    items: Array<{
      name: string;
      groupId?: string;
    }>;
  };
  applicationRoles?: {
    size: number;
    items: Array<{
      key: string;
      name: string;
    }>;
  };
}

export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: string;
  location: {
    projectId: number;
    displayName: string;
    projectName: string;
    projectKey: string;
    projectTypeKey: string;
    avatarURI: string;
    name: string;
  };
  filter: {
    id: string;
    self: string;
  };
}

export interface JiraSprint {
  id: number;
  self: string;
  state: 'active' | 'closed' | 'future';
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId: number;
  goal?: string;
}

export class JiraClient {
  private axiosInstance: AxiosInstance;
  private cloudId: string;
  private accessToken: string;

  constructor(accessToken: string, cloudId: string) {
    this.cloudId = cloudId;
    this.accessToken = accessToken;
    
    if (!accessToken) {
      throw new Error('Access token is required for JiraClient');
    }
    
    if (!cloudId) {
      throw new Error('Cloud ID is required for JiraClient');
    }
    
    this.axiosInstance = axios.create({
      baseURL: `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor to handle 401 errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Log 401 errors with more context
          console.error('Jira API 401 Unauthorized:', {
            url: error.config?.url,
            method: error.config?.method,
            cloudId: this.cloudId,
            hasToken: !!this.accessToken,
            tokenPrefix: this.accessToken?.substring(0, 10) + '...',
            baseURL: error.config?.baseURL,
            statusText: error.response?.statusText,
            responseData: error.response?.data
          });
        }
        return Promise.reject(error);
      }
    );
  }

  // Method to update access token
  updateAccessToken(newAccessToken: string): void {
    if (!newAccessToken) {
      throw new Error('New access token cannot be empty');
    }
    this.accessToken = newAccessToken;
    this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${newAccessToken}`;
  }

  // OAuth methods
  static async exchangeCodeForToken(code: string): Promise<JiraOAuthResponse> {
    if (!process.env.JIRA_CLIENT_ID) {
      throw new Error('JIRA_CLIENT_ID environment variable is not set');
    }
    
    if (!process.env.JIRA_CLIENT_SECRET) {
      throw new Error('JIRA_CLIENT_SECRET environment variable is not set');
    }
    
    if (!process.env.JIRA_REDIRECT_URI) {
      throw new Error('JIRA_REDIRECT_URI environment variable is not set');
    }
    
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: process.env.JIRA_REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  static async refreshAccessToken(refreshToken: string): Promise<JiraOAuthResponse> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    
    if (!process.env.JIRA_CLIENT_ID) {
      throw new Error('JIRA_CLIENT_ID environment variable is not set');
    }
    
    if (!process.env.JIRA_CLIENT_SECRET) {
      throw new Error('JIRA_CLIENT_SECRET environment variable is not set');
    }
    
    console.log('Attempting to refresh Jira token...');
    
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Token refresh response received:', {
      hasAccessToken: !!response.data.access_token,
      hasRefreshToken: !!response.data.refresh_token,
      expiresIn: response.data.expires_in
    });

    return response.data;
  }

  static async getAccessibleResources(accessToken: string): Promise<JiraResource[]> {
    if (!accessToken) {
      throw new Error('Access token is required to get accessible resources');
    }
    
    const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    return response.data;
  }

  // Core API methods
  async getServerInfo(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/serverInfo');
      return response.data;
    } catch (error: any) {
      console.error('Error getting server info:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        cloudId: this.cloudId
      });
      throw error;
    }
  }

  async getProjects(expand?: string[]): Promise<JiraProject[]> {
    const params: any = {
      maxResults: 100,
    };
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await this.axiosInstance.get('/project/search', { params });
    return response.data.values || [];
  }

  async getProject(projectKey: string, expand?: string[]): Promise<JiraProject> {
    const params: any = {};
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await this.axiosInstance.get(`/project/${projectKey}`, { params });
    return response.data;
  }

  // Issue methods with comprehensive field support
  async searchIssues(
    jql: string,
    fields?: string[],
    expand?: string[],
    maxResults: number = 100,
    startAt: number = 0
  ): Promise<{ issues: JiraIssue[]; total: number; maxResults: number; startAt: number }> {
    const params: any = {
      jql,
      maxResults,
      startAt,
    };

    if (fields?.length) {
      params.fields = fields.join(',');
    } else {
      // Default comprehensive field set for PM data
      params.fields = [
        'summary', 'description', 'issuetype', 'status', 'priority', 'resolution',
        'assignee', 'reporter', 'creator', 'created', 'updated', 'duedate', 'resolutiondate',
        'labels', 'components', 'fixVersions', 'versions', 'parent', 'subtasks', 'issuelinks',
        'attachment', 'comment', 'worklog', 'timetracking', 'votes', 'watches',
        'project', 'environment', 'customfield_*'
      ].join(',');
    }

    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await this.axiosInstance.get('/search', { params });
    return response.data;
  }

  async getIssue(
    issueKey: string,
    fields?: string[],
    expand?: string[]
  ): Promise<JiraIssue> {
    const params: any = {};

    if (fields?.length) {
      params.fields = fields.join(',');
    }

    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await this.axiosInstance.get(`/issue/${issueKey}`, { params });
    return response.data;
  }

  async getIssueChangelog(
    issueKey: string,
    maxResults: number = 100,
    startAt: number = 0
  ): Promise<any> {
    const params = {
      maxResults,
      startAt,
    };

    const response = await this.axiosInstance.get(`/issue/${issueKey}/changelog`, { params });
    return response.data;
  }

  // User methods
  async getUsers(maxResults: number = 100, startAt: number = 0): Promise<JiraUser[]> {
    const response = await this.axiosInstance.get('/users/search', {
      params: {
        maxResults,
        startAt,
      },
    });
    return response.data;
  }

  async getUser(accountId: string, expand?: string[]): Promise<JiraUser> {
    const params: any = {};
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await this.axiosInstance.get(`/user`, {
      params: {
        accountId,
        ...params,
      },
    });
    return response.data;
  }

  // Agile methods (using Jira Software API)
  async getBoards(
    maxResults: number = 100,
    startAt: number = 0,
    projectKeyOrId?: string
  ): Promise<{ values: JiraBoard[]; total: number; maxResults: number; startAt: number }> {
    const baseURL = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/agile/1.0`;
    
    const params: any = {
      maxResults,
      startAt,
    };

    if (projectKeyOrId) {
      params.projectKeyOrId = projectKeyOrId;
    }

    const response = await axios.get(`${baseURL}/board`, {
      params,
      headers: {
        'Authorization': this.axiosInstance.defaults.headers['Authorization'],
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }

  async getBoard(boardId: number): Promise<JiraBoard> {
    const baseURL = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/agile/1.0`;
    
    const response = await axios.get(`${baseURL}/board/${boardId}`, {
      headers: {
        'Authorization': this.axiosInstance.defaults.headers['Authorization'],
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }

  async getSprints(
    boardId: number,
    maxResults: number = 100,
    startAt: number = 0,
    state?: 'active' | 'closed' | 'future'
  ): Promise<{ values: JiraSprint[]; total: number; maxResults: number; startAt: number }> {
    const baseURL = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/agile/1.0`;
    
    const params: any = {
      maxResults,
      startAt,
    };

    if (state) {
      params.state = state;
    }

    const response = await axios.get(`${baseURL}/board/${boardId}/sprint`, {
      params,
      headers: {
        'Authorization': this.axiosInstance.defaults.headers['Authorization'],
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }

  async getSprint(sprintId: number): Promise<JiraSprint> {
    const baseURL = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/agile/1.0`;
    
    const response = await axios.get(`${baseURL}/sprint/${sprintId}`, {
      headers: {
        'Authorization': this.axiosInstance.defaults.headers['Authorization'],
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }

  async getSprintIssues(
    sprintId: number,
    maxResults: number = 100,
    startAt: number = 0,
    fields?: string[],
    expand?: string[]
  ): Promise<{ issues: JiraIssue[]; total: number; maxResults: number; startAt: number }> {
    const baseURL = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/agile/1.0`;
    
    const params: any = {
      maxResults,
      startAt,
    };

    if (fields?.length) {
      params.fields = fields.join(',');
    }

    if (expand?.length) {
      params.expand = expand.join(',');
    }

    const response = await axios.get(`${baseURL}/sprint/${sprintId}/issue`, {
      params,
      headers: {
        'Authorization': this.axiosInstance.defaults.headers['Authorization'],
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  }

  // Field metadata for custom fields
  async getFields(): Promise<any[]> {
    const response = await this.axiosInstance.get('/field');
    return response.data;
  }

  async getCustomFieldOptions(fieldId: string): Promise<any> {
    const response = await this.axiosInstance.get(`/customFieldOption/${fieldId}`);
    return response.data;
  }

  // Utility methods for pagination
  async getAllPaginated<T>(
    fetchFunction: (startAt: number, maxResults: number) => Promise<{ values: T[]; total: number; isLast?: boolean }>,
    maxResults: number = 100,
    maxTotal?: number
  ): Promise<T[]> {
    const allItems: T[] = [];
    let startAt = 0;
    let total = 0;

    do {
      const result = await fetchFunction(startAt, maxResults);
      allItems.push(...result.values);
      
      startAt += maxResults;
      total = result.total;

      // Stop if we've reached the max or if this is the last page
      if (result.isLast || (maxTotal && allItems.length >= maxTotal)) {
        break;
      }
    } while (startAt < total);

    return maxTotal ? allItems.slice(0, maxTotal) : allItems;
  }

  // Health check
  async testConnection(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch (error) {
      console.error('Jira connection test failed:', error);
      return false;
    }
  }
} 