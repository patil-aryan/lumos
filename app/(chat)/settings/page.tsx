'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserIcon, BriefcaseIcon, PaletteIcon, BellIcon, LogOutIcon, SaveIcon } from 'lucide-react';

export default function SettingsPage() {
  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    jobTitle: 'Senior Product Manager',
    company: 'Acme Inc.',
    avatarUrl: '/avatar-placeholder.png'
  });
  
  // Workspace settings state
  const [workspaceForm, setWorkspaceForm] = useState({
    name: 'Product Team Workspace',
    description: 'Shared workspace for the product management team'
  });
  
  // Display settings state
  const [displaySettings, setDisplaySettings] = useState({
    darkMode: true,
    compactMode: false,
    notificationsEnabled: true,
    integrationAlerts: true,
    soundEffects: false
  });
  
  // Form handling
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setWorkspaceForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (name: string, checked: boolean) => {
    setDisplaySettings(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    // Save profile data
    console.log('Saving profile:', profileForm);
  };
  
  const handleSaveWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    // Save workspace data
    console.log('Saving workspace:', workspaceForm);
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">
          Manage your account preferences and workspace settings
        </p>
      </motion.div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6 grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="profile" className="data-[state=active]:bg-primary/10 flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="workspace" className="data-[state=active]:bg-primary/10 flex items-center gap-2">
            <BriefcaseIcon className="h-4 w-4" />
            <span>Workspace</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-primary/10 flex items-center gap-2">
            <PaletteIcon className="h-4 w-4" />
            <span>Display</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-border/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Personal Information</CardTitle>
                    <CardDescription>
                      Update your profile information and account settings
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-4 border-background">
                      <AvatarImage src={profileForm.avatarUrl} />
                      <AvatarFallback>JS</AvatarFallback>
                    </Avatar>
                    <Badge variant="outline" className="text-xs py-1">
                      Product Manager
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        name="name"
                        value={profileForm.name} 
                        onChange={handleProfileChange}
                        className="bg-background border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email"
                        name="email"
                        type="email"
                        value={profileForm.email}
                        onChange={handleProfileChange} 
                        className="bg-background border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input 
                        id="jobTitle"
                        name="jobTitle"
                        value={profileForm.jobTitle}
                        onChange={handleProfileChange}
                        className="bg-background border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input 
                        id="company"
                        name="company"
                        value={profileForm.company}
                        onChange={handleProfileChange}
                        className="bg-background border-border/50"
                      />
                    </div>
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="flex justify-between items-center">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      <span>Sign Out</span>
                    </Button>
                    
                    <Button 
                      type="submit"
                      className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 gap-2"
                    >
                      <SaveIcon className="h-4 w-4" />
                      <span>Save Changes</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        
        <TabsContent value="workspace" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Workspace Settings</CardTitle>
                <CardDescription>
                  Customize your workspace and team collaboration preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveWorkspace} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="workspaceName">Workspace Name</Label>
                      <Input 
                        id="workspaceName"
                        name="name"
                        value={workspaceForm.name}
                        onChange={handleWorkspaceChange}
                        className="bg-background border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="workspaceDescription">Description</Label>
                      <Input 
                        id="workspaceDescription"
                        name="description"
                        value={workspaceForm.description}
                        onChange={handleWorkspaceChange}
                        className="bg-background border-border/50"
                      />
                    </div>
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit"
                      className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 gap-2"
                    >
                      <SaveIcon className="h-4 w-4" />
                      <span>Save Workspace</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        
        <TabsContent value="appearance" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Display & Notifications</CardTitle>
                <CardDescription>
                  Customize the appearance and notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="darkMode">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable dark theme for the application
                      </p>
                    </div>
                    <Switch
                      id="darkMode"
                      checked={displaySettings.darkMode}
                      onCheckedChange={(checked) => handleSwitchChange('darkMode', checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="compactMode">Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Use a more compact layout to maximize screen space
                      </p>
                    </div>
                    <Switch
                      id="compactMode"
                      checked={displaySettings.compactMode}
                      onCheckedChange={(checked) => handleSwitchChange('compactMode', checked)}
                    />
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
                    <BellIcon className="h-4 w-4" />
                    <span>Notification Settings</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="notificationsEnabled">Enable Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications for important updates
                        </p>
                      </div>
                      <Switch
                        id="notificationsEnabled"
                        checked={displaySettings.notificationsEnabled}
                        onCheckedChange={(checked) => handleSwitchChange('notificationsEnabled', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="integrationAlerts">Integration Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified about integration updates and changes
                        </p>
                      </div>
                      <Switch
                        id="integrationAlerts"
                        checked={displaySettings.integrationAlerts}
                        onCheckedChange={(checked) => handleSwitchChange('integrationAlerts', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="soundEffects">Sound Effects</Label>
                        <p className="text-sm text-muted-foreground">
                          Play sounds for notifications and actions
                        </p>
                      </div>
                      <Switch
                        id="soundEffects"
                        checked={displaySettings.soundEffects}
                        onCheckedChange={(checked) => handleSwitchChange('soundEffects', checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 