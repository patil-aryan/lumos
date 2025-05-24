'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface SlackSource {
  messageId: string;
  content: string;
  channelName: string;
  userName: string;
  timestamp: string;
  similarity: number;
}

interface ViewSourcesButtonProps {
  sources: SlackSource[];
  className?: string;
  onViewSources?: (sources: SlackSource[]) => void;
  isOpen?: boolean;
}

export function ViewSourcesButton({ sources, className = '', onViewSources, isOpen = false }: ViewSourcesButtonProps) {
  const handleClick = () => {
    if (onViewSources) {
      onViewSources(sources || []);
    }
  };

  const hasRealSources = sources && sources.length > 0;
  const isPlaceholder = sources?.some(source => source.messageId.startsWith('placeholder-'));
  
  let buttonText = 'View Sources (0)';
  let buttonIcon = '💡';
  
  if (hasRealSources) {
    if (isPlaceholder) {
      buttonText = `Loading Sources (${sources.length})`;
      buttonIcon = '⏳';
    } else {
      buttonText = `${isOpen ? 'Hide' : 'View'} Sources (${sources.length})`;
      buttonIcon = isOpen ? '📂' : '💡';
    }
  }

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={`flex items-center gap-2 text-xs px-3 py-1.5 h-auto border-gray-200 dark:border-gray-600 transition-all ${
          isOpen 
            ? 'bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 border-blue-300 dark:border-blue-700' 
            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <span className="text-sm">{buttonIcon}</span>
        <span>{buttonText}</span>
      </Button>
    </div>
  );
} 