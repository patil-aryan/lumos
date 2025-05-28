'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

interface SlackWorkspaceData {
  id: string;
  teamId: string;
  teamName: string;
  teamDomain: string;
  teamUrl: string;
  isActive: boolean;
  createdAt: string;
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  stats: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
    totalReactions: number;
    totalFiles: number;
    totalThreads: number;
    dataSize: number;
  };
  recentSync?: {
    status: 'running' | 'completed' | 'failed';
    progress: number;
    currentOperation: string;
    startTime: string;
    messagesProcessed: number;
    errors: string[];
  };
  recentMessages?: Array<{
    id: string;
    text: string;
    user: string;
    channel: string;
    timestamp: string;
    reactions: number;
    messageId: string;
    channelId: string;
    userId: string;
    threadTs: string | null;
    replyCount: number;
    messageType: string;
  }>;
  channels?: Array<{
    id: string;
    channelId: string;
    name: string;
    memberCount: number;
    messageCount: number;
    lastActivity: string;
    isPrivate: boolean;
    isArchived: boolean;
    topic: string | null;
    purpose: string | null;
  }>;
  users?: Array<{
    id: string;
    userId: string;
    realName: string;
    displayName: string;
    email: string;
    isActive: boolean;
    messageCount: number;
    title: string | null;
    timezone: string | null;
    isBot: boolean;
    isAdmin: boolean;
    lastActive: string | null;
  }>;
}

export default function SlackIntegrationPage() {
  const router = useRouter();
  const [slackData, setSlackData] = useState<SlackWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [downloadDateRange, setDownloadDateRange] = useState<DateRange | undefined>();
  const [ingestDateRange, setIngestDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    fetchSlackData();
  }, []);

  const fetchSlackData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/slack/comprehensive-data');
      if (response.ok) {
        const data = await response.json();
        setSlackData(data);
      } else if (response.status === 404) {
        setSlackData(null);
      } else {
        toast.error('Failed to load Slack data');
      }
    } catch (error) {
      console.error('Error fetching Slack data:', error);
      toast.error('Error loading Slack data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!slackData) return;
    try {
      setSyncing(true);
      const response = await fetch('/api/slack/comprehensive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: slackData.id }),
      });
      if (response.ok) {
        toast.success('Comprehensive sync started');
        setTimeout(() => {
          fetchSlackData();
        }, 2000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to start sync');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      toast.error('Error starting sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleDownload = async () => {
    if (!slackData || !downloadDateRange?.from) {
      toast.error('Please select a date range');
      return;
    }
    try {
      setDownloading(true);
      const params = new URLSearchParams({
        workspaceId: slackData.id,
        startDate: downloadDateRange.from.toISOString(),
        endDate: (downloadDateRange.to || downloadDateRange.from).toISOString(),
      });
      
      const response = await fetch(`/api/slack/download?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slack-complete-export-${slackData.teamName}-${downloadDateRange.from.toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Complete data export downloaded successfully');
      } else {
        toast.error('Failed to download data');
      }
    } catch (error) {
      console.error('Error downloading data:', error);
      toast.error('Error downloading data');
    } finally {
      setDownloading(false);
    }
  };

  const handleIngest = async () => {
    if (!slackData || !ingestDateRange?.from) {
      toast.error('Please select a date range');
      return;
    }
    try {
      setIngesting(true);
      const response = await fetch('/api/slack/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId: slackData.id,
          startDate: ingestDateRange.from.toISOString(),
          endDate: (ingestDateRange.to || ingestDateRange.from).toISOString(),
        }),
      });
      if (response.ok) {
        toast.success('Database ingest completed successfully');
        setTimeout(() => {
          fetchSlackData();
        }, 2000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to ingest data');
      }
    } catch (error) {
      console.error('Error ingesting data:', error);
      toast.error('Error ingesting data');
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteData = async () => {
    if (!slackData || !confirm('Are you sure you want to delete all Slack data? This action cannot be undone.')) {
      return;
    }
    try {
      setDeleting(true);
      const response = await fetch('/api/slack/delete-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: slackData.id }),
      });
      if (response.ok) {
        toast.success('All Slack data deleted');
        fetchSlackData();
      } else {
        toast.error('Failed to delete Slack data');
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Error deleting data');
    } finally {
      setDeleting(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!slackData) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">SLACK</span>
            </div>
            <CardTitle className="text-xl">No Slack Workspace Connected</CardTitle>
            <CardDescription className="text-base">
              Connect your Slack workspace to start analyzing team communication and extracting valuable insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button onClick={() => router.push('/integrations')} variant="outline" className="w-full">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Integrations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/integrations')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{slackData.teamName}</h1>
            <p className="text-muted-foreground mt-1">
              {slackData.teamDomain} • Connected workspace
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant={slackData.isActive ? "default" : "secondary"} className="px-3 py-1">
            {slackData.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button 
            onClick={handleSync} 
            disabled={syncing} 
            size="sm"
            className="min-w-[80px]"
          >
            {syncing ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold">{formatNumber(slackData.stats.totalMessages)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold">{formatNumber(slackData.stats.totalUsers)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Channels</p>
                <p className="text-2xl font-bold">{formatNumber(slackData.stats.totalChannels)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Files Shared</p>
                <p className="text-2xl font-bold">{formatNumber(slackData.stats.totalFiles)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="users">Team</TabsTrigger>
          <TabsTrigger value="export">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleSync}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">Action</Badge>
                </div>
                <h3 className="font-semibold mb-2">Full Workspace Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Synchronize all workspace data including messages, files, and user information
                </p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('export')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">Export</Badge>
                </div>
                <h3 className="font-semibold mb-2">Export Complete Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download comprehensive data including DMs, threads, reactions, and files
                </p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('export')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">Process</Badge>
                </div>
                <h3 className="font-semibold mb-2">Database Ingest</h3>
                <p className="text-sm text-muted-foreground">
                  Process and optimize data for improved performance and analysis
                </p>
              </CardContent>
            </Card>
          </div>

          {slackData.lastSyncAt && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Last Sync</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatTime(slackData.lastSyncAt)}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Recent Messages
              </CardTitle>
              <CardDescription>
                Latest activity across your workspace • Including DMs and threads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slackData.recentMessages && slackData.recentMessages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="max-w-md">Message</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slackData.recentMessages.slice(0, 15).map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-medium">
                          {message.user || 'Unknown User'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {message.channel?.startsWith('D') ? (
                              <Badge variant="secondary" className="text-xs">DM</Badge>
                            ) : (
                              <span className="text-sm">#{message.channel || 'unknown'}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="space-y-1">
                            <p className="text-sm">{truncateText(message.text || '', 100)}</p>
                            {message.threadTs && message.threadTs !== message.messageId && (
                              <Badge variant="outline" className="text-xs">Thread Reply</Badge>
                            )}
                            {message.reactions > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {message.reactions} reactions
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {message.messageType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent messages found</p>
                  <p className="text-sm">Try syncing your workspace data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Workspace Channels
              </CardTitle>
              <CardDescription>
                All channels including private channels and direct messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slackData.channels && slackData.channels.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slackData.channels.slice(0, 20).map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {channel.name?.startsWith('D') ? (
                              <>
                                <span className="text-sm">Direct Message</span>
                              </>
                            ) : (
                              <>
                                <span>{channel.name}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {channel.isPrivate && (
                              <Badge variant="secondary" className="text-xs">Private</Badge>
                            )}
                            {channel.isArchived && (
                              <Badge variant="outline" className="text-xs">Archived</Badge>
                            )}
                            {!channel.isPrivate && !channel.isArchived && (
                              <Badge variant="default" className="text-xs">Public</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(channel.memberCount)}</TableCell>
                        <TableCell>{formatNumber(channel.messageCount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(channel.lastActivity)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {truncateText(channel.purpose || channel.topic || '', 50)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No channels found</p>
                  <p className="text-sm">Try syncing your workspace data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Team Members
              </CardTitle>
              <CardDescription>
                All workspace members including admins and bots
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slackData.users && slackData.users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slackData.users.slice(0, 25).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.realName}</div>
                            <div className="text-sm text-muted-foreground">@{user.displayName}</div>
                            {user.title && (
                              <div className="text-xs text-muted-foreground">{user.title}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.email || 'No email'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.isBot && (
                              <Badge variant="outline" className="text-xs">Bot</Badge>
                            )}
                            {user.isAdmin && (
                              <Badge variant="destructive" className="text-xs">Admin</Badge>
                            )}
                            {!user.isBot && !user.isAdmin && (
                              <Badge variant="secondary" className="text-xs">Member</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(user.messageCount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lastActive ? formatDate(user.lastActive) : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No team members found</p>
                  <p className="text-sm">Try syncing your workspace data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Export Complete Data
                </CardTitle>
                <CardDescription>
                  Download comprehensive workspace data including all messages, DMs, threads, reactions, and files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="download-range">Date Range</Label>
                  <DatePickerWithRange
                    date={downloadDateRange}
                    onDateChange={setDownloadDateRange}
                  />
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-medium">Export includes:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>All messages & threads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Direct messages</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Reactions & emojis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>File metadata</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Channel data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>User profiles</span>
                    </div>
                  </div>
                </div>
                        
                <Button
                  onClick={handleDownload} 
                  disabled={downloading || !downloadDateRange?.from}
                  className="w-full"
                >
                  {downloading ? "Exporting..." : "Export Complete Data"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Database Ingest
                </CardTitle>
                <CardDescription>
                  Process and optimize workspace data for improved performance and analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ingest-range">Date Range</Label>
                  <DatePickerWithRange
                    date={ingestDateRange}
                    onDateChange={setIngestDateRange}
                  />
                </div>
                
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <p className="text-sm font-medium">Processing includes:</p>
                  <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Optimize database indexes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Analyze conversation patterns</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Process thread relationships</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Update workspace statistics</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleIngest} 
                  disabled={ingesting || !ingestDateRange?.from}
                  className="w-full"
                  variant="secondary"
                >
                  {ingesting ? "Processing..." : "Start Database Ingest"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Workspace Settings
              </CardTitle>
              <CardDescription>
                Manage your connected Slack workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Team Name</Label>
                  <Input value={slackData.teamName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Team Domain</Label>
                  <Input value={slackData.teamDomain} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Team ID</Label>
                  <Input value={slackData.teamId} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Workspace ID</Label>
                  <Input value={slackData.id} disabled />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <h4 className="font-medium">Danger Zone</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all synced Slack data from the database. This action cannot be undone.
                </p>
                <Button 
                  onClick={handleDeleteData} 
                  variant="destructive"
                  disabled={deleting}
                  className="w-full md:w-auto"
                >
                  {deleting ? "Deleting..." : "Delete All Data"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 