'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft
} from 'lucide-react';

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
  users?: Array<{
    id: string;
    username: string;
    realName: string;
    displayName: string;
    email: string;
    profileImage: string;
    isBot: boolean;
    isAdmin: boolean;
    status: string;
  }>;
  channels?: Array<{
    id: string;
    name: string;
    purpose: string;
    topic: string;
    isPrivate: boolean;
    isArchived: boolean;
    memberCount: number;
  }>;
}

interface SlackData {
  success: boolean;
  workspaces: SlackWorkspace[];
  totalWorkspaces: number;
}

export default function SlackDetailsPage() {
  const [slackData, setSlackData] = useState<SlackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingWorkspaces, setSyncingWorkspaces] = useState<Set<string>>(new Set());
  const router = useRouter();

  const fetchSlackData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/slack/data');
      if (response.ok) {
        const data = await response.json();
        setSlackData(data);
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching Slack data:', error);
      toast.error('Failed to load Slack data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (workspaceId: string, historical: boolean = false, unlimited: boolean = false) => {
    try {
      setSyncingWorkspaces(prev => new Set(prev).add(workspaceId));
      
      const response = await fetch('/api/slack/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sync', 
          workspaceId,
          historical,
          unlimited
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || (unlimited ? 
          'Unlimited sync started - getting ALL messages (this may take 10+ minutes)' :
          historical ? 
          'Historical sync started in background (this may take several minutes)' : 
          'Sync started in background'));
        
        // Refresh data after a short delay
        setTimeout(() => {
          fetchSlackData();
        }, 2000);
      } else {
        throw new Error('Failed to start sync');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      toast.error('Failed to start sync');
    } finally {
      setSyncingWorkspaces(prev => {
        const newSet = new Set(prev);
        newSet.delete(workspaceId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getSyncStatusInfo = (status: string) => {
    switch (status) {
      case 'recent':
        return { icon: 'div', color: 'text-green-600', label: 'Recently synced' };
      case 'stale':
        return { icon: 'div', color: 'text-yellow-600', label: 'Needs sync' };
      case 'never':
        return { icon: 'div', color: 'text-red-600', label: 'Never synced' };
      default:
        return { icon: 'div', color: 'text-gray-600', label: 'Unknown' };
    }
  };

  useEffect(() => {
    fetchSlackData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
          Loading Slack details...
        </div>
      </div>
    );
  }

  if (!slackData || slackData.workspaces.length === 0) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          {/* Header with back button */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Slack Integration</h1>
              <p className="text-muted-foreground">No Slack workspaces connected</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>No Slack Connection</CardTitle>
              <CardDescription>
                Connect your Slack workspace to get started with syncing messages and files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => router.push('/integrations')}>
                Go back to Integrations
              </Button>
              
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  To connect Slack, go back to Integrations and click &quot;Connect&quot; on the Slack card.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header with breadcrumb navigation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button 
              onClick={() => router.push('/integrations')}
              className="hover:text-foreground transition-colors"
            >
              Integrations
            </button>
            <span className="text-muted-foreground/40">›</span>
            <span className="text-foreground">Slack</span>
          </div>

          {/* Clean Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#4A154B] rounded-xl flex items-center justify-center">
                <span className="text-white font-semibold text-xl">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Slack Integration
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    {slackData.totalWorkspaces} workspace{slackData.totalWorkspaces !== 1 ? 's' : ''} connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Workspaces */}
        <div className="space-y-6">
          {slackData.workspaces.map((workspace, index) => {
            const isSyncing = syncingWorkspaces.has(workspace.id);
            const syncStatusInfo = getSyncStatusInfo(workspace.syncStatus);

            return (
              <motion.div
                key={workspace.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border-0 bg-white dark:bg-slate-900/50 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-lg">S</span>
                        </div>
                        <div>
                          <CardTitle className="text-xl">{workspace.teamName}</CardTitle>
                          <CardDescription className="space-y-1">
                            <div>Team ID: {workspace.teamId}</div>
                            <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                              Workspace ID: {workspace.id}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      
                      {/* Sync Status Indicator */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className={syncStatusInfo.color}>
                          {workspace.syncStatus === 'recent' ? '✅' : 
                           workspace.syncStatus === 'stale' ? '⚠️' : '❌'}
                        </span>
                        <span className={syncStatusInfo.color}>{syncStatusInfo.label}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">👥</span>
                        <div>
                          <div className="text-lg font-semibold">{workspace.stats.totalUsers.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Users</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">#</span>
                        <div>
                          <div className="text-lg font-semibold">{workspace.stats.totalChannels.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Channels</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-purple-600">💬</span>
                        <div>
                          <div className="text-lg font-semibold">{workspace.stats.totalMessages.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Messages</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-600">📄</span>
                        <div>
                          <div className="text-lg font-semibold">{workspace.stats.totalFiles.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Files</div>
                        </div>
                      </div>
                    </div>

                    {/* Sync Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">📅</span>
                        <span className="text-muted-foreground">Connected:</span>
                        <span>{formatDate(workspace.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">🕒</span>
                        <span className="text-muted-foreground">Last sync:</span>
                        <span>{formatDate(workspace.lastSyncAt)}</span>
                      </div>
                      {workspace.syncStartDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">⬇️</span>
                          <span className="text-muted-foreground">Sync period starts:</span>
                          <span>{formatDate(workspace.syncStartDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Sync Actions - Streamlined and Clean */}
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">Sync Options</h3>
                        {workspace.stats.totalMessages < 1000 && (
                          <span className="text-xs text-muted-foreground">
                            💡 More historical data available
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {/* Quick Sync */}
                        <Button
                          onClick={() => handleSync(workspace.id, false)}
                          disabled={isSyncing}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          {isSyncing ? (
                            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full mr-2" />
                          ) : (
                            <span className="mr-2">↻</span>
                          )}
                          Quick Sync
                        </Button>
                        
                        {/* Historical Sync */}
                        <Button
                          onClick={() => handleSync(workspace.id, true)}
                          disabled={isSyncing}
                          size="sm"
                          variant="default"
                          className="flex-1"
                        >
                          {isSyncing ? (
                            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full mr-2" />
                          ) : (
                            <span className="mr-2">📅</span>
                          )}
                          6 Months
                        </Button>
                        
                        {/* Unlimited Sync */}
                        <Button
                          onClick={() => handleSync(workspace.id, true, true)}
                          disabled={isSyncing}
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0"
                        >
                          {isSyncing ? (
                            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full mr-2" />
                          ) : (
                            <span className="mr-2">🚀</span>
                          )}
                          All Messages
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>• <strong>Quick:</strong> Recent messages only</div>
                        <div>• <strong>6 Months:</strong> Historical data (limited by plan)</div>
                        <div>• <strong>All Messages:</strong> Extract everything available (10-30 min)</div>
                      </div>
                    </div>

                    {/* Debug Actions - Collapsed by default */}
                    <details className="group">
                      <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <span className="group-open:rotate-90 transition-transform">▶</span>
                        Advanced Options
                      </summary>
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t bg-muted/30 p-3 rounded">
                        <Button
                          onClick={() => window.open(`/api/slack/debug?workspaceId=${workspace.id}&type=messages&limit=50`, '_blank')}
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                        >
                          📋 View Messages
                        </Button>
                        
                        <Button
                          onClick={() => window.open(`/api/slack/debug?workspaceId=${workspace.id}&type=export-all&export=json`, '_blank')}
                          size="sm"
                          variant="ghost" 
                          className="text-xs"
                        >
                          📥 Export JSON
                        </Button>
                        
                        <Button
                          onClick={() => window.open(`/api/slack/debug?workspaceId=${workspace.id}&type=export-all`, '_blank')}
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                        >
                          🔍 Debug View
                        </Button>
                      </div>
                    </details>

                    {/* Info Banner for New Users */}
                    {(!workspace.hasData || workspace.stats.totalMessages < 50) && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-blue-600 text-lg">💡</span>
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              Get Started with Message Extraction
                            </h4>
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              Start with <strong>"All Messages"</strong> to extract your complete Slack history. 
                              This will scan all accessible channels and import as much data as your Slack plan allows.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Users Section */}
                    {workspace.users && workspace.users.length > 0 && (
                      <div className="space-y-4 pt-4 border-t">
                        {(() => {
                          const realUsers = workspace.users.filter(user => !user.isBot);
                          const botUsers = workspace.users.filter(user => user.isBot);
                          
                          return (
                            <>
                              {/* Real Users */}
                              {realUsers.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                      <span className="text-blue-600">👥</span>
                                      Team Members ({realUsers.length})
                                    </h3>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                                    {realUsers.slice(0, 12).map((user) => (
                                      <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="relative">
                                          {user.profileImage ? (
                                            <img 
                                              src={user.profileImage} 
                                              alt={user.realName || user.username}
                                              className="w-8 h-8 rounded-full"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                              {(user.realName || user.username || 'U').charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                          {user.isAdmin && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-white dark:border-slate-800 rounded-full text-[10px] flex items-center justify-center">
                                              ⭐
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                            {user.displayName || user.realName || user.username}
                                          </div>
                                          <div className="text-xs text-muted-foreground truncate">
                                            @{user.username}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {realUsers.length > 12 && (
                                    <div className="text-center text-sm text-muted-foreground">
                                      ... and {realUsers.length - 12} more members
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Bot Users */}
                              {botUsers.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                      <span className="text-green-600">🤖</span>
                                      Bots & Apps ({botUsers.length})
                                    </h3>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                                    {botUsers.slice(0, 9).map((bot) => (
                                      <div key={bot.id} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800">
                                        <div className="relative">
                                          {bot.profileImage ? (
                                            <img 
                                              src={bot.profileImage} 
                                              alt={bot.realName || bot.username}
                                              className="w-8 h-8 rounded-full"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                                              🤖
                                            </div>
                                          )}
                                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border border-white dark:border-slate-800 rounded-full text-[8px] flex items-center justify-center">
                                            ⚡
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                            {bot.displayName || bot.realName || bot.username}
                                          </div>
                                          <div className="text-xs text-green-600 dark:text-green-400 truncate">
                                            @{bot.username}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {botUsers.length > 9 && (
                                    <div className="text-center text-sm text-muted-foreground">
                                      ... and {botUsers.length - 9} more bots
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Channels Section */}
                    {workspace.channels && workspace.channels.length > 0 && (
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-green-600">#</span>
                            Channels ({workspace.channels.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                          {workspace.channels.slice(0, 10).map((channel) => (
                            <div key={channel.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <div className="flex-shrink-0 mt-0.5">
                                <span className="text-lg">
                                  {channel.isPrivate ? '🔒' : '#'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                                    {channel.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {channel.memberCount} members
                                  </div>
                                </div>
                                {channel.purpose && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {channel.purpose}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {workspace.channels.length > 10 && (
                          <div className="text-center text-sm text-muted-foreground">
                            ... and {workspace.channels.length - 10} more channels
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bot Invitation Notice */}
                    {workspace.hasData && workspace.channels && workspace.channels.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                        <strong>Note:</strong> To sync messages from channels, invite your bot to specific channels by typing <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">/invite @YourBot</code> in each channel you want to sync.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 