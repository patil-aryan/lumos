'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  fallbackColor: string;
  connected: boolean;
  connectedUser?: string;
  workspaceData?: any; // For Slack workspace info
}

interface SlackWorkspace {
  id: string;
  teamId: string;
  teamName: string;
  isActive: boolean;
  createdAt: string;
  lastSyncAt: string | null;
  syncStartDate: string | null;
  stats: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    totalFiles: number;
  };
  hasData: boolean;
  syncStatus: 'recent' | 'stale' | 'never';
}

interface SlackData {
  success: boolean;
  workspaces: SlackWorkspace[];
  totalWorkspaces: number;
}

const baseIntegrations: Omit<Integration, 'connected' | 'connectedUser' | 'workspaceData'>[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect your Slack workspace to sync messages, channels, and team communications.',
    logoUrl: 'https://cdnlogo.com/logos/s/21/slack.svg',
    fallbackColor: '#4A154B',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync project management data, issues, and workflows from your Jira workspace.',
    logoUrl: 'https://cdnlogo.com/logos/j/69/jira.svg',
    fallbackColor: '#0052CC',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Import documentation, pages, and knowledge base content from Confluence.',
    logoUrl: 'https://cdnlogo.com/logos/c/82/confluence.svg',
    fallbackColor: '#0052CC',
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(
    baseIntegrations.map(base => ({ ...base, connected: false }))
  );
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Fetch Slack connection status
  const fetchSlackData = async () => {
    try {
      const response = await fetch('/api/slack/data');
      if (response.ok) {
        const data: SlackData = await response.json();
        
        console.log('Slack data fetched:', data); // Debug log
        
        // Update Slack integration status
        setIntegrations(prev => prev.map(integration => {
          if (integration.id === 'slack') {
            const isConnected = data.workspaces.length > 0;
            console.log('Updating Slack integration:', { isConnected, workspaces: data.workspaces.length }); // Debug log
            return {
              ...integration,
              connected: isConnected,
              connectedUser: data.workspaces[0]?.teamName || undefined,
              workspaceData: data
            };
          }
          return integration;
        }));
      } else {
        console.error('Failed to fetch Slack data:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching Slack data:', error);
    }
  };

  // Fetch Jira connection status
  const fetchJiraData = async () => {
    try {
      const response = await fetch('/api/jira/data');
      if (response.ok) {
        const result = await response.json();
        
        console.log('Jira data fetched:', result); // Debug log
        
        // Update Jira integration status - handle both success and error cases
        setIntegrations(prev => prev.map(integration => {
          if (integration.id === 'jira') {
            const isConnected = result.success && result.data?.workspace;
            console.log('Updating Jira integration:', { isConnected, workspace: result.data?.workspace }); // Debug log
            return {
              ...integration,
              connected: isConnected,
              connectedUser: result.data?.workspace?.name || undefined,
              workspaceData: result.data || null
            };
          }
          return integration;
        }));
      } else {
        console.error('Failed to fetch Jira data:', response.status, response.statusText);
        // Handle error responses
        const errorData = await response.json().catch(() => ({ success: false, error: 'Unknown error' }));
        console.log('Jira error response:', errorData);
        
        // Update integration to show disconnected state
        setIntegrations(prev => prev.map(integration => {
          if (integration.id === 'jira') {
            return {
              ...integration,
              connected: false,
              connectedUser: undefined,
              workspaceData: null
            };
          }
          return integration;
        }));
      }
    } catch (error) {
      console.error('Error fetching Jira data:', error);
      // Handle network/other errors
      setIntegrations(prev => prev.map(integration => {
        if (integration.id === 'jira') {
          return {
            ...integration,
            connected: false,
            connectedUser: undefined,
            workspaceData: null
          };
        }
        return integration;
      }));
    }
  };

  const handleConnect = async (integrationId: string) => {
    if (integrationId === 'slack') {
      await handleSlackConnect();
    } else if (integrationId === 'jira') {
      await handleJiraConnect();
    } else {
      // For Confluence - show coming soon
      toast.info(`${integrationId.charAt(0).toUpperCase() + integrationId.slice(1)} integration coming soon!`);
    }
  };

  const handleSlackConnect = async () => {
    try {
      setConnectingId('slack');
      
      // Call the OAuth endpoint to get auth URL
      const response = await fetch('/api/slack/oauth', {
        method: 'POST',
      });

      if (response.ok) {
        const { authUrl } = await response.json();
        // Redirect to Slack OAuth
        window.location.href = authUrl;
      } else {
        throw new Error('Failed to initiate Slack OAuth');
      }
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      toast.error('Failed to connect to Slack');
      setConnectingId(null);
    }
  };

  const handleJiraConnect = async () => {
    try {
      setConnectingId('jira');
      
      // Redirect directly to Jira OAuth endpoint
      window.location.href = '/api/jira/connect';
    } catch (error) {
      console.error('Error connecting to Jira:', error);
      toast.error('Failed to connect to Jira');
      setConnectingId(null);
    }
  };

  const handleDisconnect = (integrationId: string) => {
    if (integrationId === 'slack') {
      // TODO: Implement Slack disconnect logic
      toast.info('Disconnect feature coming soon');
    }
  };

  const handleDetails = (integrationId: string) => {
    if (integrationId === 'slack') {
      const slackIntegration = integrations.find(i => i.id === 'slack');
      console.log('Slack integration details:', slackIntegration); // Debug log
      
      if (slackIntegration?.connected) {
        // Navigate to the existing integrations details page
        router.push('/integrations/slack');
      } else {
        toast.info('Connect Slack first to view details');
      }
    } else if (integrationId === 'jira') {
      const jiraIntegration = integrations.find(i => i.id === 'jira');
      console.log('Jira integration details:', jiraIntegration); // Debug log
      
      if (jiraIntegration?.connected) {
        // Navigate to the Jira details page
        router.push('/integrations/jira');
      } else {
        toast.info('Connect Jira first to view details');
      }
    } else {
      toast.info(`${integrationId.charAt(0).toUpperCase() + integrationId.slice(1)} details coming soon!`);
    }
  };

  const handleLogoError = (integrationId: string) => {
    setLogoErrors(prev => new Set(prev).add(integrationId));
  };

  useEffect(() => {
    // Check for OAuth success/error
    const success = searchParams?.get('success');
    const error = searchParams?.get('error');
    
    if (success === 'slack_connected') {
      toast.success('Slack workspace connected successfully!');
      // Remove the success parameter from URL
      window.history.replaceState({}, '', '/integrations');
      // Refresh data
      fetchSlackData();
    } else if (success === 'jira_connected') {
      toast.success('Jira workspace connected successfully!');
      // Remove the success parameter from URL
      window.history.replaceState({}, '', '/integrations');
      // Refresh data
      fetchJiraData();
    } else if (error) {
      toast.error(`Connection failed: ${error}`);
      // Remove the error parameter from URL
      window.history.replaceState({}, '', '/integrations');
    }
    
    // Initial data fetch
    Promise.all([
      fetchSlackData(),
      fetchJiraData()
    ]).finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Integrations
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect your tools and streamline your workflow
          </p>
        </motion.div>

        {/* Integration Cards */}
        <div className="grid gap-6">
          {integrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="group relative overflow-hidden border-0 bg-white dark:bg-slate-900/50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-[1.02]">
                {/* Subtle gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 via-transparent to-slate-100/30 dark:from-slate-800/20 dark:via-transparent dark:to-slate-700/10 pointer-events-none" />
                
                <CardHeader className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Logo with premium styling */}
                      <div className="relative integration-logo">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 shadow-lg flex items-center justify-center border border-slate-200/50 dark:border-slate-600/50">
                          {!logoErrors.has(integration.id) ? (
                            <img 
                              src={integration.logoUrl} 
                              alt={`${integration.name} logo`}
                              className="w-8 h-8 object-contain"
                              onError={() => handleLogoError(integration.id)}
                            />
                          ) : (
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: integration.fallbackColor }}
                            >
                              {integration.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        
                        {/* Connection status indicator */}
                        {integration.connected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                            <div className="w-full h-full bg-green-400 rounded-full status-connected" />
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                            {integration.name}
                          </CardTitle>
                          {integration.connected && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 px-2 py-1 text-xs">
                              Connected
                            </Badge>
                          )}
                          {integration.id === 'confluence' && (
                            <Badge variant="outline" className="px-2 py-1 text-xs">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg text-sm">
                          {integration.description}
                        </CardDescription>
                        {integration.connected && integration.connectedUser && (
                          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                            Connected as {integration.connectedUser}
                            {integration.id === 'slack' && integration.workspaceData && (
                              <span className="ml-2">
                                • {integration.workspaceData.totalWorkspaces} workspace{integration.workspaceData.totalWorkspaces !== 1 ? 's' : ''}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDetails(integration.id)}
                        className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 px-4"
                        disabled={!integration.connected && (integration.id === 'slack' || integration.id === 'jira')}
                      >
                        Details
                      </Button>
                      
                      {integration.connected ? (
                        <div className="flex items-center gap-2">
                          {/* Show Reconnect button for Jira if there are connection issues */}
                          {integration.id === 'jira' && (
                            <Button
                              size="sm"
                              onClick={() => handleConnect(integration.id)}
                              disabled={connectingId === integration.id}
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4"
                            >
                              {connectingId === integration.id ? 'Reconnecting...' : 'Reconnect'}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                            className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 px-4"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(integration.id)}
                          disabled={connectingId === integration.id || loading}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 px-4 min-w-[80px]"
                        >
                          {connectingId === integration.id ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span className="text-sm">Connecting...</span>
                            </div>
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 p-6 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-slate-900 dark:text-white">Need help getting started?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Each integration requires proper permissions and setup. Check our documentation for detailed setup guides.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 