'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface JiraWorkspaceData {
  workspace: {
    id: string;
    name: string;
    url: string;
    cloudId: string;
    connectedAt: string;
    lastSyncAt: string | null;
  };
  serverInfo: {
    baseUrl: string;
    version: string;
    buildNumber: string;
    serverTitle: string;
  } | null;
  projects: {
    success: boolean;
    count: number;
    sample: Array<{
      key: string;
      name: string;
      type: string;
    }>;
  };
  users: {
    success: boolean;
    count: number;
    sample: Array<{
      accountId: string;
      displayName: string;
      active: boolean;
    }>;
  };
  connectionStatus: 'healthy' | 'partial';
  errors?: string[];
}

interface ProjectData {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  leadDisplayName?: string;
  url?: string;
  simplified: boolean;
  style?: string;
  isPrivate: boolean;
}

interface IssueData {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: string;
  priority?: string;
  assigneeDisplayName?: string;
  created: string;
  updated: string;
  projectKey: string;
  projectName: string;
}

export default function JiraIntegrationPage() {
  const router = useRouter();
  const [jiraData, setJiraData] = useState<JiraWorkspaceData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchJiraData();
  }, []);

  const fetchJiraData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/jira/data');
      if (response.ok) {
        const result = await response.json();
        console.log('Jira API response:', result); // Debug log
        
        if (result.success && result.data?.workspace) {
          // Transform new API structure to expected format
          const transformedData: JiraWorkspaceData = {
            workspace: {
              id: result.data.workspace.id,
              name: result.data.workspace.name,
              url: result.data.workspace.url,
              cloudId: result.data.workspace.cloudId,
              connectedAt: new Date().toISOString(), // Fallback since not in new structure
              lastSyncAt: null, // Fallback since not in new structure
            },
            serverInfo: result.data.serverInfo || null,
            projects: {
              success: result.data.stats?.projects > 0,
              count: result.data.stats?.projects || 0,
              sample: result.data.recentProjects?.slice(0, 6).map((p: any) => ({
                key: p.key,
                name: p.name,
                type: p.projectTypeKey || 'software'
              })) || []
            },
            users: {
              success: result.data.stats?.users > 0,
              count: result.data.stats?.users || 0,
              sample: result.data.activeUsers?.map((u: any) => ({
                accountId: u.accountId,
                displayName: u.displayName,
                active: u.active
              })) || []
            },
            connectionStatus: result.data.stats?.status === 'success' ? 'healthy' : 'partial',
            errors: result.data.stats?.errors > 0 ? ['Connection issues detected'] : []
          };
          
          setJiraData(transformedData);
          setProjects(result.data.recentProjects || []);
          setIssues(result.data.recentIssues || []);
        } else {
          console.log('Jira API returned error or no data:', result);
          setJiraData(null);
          setProjects([]);
          setIssues([]);
        }
      } else if (response.status === 404) {
        console.log('Jira workspace not found (404)');
        setJiraData(null);
        setProjects([]);
        setIssues([]);
      } else {
        console.error('Jira API error:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.log('Error details:', errorData);
        
        // Check if it's a scope mismatch error
        if (errorData.error?.includes('scope') || errorData.error?.includes('Re-authentication required')) {
          toast.error('Jira authentication needs to be updated. Please reconnect.');
        } else {
          toast.error(`Failed to load Jira data: ${errorData.error || 'Unknown error'}`);
        }
        
        setJiraData(null);
        setProjects([]);
        setIssues([]);
      }
    } catch (error) {
      console.error('Error fetching Jira data:', error);
      toast.error('Error loading Jira data - Check console for details');
      setJiraData(null);
      setProjects([]);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!jiraData) return;
    try {
      setSyncing(true);
      const response = await fetch('/api/jira/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: jiraData.workspace.id }),
      });
      if (response.ok) {
        toast.success('Jira sync started');
        setTimeout(() => {
          fetchJiraData();
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

  const handleDisconnect = async () => {
    if (!jiraData) return;
    if (!confirm('Are you sure you want to disconnect this Jira workspace? This will remove all synced data.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/jira/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: jiraData.workspace.id }),
      });
      
      if (response.ok) {
        toast.success('Jira workspace disconnected');
        router.push('/integrations');
      } else {
        toast.error('Failed to disconnect workspace');
      }
    } catch (error) {
      console.error('Error disconnecting workspace:', error);
      toast.error('Error disconnecting workspace');
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset your Jira connection? You will need to reconnect.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/jira/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        toast.success('Jira connection reset. Please reconnect.');
        router.push('/integrations');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to reset: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resetting Jira connection:', error);
      toast.error('Error resetting connection');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status?: string) => {
    if (!status) {
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
    }
    
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('done') || lowerStatus.includes('resolved') || lowerStatus.includes('closed')) {
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    } else if (lowerStatus.includes('progress') || lowerStatus.includes('review')) {
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    } else if (lowerStatus.includes('todo') || lowerStatus.includes('open') || lowerStatus.includes('new')) {
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
    }
    return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
  };

  const getPriorityIcon = (priority?: string) => {
    return null;
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!jiraData) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/integrations')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Integrations
            </Button>
          </div>
          <Card className="text-center p-8">
            <CardHeader>
              <CardTitle className="text-xl">No Jira Connection Found</CardTitle>
              <CardDescription>
                Please connect your Jira workspace first to view details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/integrations')}>
                Go to Integrations
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/integrations')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Integrations
            </Button>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <img 
                src="https://cdnlogo.com/logos/j/69/jira.svg" 
                alt="Jira logo"
                className="w-6 h-6 object-contain filter invert"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling!.classList.remove('hidden');
                }}
              />
              <span className="hidden text-white font-bold text-sm">J</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {jiraData.workspace.name}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Connected to Jira Cloud • {formatDate(jiraData.workspace.connectedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="secondary" 
              className={jiraData.connectionStatus === 'healthy' 
                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
              }
            >
              {jiraData.connectionStatus === 'healthy' ? 'Healthy' : 'Partial Connection'}
            </Badge>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
            >
              Reset Connection
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>

        {/* Connection Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Server Info
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {jiraData.serverInfo ? 'Connected' : 'Limited'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {jiraData.serverInfo?.version || 'Version unavailable'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Projects
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {jiraData.projects.success ? jiraData.projects.count : 'N/A'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {jiraData.projects.success ? 'Accessible projects' : 'Access limited'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Users
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {jiraData.users.success ? jiraData.users.count : 'N/A'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {jiraData.users.success ? 'Team members' : 'Access limited'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Last Sync
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {jiraData.workspace.lastSyncAt ? 'Synced' : 'Never'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {jiraData.workspace.lastSyncAt 
                    ? formatDate(jiraData.workspace.lastSyncAt)
                    : 'No sync performed'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Server Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Server Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jiraData.serverInfo ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Server Title</Label>
                        <p className="font-medium">{jiraData.serverInfo.serverTitle}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Version</Label>
                        <p className="font-medium">{jiraData.serverInfo.version}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Build Number</Label>
                        <p className="font-medium">{jiraData.serverInfo.buildNumber}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Base URL</Label>
                        <p className="font-medium break-all">{jiraData.serverInfo.baseUrl}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">
                      Server information is not available. This may be due to limited permissions.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Connection Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Connection Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Projects Access</span>
                      <Badge className={jiraData.projects.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {jiraData.projects.success ? 'Working' : 'Limited'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Users Access</span>
                      <Badge className={jiraData.users.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {jiraData.users.success ? 'Working' : 'Limited'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Server Info</span>
                      <Badge className={jiraData.serverInfo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {jiraData.serverInfo ? 'Available' : 'Limited'}
                      </Badge>
                    </div>
                  </div>
                  
                  {jiraData.errors && jiraData.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">Connection Issues:</h4>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {jiraData.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sample Data */}
            {jiraData.projects.success && jiraData.projects.sample.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Projects</CardTitle>
                  <CardDescription>
                    A preview of your accessible Jira projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    {jiraData.projects.sample.map((project) => (
                      <div key={project.key} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{project.key}</Badge>
                          <span className="text-xs text-slate-500">{project.type}</span>
                        </div>
                        <h4 className="font-medium">{project.name}</h4>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>
                  All accessible Jira projects ({projects.length} projects)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Privacy</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((project) => (
                          <TableRow key={project.key}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{project.key}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{project.name}</p>
                                {project.description && (
                                  <p className="text-xs text-slate-500 truncate max-w-xs">
                                    {project.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {project.projectTypeKey || 'software'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{project.leadDisplayName || 'Not assigned'}</span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={project.isPrivate ? 'destructive' : 'default'}
                                className="text-xs"
                              >
                                {project.isPrivate ? 'Private' : 'Public'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      No Projects Found
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      No accessible projects found. Please check your Jira permissions.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Issues</CardTitle>
                <CardDescription>
                  Latest issues from your Jira projects ({issues.length} issues loaded)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {issues.length > 0 ? (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Summary</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Assignee</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {issues.slice(0, 20).map((issue) => (
                          <TableRow key={issue.key}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{issue.key}</Badge>
                                <span className="text-xs text-slate-500">{issue.issueType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <p className="font-medium truncate">{issue.summary}</p>
                                <p className="text-xs text-slate-500">{issue.projectName}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="secondary" 
                                className={getStatusBadgeColor(issue.status)}
                              >
                                {issue.status || 'No Status'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{issue.priority || 'None'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{issue.assigneeDisplayName || 'Unassigned'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-slate-500">
                                {new Date(issue.updated).toLocaleDateString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {issues.length > 20 && (
                      <p className="text-sm text-slate-500 text-center mt-4">
                        Showing first 20 of {issues.length} issues
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      No Issues Found
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {jiraData?.projects.success 
                        ? 'No issues were found in your accessible projects.'
                        : 'Unable to load issues. Please check your project permissions.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>
                  Manage your Jira integration settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Workspace URL</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {jiraData.workspace.url}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Cloud ID</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-mono">
                      {jiraData.workspace.cloudId}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Connection Status</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Connected on {formatDate(jiraData.workspace.connectedAt)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
                  <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">
                      Disconnect Workspace
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      This will permanently remove this Jira workspace connection and all associated data. This action cannot be undone.
                    </p>
                    <Button variant="destructive" onClick={handleDisconnect}>
                      Disconnect Workspace
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 