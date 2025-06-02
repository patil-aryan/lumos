import { JiraClient } from './client';
import { jiraWorkspace } from '@/lib/db/schema-jira';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export interface RefreshResult {
  success: boolean;
  client?: JiraClient;
  error?: string;
  needsReauth?: boolean;
}

export class JiraTokenManager {
  static async refreshTokenIfNeeded(
    workspaceId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date | null,
    cloudId: string
  ): Promise<RefreshResult> {
    try {
      // Check if token is expired or will expire in the next 5 minutes
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      console.log('Token status check:', {
        workspaceId,
        cloudId,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresAt,
        isExpired: expiresAt ? expiresAt <= now : 'unknown',
        expiringSoon: expiresAt ? expiresAt <= fiveMinutesFromNow : 'unknown'
      });
      
      if (!accessToken) {
        return { 
          success: false, 
          error: 'No access token available',
          needsReauth: true
        };
      }

      if (!refreshToken) {
        return { 
          success: false, 
          error: 'No refresh token available for token refresh',
          needsReauth: true
        };
      }
      
      if (expiresAt && expiresAt <= fiveMinutesFromNow) {
        console.log('Access token expired or expiring soon, refreshing...');
        
        // Refresh the token
        const tokenResponse = await JiraClient.refreshAccessToken(refreshToken);
        
        // Calculate new expiration
        const newExpiresAt = tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null;

        // Update the workspace with new tokens
        await db
          .update(jiraWorkspace)
          .set({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: newExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(jiraWorkspace.id, workspaceId));

        console.log('Token refreshed successfully', {
          newExpiresAt,
          hasNewRefreshToken: !!tokenResponse.refresh_token
        });
        
        // Return new client with updated token
        const client = new JiraClient(tokenResponse.access_token, cloudId);
        return { success: true, client };
      }
      
      // Token is still valid, return client with existing token
      const client = new JiraClient(accessToken, cloudId);
      return { success: true, client };
      
    } catch (error) {
      console.error('Error refreshing Jira token:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId,
        cloudId
      });

      // Check if this is a scope mismatch error
      const errorMessage = error instanceof Error ? error.message : '';
      const needsReauth = errorMessage.includes('scope') || errorMessage.includes('unauthorized') || errorMessage.includes('401');

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        needsReauth
      };
    }
  }

  static async handleTokenRefresh(
    workspaceData: any,
    retryOperation: (client: JiraClient) => Promise<any>
  ): Promise<any> {
    console.log('Handling token refresh for operation...');
    
    if (!workspaceData) {
      throw new Error('No workspace data provided');
    }

    if (!workspaceData.accessToken) {
      throw new Error('No access token in workspace data');
    }

    const refreshResult = await this.refreshTokenIfNeeded(
      workspaceData.id,
      workspaceData.accessToken,
      workspaceData.refreshToken,
      workspaceData.expiresAt,
      workspaceData.cloudId
    );

    if (!refreshResult.success || !refreshResult.client) {
      if (refreshResult.needsReauth) {
        throw new Error(`Re-authentication required: ${refreshResult.error}. Please reconnect to Jira with updated scopes.`);
      }
      throw new Error(`Token refresh failed: ${refreshResult.error}`);
    }

    try {
      // Try the operation with the (possibly refreshed) token
      console.log('Attempting operation with token...');
      return await retryOperation(refreshResult.client);
    } catch (error: any) {
      console.error('Operation failed, checking if 401:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        responseData: error.response?.data
      });

      // Check for scope mismatch error
      const isScopeMismatch = error.response?.data?.message?.includes('scope does not match') || 
                             error.response?.data?.message?.includes('scope') ||
                             (error.response?.status === 401 && error.response?.data?.message?.includes('Unauthorized'));

      if (isScopeMismatch) {
        console.error('Scope mismatch detected - re-authentication required');
        throw new Error('Scope mismatch: Your Jira token was granted with different permissions. Please reconnect to Jira to update your authentication scopes.');
      }

      if (error.response?.status === 401 && workspaceData.refreshToken) {
        console.log('Got 401, attempting forced token refresh and retry...');
        
        // Force refresh token
        try {
          const tokenResponse = await JiraClient.refreshAccessToken(workspaceData.refreshToken);
          
          if (!tokenResponse.access_token) {
            throw new Error('No access token received from forced refresh');
          }
          
          const newExpiresAt = tokenResponse.expires_in 
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null;

          // Update workspace with new tokens
          await db
            .update(jiraWorkspace)
            .set({
              accessToken: tokenResponse.access_token,
              refreshToken: tokenResponse.refresh_token,
              expiresAt: newExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(jiraWorkspace.id, workspaceData.id));

          console.log('Forced token refresh successful, retrying operation...');

          // Create new client and retry
          const newClient = new JiraClient(tokenResponse.access_token, workspaceData.cloudId);
          return await retryOperation(newClient);
          
        } catch (refreshError: any) {
          console.error('Forced token refresh after 401 failed:', {
            error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
            originalError: error.message
          });

          // Check if refresh error is also scope related
          const refreshErrorMessage = refreshError instanceof Error ? refreshError.message : '';
          if (refreshErrorMessage.includes('401') || refreshErrorMessage.includes('Unauthorized')) {
            throw new Error('Re-authentication required: Token refresh failed due to scope mismatch. Please reconnect to Jira.');
          }

          throw new Error(`Authentication failed. Token refresh unsuccessful: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
        }
      }
      
      // Re-throw original error if not 401 or no refresh token
      throw error;
    }
  }
} 