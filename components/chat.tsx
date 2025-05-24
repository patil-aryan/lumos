'use client';

import type { Attachment, UIMessage, ChatRequestOptions } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { Messages } from './messages';
import { Greeting } from './greeting';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import { motion } from 'framer-motion';
import { SourceDialog } from './source-dialog';
import { useSidebar } from '@/components/ui/sidebar';
import { SourcesSidebar } from './sources-sidebar';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMessagesStarted, setIsMessagesStarted] = useState(initialMessages.length > 0);
  const [selectedSources, setSelectedSources] = useState<string[]>(['general']);
  const [isMobile, setIsMobile] = useState(false);
  
  // Sources sidebar state
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [messagesSources, setMessagesSources] = useState<Record<string, any[]>>({});
  const pendingSourcesRef = useRef<any[] | null>(null);
  
  // Get sidebar state
  const { open: sidebarOpen } = useSidebar();

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  // Custom fetch function to intercept sources from headers
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log('customFetch called with:', { input, init });
    const response = await fetchWithErrorHandlers(input, init);
    
    // Check for sources in response headers
    const sourcesHeader = response.headers.get('X-Slack-Sources');
    console.log('Headers check:', { sourcesHeader: sourcesHeader ? sourcesHeader.substring(0, 50) + '...' : null });
    
    if (sourcesHeader) {
      try {
        // Use a safe base64 decode that works in all environments
        let sourcesJson: string;
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
          // Browser environment
          console.log('Using browser atob');
          sourcesJson = atob(sourcesHeader);
        } else {
          // Node.js or other environments - use Buffer
          console.log('Using Buffer.from');
          sourcesJson = Buffer.from(sourcesHeader, 'base64').toString('utf-8');
        }
        
        const sources = JSON.parse(sourcesJson);
        
        console.log('Successfully parsed sources from header:', { 
          count: sources.length, 
          sources: sources.slice(0, 2) // Log first 2 sources for debugging
        });
        
        // Store sources to be associated with the next assistant message
        if (sources.length > 0) {
          pendingSourcesRef.current = sources;
          console.log('Stored pending sources:', { count: pendingSourcesRef.current.length });
        }
      } catch (error) {
        console.error('Error parsing sources from headers:', error);
      }
    } else {
      console.log('No X-Slack-Sources header found');
    }
    
    return response;
  };

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
    isLoading,
    error,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: customFetch,
    api: '/api/chat',
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel: initialChatModel,
      selectedVisibilityType: visibilityType,
      selectedSources,
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      } else {
        // Handle other types of errors
        toast({
          type: 'error',
          description: 'An error occurred. Please try again.',
        });
      }
    },
  });

  // Auto-resize textarea as user types
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Initialize textarea height and adjust when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const searchParams = useSearchParams();
  const query = searchParams?.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = false; // Disabled artifact feature
  const artifactWidth = 0;

  // Handle file uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    const newAttachments: Attachment[] = [];
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const { url, pathname, contentType } = data;

          newAttachments.push({
            url,
            name: pathname,
            contentType,
          });
        } else {
          const { error } = await response.json();
          toast({
            type: 'error',
            description: error || 'Failed to upload file',
          });
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          type: 'error',
          description: 'Failed to upload file',
        });
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // When messages are added, update the state to show we have messages
  useEffect(() => {
    if (messages.length > 0 && !isMessagesStarted) {
      setIsMessagesStarted(true);
    }
  }, [messages.length, isMessagesStarted]);

  // Handle input submission
  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() || attachments.length > 0) {
      // Close sources sidebar when new message is sent
      setSourcesOpen(false);
      
      handleSubmit(e, {
        experimental_attachments: attachments
      });
      setAttachments([]);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Function to handle sources from ViewSourcesButton
  const handleViewSources = (sources: any[]) => {
    // If sources sidebar is already open with the same sources, close it
    if (sourcesOpen && JSON.stringify(currentSources) === JSON.stringify(sources)) {
      setSourcesOpen(false);
    } else {
      // Otherwise, open with new sources
      setCurrentSources(sources);
      setSourcesOpen(true);
    }
  };

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, append, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  useAutoResume({
    autoResume,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Associate pending sources with new assistant messages
  useEffect(() => {
    console.log('useEffect for sources association triggered:', {
      hasPendingSources: !!pendingSourcesRef.current,
      pendingSourcesCount: pendingSourcesRef.current?.length || 0,
      messagesLength: messages.length,
      lastMessage: messages.length > 0 ? {
        id: messages[messages.length - 1].id,
        role: messages[messages.length - 1].role,
        hasContent: messages[messages.length - 1].parts?.some(p => p.type === 'text' && p.text.trim().length > 0)
      } : null,
      messagesSources: Object.keys(messagesSources).length
    });
    
    if (pendingSourcesRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log('Checking last message for sources association:', { 
        messageId: lastMessage.id, 
        role: lastMessage.role, 
        alreadyHasSources: !!messagesSources[lastMessage.id],
        hasRealSources: messagesSources[lastMessage.id]?.some(s => !s.messageId.startsWith('placeholder-'))
      });
      
      // Associate sources with assistant messages that don't already have real sources
      if (lastMessage.role === 'assistant' && !messagesSources[lastMessage.id]?.some(s => !s.messageId.startsWith('placeholder-'))) {
        console.log('✅ Associating sources with message:', lastMessage.id, {
          sourceCount: pendingSourcesRef.current.length,
          firstSource: pendingSourcesRef.current[0]?.messageId
        });
        setMessagesSources(prev => ({
          ...prev,
          [lastMessage.id]: pendingSourcesRef.current!
        }));
        pendingSourcesRef.current = null; // Clear pending sources
      } else {
        console.log('❌ Skipping sources association:', {
          isAssistant: lastMessage.role === 'assistant',
          hasRealSources: messagesSources[lastMessage.id]?.some(s => !s.messageId.startsWith('placeholder-'))
        });
      }
    }
  }, [messages, messagesSources]);

  // Handle pending sources when streaming completes
  useEffect(() => {
    if (pendingSourcesRef.current && (status === 'ready' || status === 'error') && messages.length > 0) {
      console.log('🔄 Checking for pending sources on status change:', { 
        status, 
        pendingCount: pendingSourcesRef.current.length,
        messagesLength: messages.length 
      });
      
      const lastAssistantMessage = messages.slice().reverse().find(m => m.role === 'assistant');
      if (lastAssistantMessage && !messagesSources[lastAssistantMessage.id]?.some(s => !s.messageId.startsWith('placeholder-'))) {
        console.log('✅ Associating pending sources on stream completion:', lastAssistantMessage.id, {
          sourceCount: pendingSourcesRef.current.length
        });
        setMessagesSources(prev => ({
          ...prev,
          [lastAssistantMessage.id]: pendingSourcesRef.current!
        }));
        pendingSourcesRef.current = null;
      } else {
        console.log('❌ No suitable message for pending sources on completion');
      }
    }
  }, [status, messages, messagesSources]);

  return (
    <>
      <div 
        className="flex flex-col min-w-0 h-dvh relative transition-all duration-300"
        style={{
          marginRight: sourcesOpen ? '384px' : '0', // 384px = w-96 width
        }}
      >
        {!isMessagesStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
            <div className="w-full max-w-xl mx-auto">
              <h2 className="text-xl font-medium text-[#111827] dark:text-[#F5F5F7] mb-2 text-center">
                Ask me anything
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#8A8A8E] mb-6 text-center">
                I can help with information, explanations, and creative ideas
              </p>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border-2 border-[#E5E7EB] dark:border-[#3A3A3C] focus-within:border-[#0A84FF] dark:focus-within:border-[#0A84FF] transition-colors p-3 bg-white dark:bg-[#1C1C1E] shadow-sm"
              >
                <form onSubmit={handleMessageSubmit} className="flex flex-col">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      adjustTextareaHeight();
                    }}
                    placeholder="What would you like to know?"
                    className="w-full resize-none bg-transparent text-[#111827] dark:text-[#F5F5F7] placeholder-[#6B7280] dark:placeholder-[#8A8A8E] outline-none min-h-[40px] max-h-[120px] text-sm py-2 text-left"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleMessageSubmit(e);
                      }
                    }}
                  />
                  
                  {/* Display attachments if any */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 mb-2">
                      {attachments.map((attachment, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-1 bg-[#F3F4F6] dark:bg-[#2C2C2E] text-xs px-2 py-1 rounded-md"
                        >
                          <span className="truncate max-w-[150px]">{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                            className="text-[#6B7280] hover:text-[#111827] dark:text-[#8A8A8E] dark:hover:text-[#F5F5F7]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <SourceDialog onSourcesChange={setSelectedSources} />
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                      />
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors p-1.5 rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2C2C2E]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Only show send or stop button, not both */}
                    {(status === 'streaming' || status === 'submitted') ? (
                      <button
                        type="button"
                        onClick={stop}
                        className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors ml-2"
                        title="Stop generation"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <rect x="6" y="6" width="12" height="12" rx="2"/>
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading || (!input.trim() && attachments.length === 0)}
                        className={`
                          p-2 rounded-full transition-colors
                          ${isLoading || (!input.trim() && attachments.length === 0)
                            ? 'bg-[#E5E7EB] dark:bg-[#3A3A3C] text-[#9CA3AF] dark:text-[#6E6E73] cursor-not-allowed' 
                            : 'bg-[#0A84FF] hover:bg-[#0077FF] text-white cursor-pointer'
                          }
                        `}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Messages
              chatId={id}
              status={status}
              votes={votes}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
              append={append}
              onViewSources={handleViewSources}
              messagesSources={messagesSources}
              sourcesOpen={sourcesOpen}
              currentSources={currentSources}
            />
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Input container - only shown when messages exist */}
        {isMessagesStarted && (
          <div 
            className="fixed bottom-0 z-20 flex justify-center items-end p-4 transition-all duration-300"
            style={{
              left: isMobile ? '0' : (sidebarOpen ? '280px' : '72px'),
              right: sourcesOpen ? '384px' : '0', // Account for sources sidebar
              width: isMobile 
                ? (sourcesOpen ? 'calc(100% - 384px)' : '100%')
                : (sidebarOpen 
                    ? (sourcesOpen ? 'calc(100% - 280px - 384px)' : 'calc(100% - 280px)')
                    : (sourcesOpen ? 'calc(100% - 72px - 384px)' : 'calc(100% - 72px)')
                  ),
            }}
          >
            <div className="w-full max-w-4xl mx-auto px-4">
              <form onSubmit={handleMessageSubmit} className="relative w-full">
              <div className="rounded-xl border-2 border-[#E5E7EB] dark:border-[#3A3A3C] focus-within:border-[#0A84FF] dark:focus-within:border-[#0A84FF] transition-colors p-3 bg-white dark:bg-[#1C1C1E] shadow-lg backdrop-blur-sm">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    adjustTextareaHeight();
                  }}
                  placeholder="Ask me anything..."
                  className="w-full resize-none bg-transparent text-[#111827] dark:text-[#F5F5F7] placeholder-[#6B7280] dark:placeholder-[#8A8A8E] outline-none min-h-[40px] max-h-[120px] text-sm py-2 text-left"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleMessageSubmit(e);
                    }
                  }}
                />
                
                {/* Display attachments if any */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 mb-2">
                    {attachments.map((attachment, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-1 bg-[#F3F4F6] dark:bg-[#3A3A3E] text-xs px-2 py-1 rounded-md"
                      >
                        <span className="truncate max-w-[150px]">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                          className="text-[#6B7280] hover:text-[#111827] dark:text-[#8A8A8E] dark:hover:text-[#F5F5F7]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <SourceDialog onSourcesChange={setSelectedSources} />
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors p-1.5 rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2C2C2E]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Only show send or stop button, not both */}
                  {(status === 'streaming' || status === 'submitted') ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors ml-2"
                      title="Stop generation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoading || (!input.trim() && attachments.length === 0)}
                      className={`
                        p-2 rounded-full transition-colors
                        ${isLoading || (!input.trim() && attachments.length === 0)
                          ? 'bg-[#E5E7EB] dark:bg-[#3A3A3C] text-[#9CA3AF] dark:text-[#6E6E73] cursor-not-allowed' 
                          : 'bg-[#0A84FF] hover:bg-[#0077FF] text-white cursor-pointer'
                        }
                      `}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Sources Sidebar */}
      <SourcesSidebar
        sources={currentSources}
        isOpen={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />

      {/* Artifact feature disabled */}
    </>
  );
}
