import axios, { AxiosInstance } from 'axios';

// OAuth response from Confluence
export interface ConfluenceOAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Confluence accessible resource
export interface ConfluenceResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

// Confluence Space
export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  description?: {
    plain: {
      value: string;
    };
  };
  type: string;
  status: string;
  homepage?: {
    id: string;
    title: string;
  };
  metadata?: any;
  permissions?: any[];
  _links?: {
    webui: string;
    self: string;
  };
}

// Confluence Page/Content
export interface ConfluencePage {
  id: string;
  type: string; // 'page', 'blogpost', 'comment'
  status: string; // 'current', 'trashed', 'deleted'
  title: string;
  spaceId?: string; // API v2 returns spaceId instead of expanded space
  space?: {
    id: string;
    key: string;
    name: string;
  };
  authorId?: string; // API v2 returns authorId
  ownerId?: string; // API v2 additional fields
  lastOwnerId?: string;
  parentId?: string;
  parentType?: string;
  position?: number;
  createdAt?: string; // API v2 returns createdAt
  body?: {
    view?: {
      value: string;
      representation: string;
    };
    storage?: {
      value: string;
      representation: string;
    };
    atlas_doc_format?: {
      value: string;
    };
  };
  version: {
    number: number;
    message?: string;
    when: string;
    by: {
      accountId: string;
      displayName: string;
      email?: string;
    };
    // API v2 additional version fields
    minorEdit?: boolean;
    authorId?: string;
    createdAt?: string;
    ncsStepVersion?: number;
  };
  ancestors?: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  children?: {
    page?: {
      results: ConfluencePage[];
      size: number;
    };
    comment?: {
      results: ConfluenceComment[];
      size: number;
    };
  };
  metadata?: {
    labels?: {
      results: Array<{
        id: string;
        name: string;
        prefix: string;
      }>;
    };
    properties?: any;
  };
  restrictions?: {
    read?: {
      restrictions: {
        user: {
          results: any[];
        };
        group: {
          results: any[];
        };
      };
    };
  };
  _links?: {
    webui: string;
    edit: string;
    tinyui: string;
    self: string;
  };
  _expandable?: {
    [key: string]: string;
  };
}

// Confluence Comment
export interface ConfluenceComment {
  id: string;
  type: 'comment';
  status: string;
  title?: string;
  body?: {
    view?: {
      value: string;
    };
    storage?: {
      value: string;
    };
  };
  version: {
    number: number;
    when: string;
    by: {
      accountId: string;
      displayName: string;
    };
  };
  ancestors?: Array<{
    id: string;
    title: string;
  }>;
  container?: {
    id: string;
    title: string;
    type: string;
  };
  _links?: {
    webui: string;
    self: string;
  };
}

// Confluence User
export interface ConfluenceUser {
  accountId: string;
  accountType: string;
  email?: string;
  publicName: string;
  displayName: string;
  profilePicture?: {
    path: string;
    width: number;
    height: number;
    isDefault: boolean;
  };
  timeZone?: string;
  locale?: string;
  isExternalCollaborator?: boolean;
  operations?: Array<{
    operation: string;
    targetType: string;
  }>;
  details?: {
    personal?: {
      phone?: string;
      website?: string;
    };
    business?: {
      position?: string;
      department?: string;
      location?: string;
    };
  };
  _links?: {
    self: string;
  };
}

// Search results
export interface ConfluenceSearchResult {
  content: ConfluencePage[];
  start: number;
  limit: number;
  size: number;
  totalSize: number;
  _links: {
    base: string;
    context: string;
    self: string;
  };
}

export class ConfluenceClient {
  private axiosInstance: AxiosInstance;
  private cloudId: string;
  private accessToken: string;

  // OAuth 2.0 scopes optimized for v2 API endpoints
  private static readonly REQUIRED_SCOPES = [
    // Essential v2 API scopes (what v2 endpoints actually require)
    'read:space:confluence',               // Required for /spaces endpoint
    'read:page:confluence',                // Specifically for /v2/pages endpoint
    'read:content:confluence',             // General content access (includes pages, blogs etc.)
    'read:user:confluence',                // Required for user information
    'read:content-details:confluence',     // For detailed content access
    'read:space-details:confluence',       // For detailed space information
    
    // Additional v2 API compatible scopes
    'read:blogpost:confluence',
    'read:comment:confluence',
    'read:content.metadata:confluence',
    'read:analytics.content:confluence',
    'read:watcher:confluence',
    'read:group:confluence',
    
    // Classic scopes for backward compatibility
    'read:confluence-content.all',
    'read:confluence-user',
    'read:confluence-space.summary'
  ];

  constructor(accessToken: string, cloudId: string) {
    this.accessToken = accessToken;
    this.cloudId = cloudId;
    
    // Use the correct v2 API base URL as per documentation
    this.axiosInstance = axios.create({
      baseURL: `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    console.log('ConfluenceClient initialized with:', {
      cloudId,
      baseURL: this.axiosInstance.defaults.baseURL,
      tokenLength: accessToken?.length
    });
  }

  // OAuth methods
  static async exchangeCodeForToken(code: string): Promise<ConfluenceOAuthResponse> {
    if (!process.env.CONFLUENCE_CLIENT_ID) {
      throw new Error('CONFLUENCE_CLIENT_ID environment variable is not set');
    }
    
    if (!process.env.CONFLUENCE_CLIENT_SECRET) {
      throw new Error('CONFLUENCE_CLIENT_SECRET environment variable is not set');
    }
    
    if (!process.env.CONFLUENCE_REDIRECT_URI) {
      throw new Error('CONFLUENCE_REDIRECT_URI environment variable is not set');
    }
    
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.CONFLUENCE_CLIENT_ID,
      client_secret: process.env.CONFLUENCE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.CONFLUENCE_REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  static async refreshAccessToken(refreshToken: string): Promise<ConfluenceOAuthResponse> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    
    if (!process.env.CONFLUENCE_CLIENT_ID) {
      throw new Error('CONFLUENCE_CLIENT_ID environment variable is not set');
    }
    
    if (!process.env.CONFLUENCE_CLIENT_SECRET) {
      throw new Error('CONFLUENCE_CLIENT_SECRET environment variable is not set');
    }
    
    console.log('Attempting to refresh Confluence token...');
    
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.CONFLUENCE_CLIENT_ID,
      client_secret: process.env.CONFLUENCE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Confluence token refresh response received');
    return response.data;
  }

  static async getAccessibleResources(accessToken: string): Promise<ConfluenceResource[]> {
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

  // Core API methods - v2 API only
  async getSpaces(limit: number = 25, cursor?: string, expand?: string[]): Promise<{ results: ConfluenceSpace[]; size: number; limit: number; _links?: { next?: string } }> {
    const params: any = {
      limit,
    };
    
    // v2 API uses cursor-based pagination as per documentation
    if (cursor) {
      params.cursor = cursor;
    }
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    try {
      console.log('Getting spaces with v2 API params:', params);
      
      // According to the documentation pattern, spaces endpoint should exist
      // If not, we'll need to extract spaces from pages
      const response = await this.axiosInstance.get('/spaces', { params });
      console.log('Spaces response received:', {
        status: response.status,
        hasResults: !!response.data?.results,
        resultsLength: response.data?.results?.length,
        hasNextLink: !!response.data?._links?.next
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get spaces with v2 API:', {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data
      });
      
      // If spaces endpoint doesn't exist in v2, extract spaces from pages
      console.log('Attempting to extract spaces from pages...');
      try {
        const pagesResponse = await this.axiosInstance.get('/pages', { 
          params: { limit: 100 } 
        });
        
        // Extract unique spaces from pages
        const spacesMap = new Map<string, ConfluenceSpace>();
        
        if (pagesResponse.data?.results) {
          for (const page of pagesResponse.data.results) {
            if (page.space && !spacesMap.has(page.space.id)) {
              spacesMap.set(page.space.id, {
                id: page.space.id,
                key: page.space.key,
                name: page.space.name,
                type: 'global',
                status: 'current'
              } as ConfluenceSpace);
            }
          }
        }
        
        const uniqueSpaces = Array.from(spacesMap.values()).slice(0, limit);
        
        return {
          results: uniqueSpaces,
          size: uniqueSpaces.length,
          limit: limit,
          _links: uniqueSpaces.length >= limit ? { next: `/spaces?limit=${limit}&cursor=next` } : undefined
        };
      } catch (pagesError) {
        console.error('Failed to extract spaces from pages:', pagesError);
        throw error;
      }
    }
  }

  async getSpace(spaceKey: string, expand?: string[]): Promise<ConfluenceSpace> {
    const params: any = {};
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    try {
      const response = await this.axiosInstance.get(`/spaces/${spaceKey}`, { params });
      return response.data;
    } catch (error) {
      // Fallback: try to find space by getting pages and extracting space info
      console.warn(`Direct space lookup failed for ${spaceKey}, trying fallback...`);
      const pagesResponse = await this.axiosInstance.get('/pages', { 
        params: { limit: 10, 'space-key': spaceKey } 
      });
      
      if (pagesResponse.data?.results?.[0]?.space) {
        return pagesResponse.data.results[0].space;
      }
      
      throw error;
    }
  }

  async getContent(
    type?: string, // 'page', 'blogpost', 'comment'
    spaceKey?: string,
    limit: number = 25,
    cursor?: string,
    expand?: string[]
  ): Promise<{ results: ConfluencePage[]; size: number; limit: number; _links?: { next?: string } }> {
    // For v2 API, we need to use specific endpoints
    if (type === 'page') {
      return this.getPages(spaceKey, limit, cursor, expand);
    } else if (type === 'blogpost') {
      return this.getBlogPosts(spaceKey, limit, cursor, expand);
    }
    
    // Default to pages
    return this.getPages(spaceKey, limit, cursor, expand);
  }

  async getPages(
    spaceKey?: string,
    limit: number = 25,
    cursor?: string,
    expand?: string[]
  ): Promise<{ results: ConfluencePage[]; size: number; limit: number; _links?: { next?: string } }> {
    const params: any = {
      limit,
    };
    
    // v2 API uses cursor-based pagination instead of start-at
    if (cursor) {
      params.cursor = cursor;
    }
    
    if (spaceKey) {
      params['space-key'] = spaceKey;
    }
    
    if (expand?.length) {
      params.expand = expand.join(',');
    } else {
      // Default expansions that are commonly needed
      params.expand = 'space,version,body.storage,body.view';
    }

    const response = await this.axiosInstance.get('/pages', { params });
    return response.data;
  }

  async getBlogPosts(
    spaceKey?: string,
    limit: number = 25,
    cursor?: string,
    expand?: string[]
  ): Promise<{ results: ConfluencePage[]; size: number; limit: number; _links?: { next?: string } }> {
    const params: any = {
      limit,
    };
    
    // v2 API uses cursor-based pagination
    if (cursor) {
      params.cursor = cursor;
    }
    
    if (spaceKey) {
      params['space-key'] = spaceKey;
    }
    
    if (expand?.length) {
      params.expand = expand.join(',');
    } else {
      params.expand = 'space,version,body.storage,body.view';
    }

    const response = await this.axiosInstance.get('/blogposts', { params });
    return response.data;
  }

  async getContentById(
    contentId: string,
    expand?: string[]
  ): Promise<ConfluencePage> {
    const params: any = {};
    
    if (expand?.length) {
      params.expand = expand.join(',');
    } else {
      // Default expansions for complete content info
      params.expand = 'space,version,body.storage,body.view,ancestors,children.page';
    }

    const response = await this.axiosInstance.get(`/pages/${contentId}`, { params });
    return response.data;
  }

  async getContentChildren(
    contentId: string,
    type?: string, // 'page', 'comment', 'attachment'
    limit: number = 25,
    cursor?: string,
    expand?: string[]
  ): Promise<{ results: ConfluencePage[]; size: number; limit: number; _links?: { next?: string } }> {
    const params: any = {
      limit,
    };
    
    // v2 API uses cursor-based pagination
    if (cursor) {
      params.cursor = cursor;
    }
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    // v2 API endpoint for children
    const response = await this.axiosInstance.get(`/pages/${contentId}/children`, { params });
    return response.data;
  }

  async search(
    cql: string, // Confluence Query Language
    limit: number = 25,
    cursor?: string,
    expand?: string[]
  ): Promise<ConfluenceSearchResult> {
    const params: any = {
      cql,
      limit,
    };
    
    // v2 API uses cursor-based pagination
    if (cursor) {
      params.cursor = cursor;
    }
    
    if (expand?.length) {
      params.expand = expand.join(',');
    }

    // Try v2 search endpoint first
    try {
      const response = await this.axiosInstance.get('/content/search', { params });
      return response.data;
    } catch (error) {
      console.warn('v2 search failed, this might not be available yet:', error);
      // Return empty results instead of falling back to v1
      return {
        content: [],
        start: 0,
        limit: limit,
        size: 0,
        totalSize: 0,
        _links: {
          base: '',
          context: '',
          self: ''
        }
      };
    }
  }

  async getUsers(limit: number = 200, start: number = 0): Promise<ConfluenceUser[]> {
    // Confluence doesn't have a direct users endpoint like Jira
    // We'll need to extract users from content authors and contributors
    try {
      const spaces = await this.getSpaces(50);
      const userMap = new Map<string, ConfluenceUser>();

      for (const space of spaces.results) {
        try {
          const content = await this.getPages(space.key, 50, undefined, ['version']);
          for (const page of content.results) {
            if (page.version?.by) {
              const user = page.version.by;
              if (!userMap.has(user.accountId)) {
                userMap.set(user.accountId, {
                  accountId: user.accountId,
                  accountType: 'atlassian',
                  displayName: user.displayName,
                  publicName: user.displayName,
                  email: user.email,
                } as ConfluenceUser);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to get content for space ${space.key}:`, error);
        }
      }

      return Array.from(userMap.values()).slice(start, start + limit);
    } catch (error) {
      console.error('Failed to get users from Confluence:', error);
      return [];
    }
  }

  async getUserById(accountId: string): Promise<ConfluenceUser> {
    // Try to get user details via the user endpoint if available
    try {
      const response = await this.axiosInstance.get('/user', {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      // Fallback: search for user in content
      const cql = `contributor = "${accountId}"`;
      const searchResult = await this.search(cql, 1, undefined, ['version']);
      
      if (searchResult.content?.length > 0) {
        const content = searchResult.content[0];
        if (content.version?.by?.accountId === accountId) {
          return {
            accountId: content.version.by.accountId,
            accountType: 'atlassian',
            displayName: content.version.by.displayName,
            publicName: content.version.by.displayName,
            email: content.version.by.email,
          } as ConfluenceUser;
        }
      }
      
      throw new Error(`User with account ID ${accountId} not found`);
    }
  }

  // Bulk operations for sync - updated to use cursor-based pagination
  async getAllSpaces(): Promise<ConfluenceSpace[]> {
    const allSpaces: ConfluenceSpace[] = [];
    let cursor: string | undefined;
    const limit = 50;
    
    while (true) {
      try {
        const response = await this.getSpaces(limit, cursor, ['description', 'metadata']);
        allSpaces.push(...response.results);
        
        if (response.results.length < limit || !response._links?.next) {
          break;
        }
        
        // Extract cursor from next link as per documentation
        const nextUrl = response._links.next;
        const cursorMatch = nextUrl.match(/cursor=([^&]+)/);
        cursor = cursorMatch ? decodeURIComponent(cursorMatch[1]) : undefined;
        
        if (!cursor) {
          break;
        }
      } catch (error) {
        console.error('Failed to get spaces:', error);
        break;
      }
    }
    
    return allSpaces;
  }

  async getAllContent(spaceKey?: string, type: string = 'page'): Promise<ConfluencePage[]> {
    const allContent: ConfluencePage[] = [];
    let cursor: string | undefined;
    const limit = 50;
    
    while (true) {
      try {
        let response;
        
        if (type === 'page') {
          response = await this.getPages(spaceKey, limit, cursor, ['space', 'version', 'body.storage']);
        } else if (type === 'blogpost') {
          response = await this.getBlogPosts(spaceKey, limit, cursor, ['space', 'version', 'body.storage']);
        } else {
          // Default to pages
          response = await this.getPages(spaceKey, limit, cursor, ['space', 'version', 'body.storage']);
        }
        
        allContent.push(...response.results);
        
        if (response.results.length < limit || !response._links?.next) {
          break;
        }
        
        // Extract cursor from next link
        const nextUrl = response._links.next;
        const cursorMatch = nextUrl.match(/cursor=([^&]+)/);
        cursor = cursorMatch ? decodeURIComponent(cursorMatch[1]) : undefined;
        
        if (!cursor) {
          break;
        }
      } catch (error) {
        console.error(`Failed to get content for space ${spaceKey}:`, error);
        break;
      }
    }
    
    return allContent;
  }

  // Validate that we have the required scopes for v2 API
  public static validateScopes(grantedScopes: string): boolean {
    const scopeArray = grantedScopes.split(' ');
    
    // Check for essential v2 API granular scopes (what v2 endpoints actually require)
    const hasSpaceScope = scopeArray.includes('read:space:confluence');           // Required for /spaces
    const hasContentScope = scopeArray.includes('read:content:confluence');       // Required for /pages
    const hasUserScope = scopeArray.includes('read:user:confluence');             // Required for user info
    
    // Check for classic scopes (for backward compatibility)
    const hasClassicContent = scopeArray.includes('read:confluence-content.all');
    const hasClassicUser = scopeArray.includes('read:confluence-user');
    const hasClassicSpace = scopeArray.includes('read:confluence-space.summary');
    
    // Count additional granular scopes for enhanced functionality
    const additionalScopes = ConfluenceClient.REQUIRED_SCOPES.filter(scope => 
      scopeArray.includes(scope)
    );
    
    // v2 API requires the granular scopes, classic scopes are secondary
    const hasEssentialV2Scopes = hasSpaceScope && hasContentScope && hasUserScope;
    const hasClassicScopes = hasClassicContent && hasClassicUser && hasClassicSpace;
    
    console.log('v2 API scope validation:', {
      totalGrantedScopes: scopeArray.length,
      v2ApiScopes: {
        hasSpaceScope,
        hasContentScope, 
        hasUserScope,
        valid: hasEssentialV2Scopes
      },
      classicScopes: {
        hasClassicContent,
        hasClassicUser, 
        hasClassicSpace,
        valid: hasClassicScopes
      },
      additionalScopes: additionalScopes.length,
      overallValid: hasEssentialV2Scopes,
      grantedScopes: scopeArray
    });
    
    // Return true if we have the essential v2 API scopes
    return hasEssentialV2Scopes;
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Confluence connection with v2 API...');
      console.log('Base URL:', this.axiosInstance.defaults.baseURL);
      
      // Test the pages endpoint as shown in documentation: GET /wiki/api/v2/pages?limit=5
      console.log('Testing v2 API with /pages endpoint (as per documentation)...');
      const response = await this.axiosInstance.get('/pages', { 
        params: { limit: 5 } 
      });
      
      console.log('Confluence v2 API pages test successful:', {
        status: response.status,
        hasData: !!response.data,
        hasResults: !!response.data?.results,
        resultsCount: response.data?.results?.length || 0,
        responseStructure: Object.keys(response.data || {})
      });
      
      return true;
    } catch (error) {
      console.error('Confluence v2 API pages test failed:', {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data,
        url: (error as any).config?.url,
        fullUrl: (error as any).config?.baseURL + (error as any).config?.url
      });
      
      // Detailed error analysis for v2 API
      if ((error as any).response?.status === 401) {
        const errorData = (error as any).response?.data;
        if (errorData?.message?.includes('scope')) {
          console.error('❌ SCOPE MISMATCH ERROR: The OAuth token does not have the required scopes');
          console.error('🔧 SOLUTION: You need to reconnect with a fresh token that includes the updated scopes');
          console.error('📋 Expected scopes for comprehensive access:');
          console.error('   Classic scopes:', ConfluenceClient.REQUIRED_SCOPES.filter(s => s.includes('confluence-')).join(', '));
          console.error('   Granular scopes:', ConfluenceClient.REQUIRED_SCOPES.filter(s => s.includes(':confluence') && !s.includes('confluence-')).join(', '));
          console.error('');
          console.error('💡 Steps to fix:');
          console.error('   1. Run: node scripts/clear-confluence-connection.js');
          console.error('   2. Go to your app → Integrations → Connect Confluence');
          console.error('   3. Complete OAuth flow to get fresh token with all scopes');
        } else {
          console.error('❌ AUTHENTICATION ERROR: Token is invalid or expired');
          console.error('🔧 SOLUTION: Refresh the token or reconnect the integration');
        }
      } else if ((error as any).response?.status === 403) {
        console.error('❌ PERMISSION ERROR: Access forbidden - user lacks permissions');
        console.error('🔧 SOLUTION: Grant proper Confluence permissions to the user');
      } else if ((error as any).response?.status === 404) {
        console.error('❌ ENDPOINT NOT FOUND: The API endpoint does not exist');
        console.error('🔧 SOLUTION: Check the API endpoint URL and version');
      }
      
      return false;
    }
  }
} 