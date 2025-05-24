'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface DataSource {
  id: string;
  name: string;
  icon: React.ReactNode | string;
}

interface SourceDialogProps {
  onSourcesChange: (sources: string[]) => void;
}

export function SourceDialog({ onSourcesChange }: SourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(['general']);

  // Available data sources
  const dataSources: DataSource[] = [
    { id: 'general', name: 'General', icon: '🔮' },
    { id: 'slack', name: 'Slack', icon: '/slack-icon.svg' },
    { id: 'jira', name: 'Jira', icon: '/jira-icon.svg' },
    { id: 'confluence', name: 'Confluence', icon: '/confluence-icon.svg' },
    { id: 'docs', name: 'Uploaded Files', icon: '📁' },
    { id: 'all', name: 'All Sources', icon: '🌐' },
  ];

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => {
      if (sourceId === 'all') {
        // If "All Sources" is being selected, clear other selections
        return ['all'];
      } else {
        // If any specific source is selected, remove "All Sources"
        const newSelection = prev.includes(sourceId)
          ? prev.filter(id => id !== sourceId)
          : [...prev.filter(id => id !== 'all'), sourceId];
        
        // If no sources selected, default to "General"
        return newSelection.length === 0 ? ['general'] : newSelection;
      }
    });
  };

  const handleApply = () => {
    onSourcesChange(selectedSources);
    setOpen(false);
  };

  // Get the display text based on selected sources
  const getSourceButtonText = () => {
    if (selectedSources.includes('all')) {
      return 'All Sources';
    }
    if (selectedSources.length === 1) {
      return dataSources.find(source => source.id === selectedSources[0])?.name || 'Select Source';
    }
    return `${selectedSources.length} Sources`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center text-gray-500 dark:text-gray-400 text-sm font-medium gap-1 p-1">
          <span className="text-sm">⚙️</span>
          <span>{getSourceButtonText()}</span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Knowledge Sources</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {dataSources.map((source) => (
            <div key={source.id} className="flex items-center space-x-4">
              <Checkbox 
                id={`source-${source.id}`} 
                checked={selectedSources.includes(source.id)}
                onCheckedChange={() => toggleSource(source.id)}
              />
              <div className="flex items-center space-x-2">
                {typeof source.icon === 'string' ? (
                  source.icon.startsWith('/') ? (
                    <img src={source.icon} alt={source.name} className="h-5 w-5" />
                  ) : (
                    <span className="text-lg">{source.icon}</span>
                  )
                ) : (
                  source.icon
                )}
                <label 
                  htmlFor={`source-${source.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {source.name}
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleApply}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 