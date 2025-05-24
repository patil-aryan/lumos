'use client';

import React, { useState } from 'react';
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

interface SourceCitationProps {
  sources: SlackSource[];
  className?: string;
}

export function SourceCitation({ sources, className = '' }: SourceCitationProps) {
  const [selectedSource, setSelectedSource] = useState<SlackSource | null>(null);

  if (!sources || sources.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleString();
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (similarity >= 0.8) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (similarity >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <div className={`mt-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">💬</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Sources from Slack
        </span>
        <Badge variant="secondary" className="text-xs">
          {sources.length} message{sources.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid gap-2">
        {sources.map((source, index) => (
          <Sheet key={source.messageId}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-auto p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setSelectedSource(source)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge className={`text-xs ${getSimilarityColor(source.similarity)}`}>
                      {Math.round(source.similarity * 100)}%
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
                      <span className="text-xs">#</span>
                      <span className="truncate">{source.channelName}</span>
                      <span className="text-xs ml-1">👤</span>
                      <span className="truncate">{source.userName}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">🔗</span>
                </div>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span>💬</span>
                  Slack Message Source
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Message Metadata */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Message Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">#</span>
                      <span className="text-sm font-medium">#{source.channelName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👤</span>
                      <span className="text-sm">{source.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🕒</span>
                      <span className="text-sm">{formatTimestamp(source.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Relevance:</span>
                      <Badge className={`text-xs ${getSimilarityColor(source.similarity)}`}>
                        {Math.round(source.similarity * 100)}% match
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Message Content */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Message Content</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {source.content}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" className="flex-1">
                    <span className="mr-2">💬</span>
                    View in Slack
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </div>
  );
} 