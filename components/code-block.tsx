'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}

export function CodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    const codeString = String(children).replace(/\n$/, ''); // Remove trailing newline
    navigator.clipboard.writeText(codeString).then(() => {
      setIsCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    }, (err) => {
      toast.error('Failed to copy code');
      console.error('Failed to copy code: ', err);
    });
  };

  if (!inline) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    return (
      <div className="relative group my-2">
        <button 
          onClick={copyToClipboard}
          className="absolute top-2 right-2 p-1.5 bg-zinc-700 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-zinc-300 hover:text-white dark:text-zinc-200 dark:hover:text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1"
        >
          {isCopied ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
          )}
          {isCopied ? 'Copied!' : 'Copy'}
        </button>
        {language && (
          <span className="absolute top-2 left-2 bg-zinc-700 dark:bg-zinc-600 text-zinc-300 dark:text-zinc-200 text-xs px-2 py-0.5 rounded-md">
            {language}
          </span>
        )}
        <code 
          {...props}
          className={`block text-sm w-full overflow-x-auto bg-zinc-900 dark:bg-zinc-800 p-4 pt-10 border border-zinc-700 dark:border-zinc-600 rounded-xl text-zinc-50 dark:text-zinc-100 whitespace-pre-wrap break-words`}
        >
          {children}
        </code>
      </div>
    );
  } else {
    return (
      <code
        className={`${className} text-sm bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
      </code>
    );
  }
}
