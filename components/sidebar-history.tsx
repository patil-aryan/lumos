'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { ChatItem } from './sidebar-history-item';
import useSWRInfinite from 'swr/infinite';
import { LoaderIcon } from './icons';

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/history?limit=${PAGE_SIZE}`;

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

// Simplified component for the new dropdown-based approach
export function SidebarHistory({ user }: { user: User | undefined }) {
  const params = useParams();
  const id = params?.id as string;

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-2">
        <div className="text-xs text-muted-foreground/60">
          Sign in to view history
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="rounded-lg h-8 bg-muted/20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <div className="text-center py-2">
        <div className="text-xs text-muted-foreground/60">
          No conversations yet
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {paginatedChatHistories &&
          (() => {
            const chatsFromHistory = paginatedChatHistories.flatMap(
              (paginatedChatHistory) => paginatedChatHistory.chats,
            );

            const groupedChats = groupChatsByDate(chatsFromHistory);

            return (
              <>
                {groupedChats.today.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground/50 px-1">
                      Today
                    </div>
                    {groupedChats.today.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={() => {}}
                      />
                    ))}
                  </div>
                )}

                {groupedChats.yesterday.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground/50 px-1">
                      Yesterday
                    </div>
                    {groupedChats.yesterday.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={() => {}}
                      />
                    ))}
                  </div>
                )}

                {groupedChats.lastWeek.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground/50 px-1">
                      Last 7 days
                    </div>
                    {groupedChats.lastWeek.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={() => {}}
                      />
                    ))}
                  </div>
                )}

                {groupedChats.lastMonth.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground/50 px-1">
                      Last 30 days
                    </div>
                    {groupedChats.lastMonth.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={() => {}}
                      />
                    ))}
                  </div>
                )}

                {groupedChats.older.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground/50 px-1">
                      Older
                    </div>
                    {groupedChats.older.map((chat) => (
                      <ChatItem
                        key={chat.id}
                        chat={chat}
                        isActive={chat.id === id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
      </div>

      <motion.div
        onViewportEnter={() => {
          if (!isValidating && !hasReachedEnd) {
            setSize((size) => size + 1);
          }
        }}
      />

      {hasReachedEnd ? (
        <div className="text-center py-2">
          <div className="text-xs text-muted-foreground/40">
            End of history
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="animate-spin">
            <LoaderIcon size={10} />
          </div>
          <div className="text-xs text-muted-foreground/50">Loading...</div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
