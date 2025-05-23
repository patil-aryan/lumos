'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal,
  Plus,
  CalendarIcon,
  MessageSquareIcon,
  ClockIcon,
  FolderIcon,
  StarIcon,
  SearchIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

// Project interface
interface Project {
  id: string;
  name: string;
  description: string;
  lastUpdated: Date;
  messageCount: number;
  isFavorite: boolean;
}

export default function HubPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sample projects data
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Q3 Product Roadmap',
      description: 'Planning and prioritization for Q3 features and milestones',
      lastUpdated: new Date(2023, 6, 25),
      messageCount: 18,
      isFavorite: true
    },
    {
      id: '2',
      name: 'User Research - Mobile App',
      description: 'Analysis of user feedback and interview results',
      lastUpdated: new Date(2023, 6, 20),
      messageCount: 32,
      isFavorite: false
    },
    {
      id: '3',
      name: 'Feature Spec - Dashboard Redesign',
      description: 'Technical specifications and requirements for the new dashboard',
      lastUpdated: new Date(2023, 6, 15),
      messageCount: 24,
      isFavorite: true
    },
    {
      id: '4',
      name: 'Competitor Analysis',
      description: 'Market research and competitive analysis',
      lastUpdated: new Date(2023, 6, 10),
      messageCount: 15,
      isFavorite: false
    },
    {
      id: '5',
      name: 'API Documentation',
      description: 'Technical documentation for the RESTful API endpoints',
      lastUpdated: new Date(2023, 6, 5),
      messageCount: 8,
      isFavorite: false
    }
  ]);

  const toggleFavorite = (projectId: string) => {
    setProjects(projects.map(project => 
      project.id === projectId 
        ? { ...project, isFavorite: !project.isFavorite } 
        : project
    ));
  };
  
  const deleteProject = (projectId: string) => {
    setProjects(projects.filter(project => project.id !== projectId));
  };
  
  const createNewProject = () => {
    // Generate a new project and navigate to it
    const newId = (projects.length + 1).toString();
    const newProject: Project = {
      id: newId,
      name: 'New Project',
      description: 'Project description',
      lastUpdated: new Date(),
      messageCount: 0,
      isFavorite: false
    };
    
    setProjects([newProject, ...projects]);
    router.push(`/chat/${newId}`);
  };

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const favoriteProjects = filteredProjects.filter(project => project.isFavorite);
  const recentProjects = [...filteredProjects].sort((a, b) => 
    b.lastUpdated.getTime() - a.lastUpdated.getTime()
  );

  const ProjectCard = ({ project }: { project: Project }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Card className="cursor-pointer border border-border/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-200">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-md bg-muted flex items-center justify-center"
                onClick={() => router.push(`/chat/${project.id}`)}
              >
                <FolderIcon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle 
                className="text-lg font-medium hover:text-primary transition-colors duration-200"
                onClick={() => router.push(`/chat/${project.id}`)}
              >
                {project.name}
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => toggleFavorite(project.id)}
              >
                <StarIcon 
                  className={`h-4 w-4 ${project.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground group-hover:text-foreground'}`}
                />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/chat/${project.id}`)}>
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFavorite(project.id)}>
                    {project.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => deleteProject(project.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent 
          className="p-4 pt-2"
          onClick={() => router.push(`/chat/${project.id}`)}
        >
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{project.description}</p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                <span>{format(project.lastUpdated, 'MMM d, yyyy')}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="h-3 w-3" />
                <span>{project.messageCount} messages</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold mb-2">Project Hub</h1>
          <p className="text-muted-foreground">
            Manage and access all your conversations and projects
          </p>
        </div>
        
        <Button 
          onClick={createNewProject}
          className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </motion.div>
      
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          className="pl-9 bg-background border-border/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="recent" className="data-[state=active]:bg-primary/10">Recent</TabsTrigger>
          <TabsTrigger value="favorites" className="data-[state=active]:bg-primary/10">Favorites</TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-primary/10">All Projects</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentProjects.slice(0, 6).map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="favorites" className="mt-0">
          {favoriteProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favoriteProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No favorite projects yet.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="all" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 