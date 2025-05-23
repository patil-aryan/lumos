'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: string;
  isReadonly: boolean;
  session: any;
}) {
  return (
    <motion.header 
      className="flex sticky top-0 z-10 bg-white dark:bg-zinc-900 py-3 items-center px-4 border-b border-zinc-200 dark:border-zinc-800"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Empty header for now */}
    </motion.header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});
