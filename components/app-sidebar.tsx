'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import Lottie from 'lottie-react';
import useSWRInfinite from 'swr/infinite';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarBody,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  DesktopSidebar,
  MobileSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ChevronRightIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { fetcher } from '@/lib/utils';
import type { Chat } from '@/lib/db/schema';
import { toast } from './toast';
import { cn } from '@/lib/utils';

// Enhanced Icons with better styling
const LightningIconRefined = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const SettingsIconRefined = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const MessageIconRefined = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const PlusIconRefined = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M5 12h14"/>
    <path d="M12 5v14"/>
  </svg>
);

const SunIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2"/>
    <path d="M12 20v2"/>
    <path d="M4.93 4.93l1.41 1.41"/>
    <path d="M17.66 17.66l1.41 1.41"/>
    <path d="M2 12h2"/>
    <path d="M20 12h2"/>
    <path d="M6.34 17.66l-1.41 1.41"/>
    <path d="M19.07 4.93l-1.41 1.41"/>
  </svg>
);

const MoonIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const MonitorIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const LogOutIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// Chat History Interface
interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

// SWR key function
function getChatHistoryKey(pageIndex: number, previousPageData: ChatHistory | null, user: User | undefined) {
  if (!user) return null;
  if (previousPageData && !previousPageData.hasMore) return null;
  return `/api/history?limit=5&page=${pageIndex}`;
}

// Enhanced Header Component
const SidebarHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col px-4 py-6">
    {children}
  </div>
);

// Enhanced Footer Component  
const SidebarFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-4 mt-auto border-t border-border/10">
    {children}
  </div>
);

// Redesigned Minimal New Chat Button
const NewChatButton = ({ onClick, isCollapsed }: { onClick: () => void; isCollapsed: boolean }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          onClick={onClick}
          className={cn(
            "group relative rounded-lg transition-all duration-200 ease-in-out flex items-center",
            isCollapsed 
              ? "w-10 h-10 p-0 justify-center" 
              : "w-full h-10 px-3 justify-start gap-3",
            "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50",
            "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
            "border border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300/50 dark:hover:border-slate-600/50",
            "shadow-sm hover:shadow-md"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Icon */}
          <div className="flex items-center justify-center">
            <PlusIconRefined size={16} />
          </div>
          
          {/* Text */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                New Chat
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" className="font-medium">
          New Chat
        </TooltipContent>
      )}
    </Tooltip>
  );
};

// Enhanced Collapsible Chat Section
const CollapsibleChatSection = ({ user }: { user?: User }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const router = useRouter();
  const { open: sidebarOpen, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  // Check if we're on a chat page
  const isChatActive = pathname ? (pathname === '/' || pathname.startsWith('/chat/')) : false;

  // Fetch recent chats
  const { data, error, size, setSize } = useSWRInfinite<ChatHistory>(
    (pageIndex, previousPageData) => getChatHistoryKey(pageIndex, previousPageData, user),
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  useEffect(() => {
    if (data) {
      const allChats = data.flatMap(page => page.chats);
      setRecentChats(allChats.slice(0, 5)); // Show only 5 recent chats
    }
  }, [data]);

  const formatChatTitle = (chat: Chat) => {
    return chat.title || 'Untitled Chat';
  };

  return (
    <div className="px-3 py-2">
      {/* Section Header - aligned with navigation items */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center h-12 px-3 rounded-xl transition-all duration-300 ease-in-out group/nav relative",
          !sidebarOpen && "justify-center",
          sidebarOpen && "justify-start gap-3",
          isChatActive 
            ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/50" 
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
        )}
      >
        <div className={cn(
          "flex-shrink-0 transition-transform duration-300",
          isChatActive ? "scale-110" : "group-hover/nav:scale-105"
        )}>
          <MessageIconRefined size={20} />
        </div>
        
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
              initial={{ opacity: 0, width: 0, x: -10 }}
              animate={{ opacity: 1, width: "auto", x: 0 }}
              exit={{ opacity: 0, width: 0, x: -10 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 0.6,
                delay: 0.05,
              }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden text-left"
              >
                Chats
              </motion.span>
            )}
          </AnimatePresence>
        
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="ml-auto"
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <ChevronRightIcon className="h-4 w-4 shrink-0" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      
      {/* Collapsible Recent Chats */}
      <AnimatePresence>
        {isOpen && sidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {user && recentChats.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="px-3 py-1">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Recent
                  </span>
                </div>
                {recentChats.map((chat) => {
                  const isActive = pathname === `/chat/${chat.id}`;
                  return (
                    <Link
                      key={chat.id}
                      href={`/chat/${chat.id}`}
                      onClick={() => setOpenMobile?.(false)}
                      className={cn(
                        "block w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group relative",
                        isActive 
                          ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                      )}
                    >
                      <div className="font-medium truncate">
                        {formatChatTitle(chat)}
                      </div>
                      {isActive && (
                        <motion.div
                          layoutId="activeChatIndicator"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Enhanced User Profile Component (fixed dropdown positioning)
const UserProfile = ({ user }: { user?: User }) => {
  const { theme, setTheme } = useTheme();
  const { open: sidebarOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user || !mounted) return null;

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      toast({
        type: 'error',
        description: 'Failed to sign out',
      });
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <SunIcon size={16} />;
      case 'dark':
        return <MoonIcon size={16} />;
      default:
        return <MonitorIcon size={16} />;
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 group",
          !sidebarOpen && "justify-center"
        )}>
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
          </div>
          
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex-1 text-left overflow-hidden"
              >
                <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {user.name || 'User'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.email}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        side="top"
        sideOffset={8}
        className="w-56 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-xl z-50"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b border-slate-200/50 dark:border-slate-800/50 mb-2">
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {user.name || 'User'}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {user.email}
          </div>
        </div>
        
        <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 cursor-pointer">
          <div className="flex items-center gap-2 flex-1">
            {getThemeIcon()}
            <span>Theme</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'light' ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <SunIcon size={14} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'dark' ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <MoonIcon size={14} />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'system' ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <MonitorIcon size={14} />
            </button>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-slate-200/50 dark:bg-slate-800/50" />
        
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOutIcon size={16} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Enhanced Logo Component with Original Lottie Animation
const EnhancedLogo = () => {
  const { open: sidebarOpen } = useSidebar();
  const router = useRouter();
  
  // Use the original animation data
  const originalAnimationData = require('../public/lottie/Animation - 1748017463409.json');

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <button 
      onClick={handleLogoClick}
      className={cn(
        "flex items-center gap-3 transition-all duration-300 hover:opacity-80 cursor-pointer",
        !sidebarOpen && "justify-center"
      )}
    >
      <div className="relative w-10 h-10 flex items-center justify-center">
        <Lottie
          animationData={originalAnimationData}
          loop={true}
          autoplay={true}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
          }}
          rendererSettings={{
            preserveAspectRatio: 'xMidYMid slice',
          }}
        />
      </div>
      
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Lumos
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

// Navigation Links (removed Home)
const navigationLinks = [
  {
    label: 'Integrations',
    href: '/integrations',
    icon: <LightningIconRefined size={20} />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <SettingsIconRefined size={20} />,
  },
];

// Main App Sidebar Component
export function AppSidebar({ user }: { user?: User }) {
  const { open, setOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const handleNewChat = () => {
    router.push('/');
  };

  return (
    <>
      <DesktopSidebar className="group bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-r border-slate-200/50 dark:border-slate-800/50">
        <SidebarBody className="flex flex-col h-full">
          {/* Header with Logo */}
          <SidebarHeader>
            <EnhancedLogo />
            
            {/* Subtle Separator */}
            <div className="mt-4 mb-4 border-b border-slate-200/30 dark:border-slate-700/30"></div>
            
            {/* New Chat Button */}
            <NewChatButton onClick={handleNewChat} isCollapsed={!open} />
          </SidebarHeader>

          {/* Chat Section with Navigation below it */}
          <SidebarGroup className="flex-1">
            <SidebarGroupContent>
              <CollapsibleChatSection user={user} />
              
              {/* Navigation Section - positioned right below chat with no gap */}
              <SidebarMenu className="space-y-2 px-3">
                {navigationLinks.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center h-12 px-3 rounded-xl transition-all duration-300 ease-in-out group/nav relative w-full",
                        !open && "justify-center",
                        open && "gap-3",
                        pathname === link.href
                          ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 transition-transform duration-300",
                        pathname === link.href ? "scale-110" : "group-hover/nav:scale-105"
                      )}>
                        {link.icon}
                      </div>
                      
                      <AnimatePresence>
                        {open && (
                          <motion.span
                            initial={{ opacity: 0, width: 0, x: -10 }}
                            animate={{ opacity: 1, width: "auto", x: 0 }}
                            exit={{ opacity: 0, width: 0, x: -10 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                              mass: 0.6,
                              delay: 0.05,
                            }}
                            className="text-sm font-medium whitespace-nowrap overflow-hidden"
                          >
                            {link.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Footer with User Profile */}
          <SidebarFooter>
            <UserProfile user={user} />
          </SidebarFooter>
        </SidebarBody>
      </DesktopSidebar>

      <MobileSidebar>
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className="px-4 py-6 border-b border-border/10">
            <EnhancedLogo />
            
            {/* Subtle Separator */}
            <div className="mt-4 mb-4 border-b border-slate-200/30 dark:border-slate-700/30"></div>
            
            {/* New Chat Button */}
            <NewChatButton onClick={handleNewChat} isCollapsed={false} />
          </div>

          {/* Mobile Navigation */}
          <div className="flex-1 px-4 py-4 space-y-6">
            <CollapsibleChatSection user={user} />
            
            <div className="space-y-2">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 h-12 px-3 rounded-xl transition-all duration-300 w-full",
                    pathname === link.href
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  {link.icon}
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile Footer */}
          <div className="px-4 py-4 border-t border-border/10">
            <UserProfile user={user} />
          </div>
        </div>
      </MobileSidebar>
    </>
  );
}

