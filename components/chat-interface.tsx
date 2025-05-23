"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInterfaceProps {
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  initialMessages = [],
  className = '',
}) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    initialMessages,
  });
  
  const [sourceDropdown, setSourceDropdown] = useState("All Sources");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle custom form submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSubmit(e);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF9F9] dark:bg-[#1E1E20]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="max-w-md w-full">
              {/* Centered greeting when no messages */}
              <h2 className="text-xl font-medium text-[#111827] dark:text-[#F5F5F7] mb-2 text-center">
                Ask me anything
              </h2>
              <p className="text-sm text-[#6B7280] dark:text-[#8A8A8E] mb-6 text-center">
                I can help with information, explanations, and creative ideas
              </p>
              
              {/* Centered input area when no messages */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-xl border-2 border-[#E5E7EB] dark:border-[#3A3A3C] focus-within:border-[#0A84FF] dark:focus-within:border-[#0A84FF] transition-colors p-3 bg-white dark:bg-[#2C2C2E] shadow-sm"
              >
                <form onSubmit={handleFormSubmit} className="flex flex-col">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    placeholder="What would you like to know?"
                    className="w-full resize-none bg-transparent text-[#111827] dark:text-[#F5F5F7] placeholder-[#6B7280] dark:placeholder-[#8A8A8E] outline-none min-h-[40px] max-h-[120px] text-sm py-2"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleFormSubmit(e);
                      }
                    }}
                  />
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 bg-[#F3F4F6] dark:bg-[#2C2C2E] text-[#111827] dark:text-[#F5F5F7] text-xs px-2.5 py-1.5 rounded-full hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3C] transition-colors"
                        onClick={() => setSourceDropdown(current => current === "All Sources" ? "Web" : "All Sources")}
                      >
                        <span>{sourceDropdown}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      
                      <button
                        type="button"
                        className="text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors p-1.5 rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2C2C2E]"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className={`
                        p-2 rounded-full transition-colors
                        ${isLoading || !input.trim() 
                          ? 'bg-[#E5E7EB] dark:bg-[#3A3A3C] text-[#9CA3AF] dark:text-[#6E6E73] cursor-not-allowed' 
                          : 'bg-[#0A84FF] hover:bg-[#0077FF] text-white cursor-pointer'
                        }
                      `}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages when conversation has started */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`
                    max-w-[80%] p-4 rounded-2xl shadow-sm
                    ${message.role === 'user' 
                      ? 'bg-[#E5F1FF] text-[#111827] dark:bg-[#0A3A6D] dark:text-[#F5F5F7]' 
                      : 'bg-white dark:bg-[#2C2C2E] text-[#111827] dark:text-[#F5F5F7]'
                    }
                    ${message.role === 'assistant' ? 'rounded-tl-md' : 'rounded-tr-md'}
                  `}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5AC8FA] flex items-center justify-center mr-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 16V12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 8H12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">Lumos AI</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-4 rounded-2xl rounded-tl-md bg-white dark:bg-[#2C2C2E] text-[#111827] dark:text-[#F5F5F7] shadow-sm">
                  <div className="flex items-center mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5AC8FA] flex items-center justify-center mr-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 16V12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 8H12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">Lumos AI</span>
                  </div>
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#8A8A8E] dark:bg-[#8A8A8E] animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-[#8A8A8E] dark:bg-[#8A8A8E] animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#8A8A8E] dark:bg-[#8A8A8E] animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input area - only shown when messages exist */}
      {messages.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-[#1C1C1E] px-4 py-3 border-t border-[#E5E7EB] dark:border-[#3A3A3C]"
        >
          <form onSubmit={handleFormSubmit} className="relative max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-xl border-2 border-[#E5E7EB] dark:border-[#3A3A3C] focus-within:border-[#0A84FF] dark:focus-within:border-[#0A84FF] transition-colors p-2">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask me anything..."
                  className="w-full resize-none bg-transparent text-[#111827] dark:text-[#F5F5F7] placeholder-[#6B7280] dark:placeholder-[#8A8A8E] outline-none min-h-[40px] max-h-[120px] text-sm py-2"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleFormSubmit(e);
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center gap-2 py-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 bg-[#F3F4F6] dark:bg-[#2C2C2E] text-[#111827] dark:text-[#F5F5F7] text-xs px-2.5 py-1.5 rounded-full hover:bg-[#E5E7EB] dark:hover:bg-[#3A3A3C] transition-colors"
                    onClick={() => setSourceDropdown(current => current === "All Sources" ? "Web" : "All Sources")}
                  >
                    <span>{sourceDropdown}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  
                  <button
                    type="button"
                    className="text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors p-1.5 rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2C2C2E]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={`
                    p-2 rounded-full transition-colors
                    ${isLoading || !input.trim() 
                      ? 'bg-[#E5E7EB] dark:bg-[#3A3A3C] text-[#9CA3AF] dark:text-[#6E6E73] cursor-not-allowed' 
                      : 'bg-[#0A84FF] hover:bg-[#0077FF] text-white cursor-pointer'
                    }
                  `}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default ChatInterface; 