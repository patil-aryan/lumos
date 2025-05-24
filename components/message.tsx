'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import Lottie from 'lottie-react';
import animationData from '@/public/lottie/Animation - 1748017463409.json';
import { ViewSourcesButton } from './view-sources-button';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
  append,
  onViewSources,
  messagesSources,
  sourcesOpen,
  currentSources,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  append?: UseChatHelpers['append'];
  onViewSources?: (sources: any[]) => void;
  messagesSources?: Record<string, any[]>;
  sourcesOpen?: boolean;
  currentSources?: any[];
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Get sources for this specific message
  const messageSources = messagesSources?.[message.id] || [];
  
  // Fallback: check for citation patterns in text if no sources found
  const hasCitationPattern = (text: string) => {
    return /\[Source \d+\]/g.test(text);
  };

  // Debug logging
  useEffect(() => {
    if (message.role === 'assistant') {
      console.log('Assistant message sources:', {
        messageId: message.id,
        sourcesCount: messageSources.length,
        allMessagesSources: messagesSources,
        hasPatterns: message.parts?.some(part => 
          part.type === 'text' && hasCitationPattern(part.text)
        )
      });
    }
  }, [message, messageSources, messagesSources]);

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className={cn(
          'w-full mx-auto px-4 group/message max-w-4xl'
        )}
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
    <div
      className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit' || message.role === 'assistant',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center shrink-0">
              <div className="size-8">
                <Lottie 
                  animationData={animationData}
                  loop={true}
                  autoplay={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          )}
          
          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
              'mb-6': message.role === 'assistant',
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
              </div>
            )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                              data-testid="message-edit-button"
                          variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                        </Button>
                      </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                      </Tooltip>
                    )}
                    
                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4 overflow-x-auto', {
                          'bg-gray-100 text-gray-900 px-3 py-2 rounded-xl border border-gray-200':
                            message.role === 'user',
                          'text-foreground dark:text-zinc-200': message.role === 'assistant',
                        })}
                      >
                        <Markdown>{sanitizeText(part.text)}</Markdown>
                        
                        {/* Add View Sources button for assistant messages with citations */}
                        {message.role === 'assistant' && (() => {
                          const hasPatterns = hasCitationPattern(part.text);
                          const shouldShowButton = messageSources.length > 0 || hasPatterns;
                          
                          // Check if this specific message's sources are currently open
                          const areTheseSourcesOpen = sourcesOpen && currentSources && 
                            messageSources.length > 0 && 
                            JSON.stringify(currentSources.map(s => s.messageId).sort()) === 
                            JSON.stringify(messageSources.map(s => s.messageId).sort());
                          
                          // If we have real sources, use them
                          if (messageSources.length > 0) {
                            return (
                              <ViewSourcesButton 
                                sources={messageSources} 
                                className="mt-2" 
                                onViewSources={onViewSources}
                                isOpen={areTheseSourcesOpen}
                              />
                            );
                          }
                          
                          // If we have citation patterns but no sources yet (timing issue), 
                          // extract the highest source number from patterns
                          if (hasPatterns) {
                            const sourceMatches = part.text.match(/\[Source (\d+)\]/g) || [];
                            const sourceNumbers = sourceMatches.map(match => 
                              parseInt(match.match(/\d+/)?.[0] || '0', 10)
                            );
                            const maxSourceNumber = sourceNumbers.length > 0 ? Math.max(...sourceNumbers) : 0;
                            
                            // Create placeholder sources based on citation patterns
                            const placeholderSources = Array.from({ length: maxSourceNumber }, (_, i) => ({
                              messageId: `placeholder-${i + 1}`,
                              content: `Source ${i + 1} content will be available shortly...`,
                              channelName: 'Loading...',
                              userName: 'Loading...',
                              timestamp: Date.now().toString(),
                              similarity: 0.8,
                              sourceIndex: i + 1
                            }));
                            
                            // Check if placeholder sources for this message are open
                            const arePlaceholdersOpen = sourcesOpen && currentSources &&
                              currentSources.length === placeholderSources.length &&
                              currentSources.every(s => s.messageId.startsWith('placeholder-'));
                            
                            return (
                              <ViewSourcesButton 
                                sources={placeholderSources}
                                className="mt-2" 
                                onViewSources={onViewSources}
                                isOpen={arePlaceholdersOpen}
                              />
                            );
                          }
                          
                          return null;
                        })()}
      </div>
    </div>
  );
}

                if (mode === 'edit') {
  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                        append={append}
                      />
      </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : null}
    </div>
  );
}

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
      chatId={chatId}
      message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto px-4 group/message max-w-4xl"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 w-full',
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center shrink-0">
          <div className="size-8">
            <Lottie 
              animationData={animationData}
              loop={true}
              autoplay={true}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
}; 