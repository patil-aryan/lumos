'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SlackSource {
  messageId: string;
  content: string;
  channelName: string;
  userName: string;
  timestamp: string;
  similarity: number;
  sourceIndex: number;
}

interface SourcesSidebarProps {
  sources: SlackSource[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function SourcesSidebar({ sources, isOpen, onClose, className = '' }: SourcesSidebarProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  if (!isOpen) {
    return null;
  }

  const isPlaceholder = sources?.some(source => source.messageId.startsWith('placeholder-'));

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.9) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    if (similarity >= 0.8) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    if (similarity >= 0.7) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800';
  };

  const truncateContent = (content: string, maxLength: number = 180) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const toggleExpanded = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-800/50 shadow-2xl z-40 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span className="text-blue-600 dark:text-blue-400 text-lg">💬</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sources</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sources && sources.length > 0 
                ? `${sources.length} message${sources.length !== 1 ? 's' : ''} referenced`
                : 'No sources available'
              }
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-9 w-9 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="text-gray-500 text-xl">×</span>
        </Button>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-96px)] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200/50 dark:border-gray-800/50">
            <span className="flex items-center gap-2">
              <span className="text-blue-500">{isPlaceholder ? '⏳' : '📊'}</span>
              {isPlaceholder ? (
                'Loading sources from Slack...'
              ) : sources && sources.length > 0 ? (
                'These Slack messages informed this response'
              ) : (
                'This response was generated without specific source references'
              )}
            </span>
          </div>

          {isPlaceholder ? (
            <div className="text-center py-8">
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                <span className="text-4xl animate-pulse">⏳</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading source information...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Source details will appear shortly.
              </p>
            </div>
          ) : sources && sources.length > 0 ? (
            sources.map((source) => {
              const isExpanded = expandedSources.has(source.messageId);
              const displayContent = isExpanded ? source.content : truncateContent(source.content);
              
              return (
                <Card key={source.messageId} className="border-0 shadow-sm bg-white/50 dark:bg-gray-900/50 hover:shadow-md transition-all duration-200 backdrop-blur-sm">
                  <CardContent className="p-5">
                    {/* Header with source index and similarity */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-medium px-2 py-1">
                          Source {source.sourceIndex}
                        </Badge>
                      </div>
                      <Badge className={`text-xs font-medium px-2 py-1 border ${getSimilarityColor(source.similarity)}`}>
                        {Math.round(source.similarity * 100)}% match
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">#</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{source.channelName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">👤</span>
                        <span>{source.userName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">🕒</span>
                        <span>{formatTimestamp(source.timestamp)}</span>
                      </div>
                    </div>

                    {/* Message content */}
                    <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200/30 dark:border-gray-700/30">
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {displayContent}
                      </p>
                      {source.content.length > 180 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleExpanded(source.messageId)}
                          className="text-xs mt-3 p-0 h-auto text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                <span className="text-4xl">🔍</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This response was generated using general knowledge.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                To get responses based on your Slack data, select &ldquo;Slack&rdquo; as a source.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 