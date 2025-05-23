'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

// Simple icon components to avoid import issues
const SpinnerIcon = () => (
  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
);

const CheckIcon = () => (
  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

// Typing for integration items
interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  tags: string[];
  workspaces?: SlackWorkspace[];
}

interface SlackWorkspace {
  id: string;
  teamName: string;
  lastSyncAt: string | null;
  hasData: boolean;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{[key: string]: number}>({});
  const [slackWorkspaces, setSlackWorkspaces] = useState<SlackWorkspace[]>([]);

  // Load Slack workspaces on mount
  useEffect(() => {
    loadSlackWorkspaces();
  }, []);

  const loadSlackWorkspaces = async () => {
    try {
      const response = await fetch('/api/slack/sync');
      if (response.ok) {
        const workspaces = await response.json();
        setSlackWorkspaces(workspaces);
      }
    } catch (error) {
      console.error('Error loading Slack workspaces:', error);
    }
  };

  // Sample integration data
  const integrations: IntegrationItem[] = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Connect Slack to extract messages, files, and conversations for better context.',
      icon: '/slack-icon.svg',
      connected: slackWorkspaces.length > 0,
      tags: ['Collaboration', 'Messaging'],
      workspaces: slackWorkspaces,
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Connect to Jira to fetch issues, track progress, and stay updated on project status.',
      icon: '/jira-icon.svg',
      connected: false,
      tags: ['Project Management', 'Issue Tracking']
    },
    {
      id: 'confluence',
      name: 'Confluence',
      description: 'Automatically access documentation, specs, and meeting notes from Confluence.',
      icon: '/confluence-icon.svg',
      connected: false,
      tags: ['Documentation', 'Knowledge Base']
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Auto-joins Zoom meetings to record audio, write notes, capture slides.',
      icon: '/zoom-icon.svg',
      connected: false,
      tags: ['Video Conferencing', 'Meetings']
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Jelly automatically pushes transcripts and meeting summaries to Notion.',
      icon: '/notion-icon.svg',
      connected: false,
      tags: ['Collaboration', 'Project Management', 'Notes']
    }
  ];

  const handleSlackConnect = async () => {
    setLoading('slack-connect');
    try {
      const response = await fetch('/api/slack/oauth', {
        method: 'POST',
      });

      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      } else {
        throw new Error('Failed to initialize OAuth');
      }
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Slack. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSlackSync = async (workspaceId: string) => {
    setLoading(`slack-sync-${workspaceId}`);
    setSyncProgress(prev => ({ ...prev, [workspaceId]: 0 }));

    try {
      const response = await fetch('/api/slack/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sync Completed',
          description: `Synced ${result.progress.processedMessages} messages and ${result.progress.processedFiles} files.`,
        });
        loadSlackWorkspaces(); // Reload to show updated data
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing Slack data:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync Slack data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
      setSyncProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[workspaceId];
        return newProgress;
      });
    }
  };

  const handleConnect = async (id: string) => {
    if (id === 'slack') {
      await handleSlackConnect();
      return;
    }
    
    console.log(`Connecting to ${id}`);
    toast({
      title: 'Coming Soon',
      description: `${id} integration is not yet available.`,
    });
  };

  const handleDisconnect = (id: string) => {
    console.log(`Disconnecting from ${id}`);
    toast({
      title: 'Coming Soon',
      description: 'Disconnect functionality is not yet implemented.',
    });
  };

  const renderSlackWorkspaces = (workspaces: SlackWorkspace[]) => {
    if (!workspaces || workspaces.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Connected Workspaces:</h4>
        {workspaces.map((workspace) => (
          <div key={workspace.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckIcon />
                <span className="font-medium">{workspace.teamName}</span>
              </div>
              {workspace.hasData && (
                <Badge variant="secondary" className="text-xs">
                  Data Synced
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSlackSync(workspace.id)}
              disabled={loading === `slack-sync-${workspace.id}`}
            >
              {loading === `slack-sync-${workspace.id}` ? (
                <>
                  <SpinnerIcon />
                  Syncing...
                </>
              ) : (
                'Sync Data'
              )}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-2">All Integrations</h1>
        <p className="text-muted-foreground mb-8">
          Connect Lumos to your tools to help it understand your product context.
        </p>
      </motion.div>

      <div className="grid gap-6">
        {integrations.map((integration, index) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden border border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center bg-muted">
                      <img 
                        src={integration.icon} 
                        alt={integration.name} 
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          // Fallback for missing icons
                          (e.target as HTMLImageElement).src = '/app-icon.svg';
                        }}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{integration.name}</CardTitle>
                      <CardDescription className="mt-1">{integration.description}</CardDescription>
                    </div>
                  </div>

                  <div>
                    {integration.connected ? (
                      integration.id === 'slack' ? (
                        <Button 
                          size="sm"
                          onClick={() => handleSlackConnect()}
                          disabled={loading === 'slack-connect'}
                        >
                          {loading === 'slack-connect' ? (
                            <>
                              <SpinnerIcon />
                              Connecting...
                            </>
                          ) : (
                            'Add Workspace'
                          )}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      )
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={loading === `${integration.id}-connect`}
                        className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70"
                      >
                        {loading === `${integration.id}-connect` ? (
                          <>
                            <SpinnerIcon />
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {integration.id === 'slack' && integration.workspaces && (
                <CardContent className="pt-0">
                  {renderSlackWorkspaces(integration.workspaces)}
                </CardContent>
              )}

              <CardFooter className="pt-0 pb-4 flex gap-2">
                {integration.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs font-normal">
                    {tag}
                  </Badge>
                ))}
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
} 