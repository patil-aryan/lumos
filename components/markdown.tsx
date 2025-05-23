import Link from 'next/link';
import React, { memo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CopyIcon = ({ copied }: { copied: boolean }) => (
  copied ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
  )
);

const TableWrapper = ({ node, children, ...props }: any) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyTableAsMarkdown = () => {
    let markdownTable = '';
    const tableElement = node;

    if (tableElement && tableElement.children) {
      tableElement.children.forEach((row: any, rowIndex: number) => {
        if (row.tagName === 'thead' || row.tagName === 'tbody') {
          row.children.forEach((tr: any) => {
            if (tr.tagName === 'tr') {
              const rowValues = tr.children.map((cell: any) => {
                if (cell.children && Array.isArray(cell.children)) {
                  return cell.children.map((c: any) => c.value || '').join('');
                }
                return '';
              });
              markdownTable += `| ${rowValues.join(' | ')} |\n`;
              if (rowIndex === 0 && row.tagName === 'thead') {
                markdownTable += `| ${rowValues.map(() => '---').join(' | ')} |\n`;
              }
            }
          });
        }
      });
    }

    navigator.clipboard.writeText(markdownTable.trim()).then(() => {
      setIsCopied(true);
      toast.success('Table copied as Markdown!');
      setTimeout(() => setIsCopied(false), 2000);
    }, (err) => {
      toast.error('Failed to copy table');
      console.error('Failed to copy table: ', err);
    });
  };

  return (
    <div className="relative group my-4 max-w-full">
      <button
        onClick={copyTableAsMarkdown}
        className="absolute -top-8 right-0 p-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-10"
      >
        <CopyIcon copied={isCopied} />
        {isCopied ? 'Copied!' : 'Copy Table'}
      </button>
      <div className="overflow-x-auto border border-zinc-700 rounded-lg bg-zinc-900 max-w-full">
        <table {...props} className="min-w-full divide-y divide-zinc-700 text-sm">
          {children}
        </table>
      </div>
    </div>
  );
};

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => (
    <div className="overflow-x-auto">
      {children}
    </div>
  ),
  table: TableWrapper,
  thead: ({ node, children, ...props }) => <thead className="bg-zinc-800 dark:bg-zinc-700" {...props}>{children}</thead>,
  tbody: ({ node, children, ...props }) => <tbody className="divide-y divide-zinc-700 dark:divide-zinc-600 bg-zinc-900 dark:bg-zinc-800" {...props}>{children}</tbody>,
  tr: ({ node, children, ...props }) => <tr className="hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors" {...props}>{children}</tr>,
  th: ({ node, children, ...props }) => <th scope="col" className="px-4 py-2.5 text-left font-medium text-zinc-300 dark:text-zinc-200 tracking-wider" {...props}>{children}</th>,
  td: ({ node, children, ...props }) => <td className="px-4 py-2.5 whitespace-nowrap text-zinc-400 dark:text-zinc-300" {...props}>{children}</td>,
  p: ({ node, children, ...props }) => {
    return (
      <div className="my-2 text-foreground dark:text-zinc-200" {...props}>
        {children}
      </div>
    );
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4 text-foreground dark:text-zinc-200" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1 text-foreground dark:text-zinc-200" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-disc list-outside ml-4 text-foreground dark:text-zinc-200" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold text-foreground dark:text-zinc-100" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2 text-foreground dark:text-zinc-100" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];

interface MarkdownProps {
  children: string;
  className?: string;
  remarkPlugins?: Array<any>;
}

const NonMemoizedMarkdown = ({ children, className, remarkPlugins: customPlugins }: MarkdownProps) => {
  const plugins = customPlugins || remarkPlugins;
  
  return (
    <ReactMarkdown 
      className={className} 
      remarkPlugins={plugins} 
      rehypePlugins={[rehypeHighlight]} 
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => 
    prevProps.children === nextProps.children && 
    prevProps.className === nextProps.className
);
