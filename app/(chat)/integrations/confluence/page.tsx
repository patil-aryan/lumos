'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ChevronLeft
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Helper to format dates (assuming you have a similar utility)
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateString; // return original if parsing fails
  }
};

const formatNumber = (num?: number) => {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
};

interface ConfluenceSpaceItem {
  id: string;
  key: string;
  name: string;
  _links?: { webui?: string };
  // Add any other relevant fields like pageCount if available from API
}

interface ConfluencePageItem {
  id: string;
  title: string;
  space?: {
    id?: string;
    key?: string;
    name?: string;
  };
  version?: {
    by?: {
      displayName?: string;
      accountId?: string;
    };
    when?: string; // last updated
  };
  _links?: { webui?: string };
}

interface ConfluenceWorkspaceInfo {
  name: string; // e.g., getlumos.atlassian.net
  cloudId: string;
  url: string; // Base URL of the Confluence site
  connectedAt: string;
  lastSyncAt?: string;
}

interface ConfluenceStats {
  spaces: number;
  pages: number;
  // users: number; // If you plan to add users later
}

interface ConfluenceData {
  workspace: ConfluenceWorkspaceInfo;
  stats: ConfluenceStats;
  spacesList: ConfluenceSpaceItem[];
  pagesList: ConfluencePageItem[];
  connectionStatus: 'healthy' | 'partial' | 'error' | 'syncing'; // Added syncing
}

export default function ConfluenceIntegrationPage() {
  const router = useRouter();
  const [confluenceData, setConfluenceData] = useState<ConfluenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Page content modal state
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [pageContent, setPageContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showPageModal, setShowPageModal] = useState(false);

  const fetchConfluenceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/confluence/data');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch Confluence data: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        // Transform the API response to match the expected ConfluenceData structure
        const transformedData: ConfluenceData = {
          workspace: {
            name: result.data.workspace.name,
            cloudId: result.data.workspace.cloudId,
            url: result.data.workspace.url,
            connectedAt: result.data.workspace.connectedAt,
            lastSyncAt: result.data.workspace.lastSyncAt,
          },
          stats: {
            spaces: result.data.stats.spaces,
            pages: result.data.stats.pages,
          },
          spacesList: result.data.spacesList || [],
          pagesList: result.data.pagesList || [],
          connectionStatus: result.data.connectionStatus || 'healthy',
        };
        setConfluenceData(transformedData);
      } else {
        throw new Error(result.error || 'Confluence data not found or connection inactive.');
      }
    } catch (err: any) {
      console.error('Error fetching Confluence data:', err);
      setError(err.message || 'An unknown error occurred.');
      setConfluenceData(null); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfluenceData();
  }, [fetchConfluenceData]);

  const handleSync = async () => {
    setSyncing(true);
    toast.info('Starting Confluence data sync...');
    try {
      // TODO: Replace with your actual sync API endpoint if different
      const response = await fetch('/api/confluence/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ syncType: 'incremental' })
      }); 
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Sync initiation failed');
      }
      const result = await response.json();
      if (result.success) {
        toast.success(result.message || 'Confluence sync initiated successfully! Data will be updated shortly.');
        // Optionally, re-fetch data or wait for a webhook/SSE to update
        setTimeout(fetchConfluenceData, 5000); // Re-fetch after a delay
      } else {
        throw new Error(result.error || 'Sync failed to complete.');
      }
    } catch (err: any) {
      console.error('Error syncing Confluence data:', err);
      toast.error(`Sync Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };
  
  const handleDisconnect = async () => {
    toast.info('Disconnecting Confluence...');
    try {
      // TODO: Implement actual disconnect logic. 
      // This usually involves calling an API endpoint to remove credentials from DB
      // and possibly revoking the OAuth token with Atlassian if an API for that exists.
      const response = await fetch('/api/confluence/disconnect', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to disconnect');
      }
      toast.success('Confluence disconnected successfully.');
      router.push('/integrations');
    } catch (err: any) {
      console.error('Error disconnecting Confluence:', err);
      toast.error(`Disconnect failed: ${err.message}`);
    }
  };

  const handleViewPage = async (page: ConfluencePageItem) => {
    setSelectedPage(page);
    setLoadingContent(true);
    setShowPageModal(true);
    
    try {
      const response = await fetch(`/api/confluence/page/${page.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch page content');
      }
      const result = await response.json();
      if (result.success) {
        setPageContent(result.data);
      } else {
        throw new Error(result.error || 'Failed to load page content');
      }
    } catch (err: any) {
      console.error('Error fetching page content:', err);
      toast.error(`Failed to load page: ${err.message}`);
      setShowPageModal(false);
    } finally {
      setLoadingContent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full p-6">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="ml-2 text-slate-600 dark:text-slate-400">Loading Confluence data...</p>
      </div>
    );
  }

  if (error || !confluenceData) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/integrations')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Integrations
            </Button>
          </div>
          <Card className="text-center p-8 border-red-500/50 dark:border-red-500/30 bg-red-50/20 dark:bg-red-900/10">
            <CardHeader>
              <div className="w-12 h-12 text-red-500 mx-auto mb-4 text-4xl">⚠️</div>
              <CardTitle className="text-xl text-red-700 dark:text-red-400">
                {error ? 'Error Loading Data' : 'No Confluence Connection Found'}
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {error || 'Please connect your Confluence workspace first to view details.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/integrations')} variant="default" className="bg-red-600 hover:bg-red-700 text-white">
                Go to Integrations
              </Button>
              {error && (
                 <Button onClick={fetchConfluenceData} variant="outline" className="ml-2">
                    <span className="mr-2">🔄</span>
                    Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { workspace, stats, spacesList, pagesList, connectionStatus } = confluenceData;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/integrations')}
              className="flex-shrink-0 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-700 shadow-sm">
                <AvatarImage src="https://cdnlogo.com/logos/c/82/confluence.svg" alt="Confluence logo" />
                <AvatarFallback style={{backgroundColor: '#0052CC'}} className="text-white font-bold">C</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {workspace.name || 'Confluence Workspace'}
              </h1>
              <a 
                href={workspace.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
              >
                {workspace.url}
              </a>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Badge 
              variant="secondary" 
              className={`px-2.5 py-1 text-xs font-medium
                ${connectionStatus === 'healthy' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' :
                  connectionStatus === 'syncing' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' :
                  connectionStatus === 'partial' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' :
                  'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'}`}
            >
              {connectionStatus === 'healthy' && 'Healthy'}
              {connectionStatus === 'syncing' && 'Syncing'}
              {connectionStatus === 'partial' && 'Partial'}
              {connectionStatus === 'error' && 'Error'}
            </Badge>
            <Button
              onClick={handleSync}
              disabled={syncing || connectionStatus === 'syncing'}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white min-w-[90px]"
            >
              {syncing || connectionStatus === 'syncing' ? 'Syncing...' : 'Sync'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-600 dark:text-red-500 dark:hover:bg-red-700/20 dark:hover:text-red-400"
            >
              Disconnect
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Spaces</CardTitle>
              <span className="text-4xl">🏢</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(stats.spaces)}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Accessible spaces</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Pages</CardTitle>
              <span className="text-4xl"></span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(stats.pages)}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Across all spaces</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Connected On</CardTitle>
              <span className="text-4xl">🌐</span>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{formatDate(workspace.connectedAt).split(',')[0]}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">At {formatDate(workspace.connectedAt).split(',')[1]}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Last Synced</CardTitle>
              <span className="text-4xl">🔄</span>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {workspace.lastSyncAt ? formatDate(workspace.lastSyncAt).split(',')[0] : 'Never'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {workspace.lastSyncAt ? `At ${formatDate(workspace.lastSyncAt).split(',')[1]}` : 'Sync to get latest data'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
              <TabsTrigger 
                value="overview" 
                className="h-10 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="spaces" 
                className="h-10 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Spaces ({formatNumber(spacesList.length)})
              </TabsTrigger>
              <TabsTrigger 
                value="pages" 
                className="h-10 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Pages ({formatNumber(pagesList.length)})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle>Confluence Integration Overview</CardTitle>
                  <CardDescription>
                    Status and general information about your Confluence connection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Workspace URL</Label>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{workspace.url}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Cloud ID</Label>
                    <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{workspace.cloudId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Current Scopes</Label>
                    {/* TODO: Fetch and display actual scopes if available from /api/confluence/data */}
                    <p className="text-xs text-slate-600 dark:text-slate-400">read:page:confluence, read:space:confluence, read:content:confluence, and others...</p>
                  </div>
                   <Separator className="my-4 bg-slate-200 dark:bg-slate-700"/>
                   <Button onClick={handleSync} disabled={syncing || connectionStatus === 'syncing'} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
                      {syncing || connectionStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                   </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="spaces" className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confluence Spaces</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      List of all accessible spaces in your Confluence instance. ({stats.spaces} total)
                    </p>
                  </div>
                  {spacesList.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Name</TableHead>
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Key</TableHead>
                          <TableHead className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spacesList.map((space) => (
                          <TableRow key={space.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <TableCell className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{space.name}</TableCell>
                            <TableCell className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-mono text-xs">
                                {space.key}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              {space._links?.webui && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                  onClick={() => {
                                    const url = space._links?.webui;
                                    if (url) {
                                      window.open(url, '_blank');
                                    }
                                  }}
                                >
                                  View Space
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12 px-6">
                      <span className="text-4xl mb-4 block">🏢</span>
                      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Spaces Found</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No spaces were found or accessible in this Confluence instance.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pages" className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Confluence Pages</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      List of recently updated or all accessible pages. ({stats.pages} total)
                    </p>
                  </div>
                  {pagesList.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Title</TableHead>
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Space</TableHead>
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Author</TableHead>
                          <TableHead className="px-6 py-4 text-left font-medium text-slate-600 dark:text-slate-300">Last Updated</TableHead>
                          <TableHead className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagesList.map((page) => (
                          <TableRow key={page.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <TableCell className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{page.title}</TableCell>
                            <TableCell className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {page.space?.key ? (
                                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 font-mono text-xs">
                                  {page.space.key}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {page.version?.by?.displayName || (
                                <span className="text-slate-400 text-sm">Unknown</span>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {page.version?.when ? (
                                <time className="text-sm" dateTime={page.version.when}>
                                  {formatDate(page.version.when)}
                                </time>
                              ) : (
                                <span className="text-slate-400 text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                  onClick={() => handleViewPage(page)}
                                >
                                  View Details
                                </Button>
                                {page._links?.webui && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                    onClick={() => {
                                      const url = page._links?.webui;
                                      if (url) {
                                        window.open(url, '_blank');
                                      }
                                    }}
                                  >
                                    Open in Confluence
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12 px-6">
                      <span className="text-4xl mb-4 block">📄</span>
                      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Pages Found</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No pages were found. Try syncing the data or check Confluence.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Page Content Modal */}
      <Dialog open={showPageModal} onOpenChange={setShowPageModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {selectedPage?.title || 'Loading...'}
            </DialogTitle>
            {pageContent && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  {pageContent.space?.key}
                </Badge>
                <span>•</span>
                <span>By {pageContent.version?.by?.displayName || 'Unknown'}</span>
                <span>•</span>
                <span>{pageContent.version?.when ? formatDate(pageContent.version.when) : 'Unknown date'}</span>
              </div>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {loadingContent ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="ml-2 text-slate-600 dark:text-slate-400">Loading page content...</p>
              </div>
            ) : pageContent?.body?.view?.value ? (
              <div 
                className="prose prose-slate dark:prose-invert max-w-none p-4"
                dangerouslySetInnerHTML={{ __html: pageContent.body.view.value }}
              />
            ) : pageContent?.body?.storage?.value ? (
              <div 
                className="prose prose-slate dark:prose-invert max-w-none p-4"
                dangerouslySetInnerHTML={{ __html: pageContent.body.storage.value }}
              />
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">📄</span>
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Content Available</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This page doesn&apos;t have viewable content or it couldn&apos;t be loaded.
                </p>
                {pageContent && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-xs text-slate-400">Debug Info</summary>
                    <pre className="text-xs text-slate-600 dark:text-slate-400 mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                      {JSON.stringify({
                        hasBody: !!pageContent.body,
                        bodyKeys: pageContent.body ? Object.keys(pageContent.body) : 'no body',
                        hasView: !!pageContent.body?.view,
                        hasStorage: !!pageContent.body?.storage
                      }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
          
          {pageContent?._links?.webui && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <Button 
                variant="outline" 
                onClick={() => window.open(pageContent._links.webui, '_blank')}
                className="w-full"
              >
                Open Full Page in Confluence
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 