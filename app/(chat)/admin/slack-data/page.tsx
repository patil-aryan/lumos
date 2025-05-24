'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SlackData {
  message: string;
  workspace: {
    id: string;
    teamName: string;
    teamId: string;
    isActive: boolean;
    createdAt: string;
  };
  stats: {
    totalWorkspaces: number;
    totalMessages: number;
    totalFiles: number;
  };
  recentMessages: Array<{
    id: string;
    text: string;
    userName: string;
    channelName: string;
    timestamp: string;
    messageType: string;
    hasFiles: boolean;
  }>;
  recentFiles: Array<{
    id: string;
    name: string;
    title: string;
    filetype: string;
    size: string;
    userName: string;
    hasContent: boolean;
    contentPreview: string;
  }>;
  availableWorkspaces: Array<{
    id: string;
    teamName: string;
    teamId: string;
  }>;
}

export default function SlackDataPage() {
  const [data, setData] = useState<SlackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/slack/data');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setError(null);
      } else {
        const errorText = await response.text();
        setError(`Failed to load data: ${errorText}`);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Loading Slack data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Slack Data Overview</h1>
          <p className="text-muted-foreground">View retrieved Slack messages and files</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-blue-600">{data.stats.totalWorkspaces}</div>
            <p className="text-sm text-muted-foreground">Workspaces</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-600">{data.stats.totalMessages}</div>
            <p className="text-sm text-muted-foreground">Messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-purple-600">{data.stats.totalFiles}</div>
            <p className="text-sm text-muted-foreground">Files</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">
              {data.workspace.isActive ? 'Active' : 'Inactive'}
            </div>
            <p className="text-sm text-muted-foreground">Status</p>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Team Name:</strong> {data.workspace.teamName}</p>
              <p><strong>Team ID:</strong> {data.workspace.teamId}</p>
            </div>
            <div>
              <p><strong>Connected:</strong> {new Date(data.workspace.createdAt).toLocaleString()}</p>
              <p><strong>Status:</strong> 
                <Badge variant={data.workspace.isActive ? 'default' : 'secondary'} className="ml-2">
                  {data.workspace.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages ({data.recentMessages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentMessages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No messages found. Try syncing data from the integrations page.
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentMessages.map((message, index) => (
                  <div key={message.id} className="border-l-2 border-blue-200 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{message.channelName}</Badge>
                      <span className="text-sm font-medium">{message.userName}</span>
                      {message.hasFiles && <Badge variant="secondary" className="text-xs">📎 Files</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {message.text || '<No text content>'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(parseInt(message.timestamp) * 1000).toLocaleString()}
                    </p>
                    {index < data.recentMessages.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Files */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Files ({data.recentFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentFiles.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No files found. Try syncing data from the integrations page.
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentFiles.map((file, index) => (
                  <div key={file.id} className="border-l-2 border-purple-200 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{file.filetype}</Badge>
                      <span className="text-sm font-medium">{file.name}</span>
                    </div>
                    {file.title && (
                      <p className="text-sm font-medium mb-1">{file.title}</p>
                    )}
                    {file.contentPreview && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {file.contentPreview}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>By {file.userName}</span>
                      {file.size && <span>• {file.size} bytes</span>}
                      {file.hasContent && <Badge variant="secondary" className="text-xs">✓ Extracted</Badge>}
                    </div>
                    {index < data.recentFiles.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available Workspaces */}
      {data.availableWorkspaces.length > 1 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>All Connected Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.availableWorkspaces.map((workspace) => (
                <div key={workspace.id} className="p-4 border rounded-lg">
                  <h4 className="font-medium">{workspace.teamName}</h4>
                  <p className="text-sm text-muted-foreground">{workspace.teamId}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.location.href = `/admin/slack-data?workspaceId=${workspace.id}`}
                  >
                    View Data
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 