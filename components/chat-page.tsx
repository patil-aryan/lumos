"use client";

import React from 'react';
import ChatInterface from '@/components/chat-interface';

// Common prompt suggestions
const PROMPT_SUGGESTIONS = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
        <path d="M7 21h10" />
        <path d="M19 6c0-1.7-1.3-3-3-3h-8c-1.7 0-3 1.3-3 3v3h14V6Z" />
      </svg>
    ),
    title: "Explain a concept",
    description: "Get a simple explanation on any topic"
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    title: "Summarize text",
    description: "Create concise summaries of longer documents"
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    title: "Compare options",
    description: "Analyze differences between multiple choices"
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
    title: "Creative ideas",
    description: "Get inspiration for your next project"
  }
];

interface ChatPageProps {
  className?: string;
}

export const ChatPage: React.FC<ChatPageProps> = ({ className = '' }) => {
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="flex-1 overflow-auto bg-[#FAF9F9] dark:bg-[#1C1C1E]">
        <div className="max-w-4xl mx-auto px-6">
          {/* Prompt suggestions - visible when user hasn't started a conversation */}
          <div className="pt-8 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PROMPT_SUGGESTIONS.map((prompt, index) => (
                <div 
                  key={index}
                  className="p-4 bg-white dark:bg-[#1C1C1E] rounded-xl border border-[#E5E7EB] dark:border-[#3A3A3C] hover:border-[#0A84FF] dark:hover:border-[#0A84FF] transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-[#6B7280] dark:text-[#8A8A8E] group-hover:text-[#0A84FF] dark:group-hover:text-[#0A84FF] transition-colors">
                      {prompt.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-[#111827] dark:text-[#F5F5F7] group-hover:text-[#0A84FF] dark:group-hover:text-[#0A84FF] transition-colors">
                        {prompt.title}
                      </h3>
                      <p className="text-sm text-[#6B7280] dark:text-[#8A8A8E]">
                        {prompt.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-4 text-sm flex items-center text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors">
              <span>Refresh prompts</span>
              <svg className="ml-1 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </button>
          </div>
          
          {/* Chat interface - takes full height of the container */}
          <div className="h-[calc(100vh-270px)] relative">
            <ChatInterface className="h-full" />
          </div>
          
          {/* Footer disclaimer */}
          <div className="mt-4 pb-4 text-xs text-[#6E6E73] dark:text-[#6E6E73] text-center">
            Lumos may display inaccurate info, including about people, places, or facts.
            <a href="#" className="ml-1 text-[#6B7280] dark:text-[#8A8A8E] hover:text-[#0A84FF] dark:hover:text-[#0A84FF] transition-colors">
              Your Privacy & Lumos AI
            </a>
          </div>
        </div>
      </div>
      
      {/* Status indicator - optional */}
      <div className="fixed bottom-4 right-4">
        <div className="flex items-center bg-[rgba(255,69,58,0.15)] dark:bg-[#5A1D1A] text-[#FF453A] dark:text-[#FF453A] px-3 py-1.5 rounded-full text-sm cursor-pointer hover:bg-[rgba(255,69,58,0.2)] dark:hover:bg-[#671F1A] transition-colors">
          <div className="w-5 h-5 bg-[#FF453A] rounded-full flex items-center justify-center text-white mr-2">
            <span className="text-xs">1</span>
          </div>
          <span>Issue</span>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 