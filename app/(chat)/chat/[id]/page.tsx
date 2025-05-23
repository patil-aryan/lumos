import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { DBMessage } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import { isDevelopmentEnvironment } from '@/lib/constants';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  // In development with auth bypass, create a mock session to avoid redirects
  if (!session && !isDevelopmentEnvironment) {
    redirect('/api/auth/guest');
  }

  // Create a fallback session for development when auth is bypassed
  const effectiveSession = session || (isDevelopmentEnvironment ? {
    user: { id: 'dev-user', email: 'dev@example.com', type: 'guest' as const }
  } : null);

  if (!effectiveSession) {
    redirect('/api/auth/guest');
  }

  if (chat.visibility === 'private') {
    if (!effectiveSession.user) {
      return notFound();
    }

    if (effectiveSession.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      // Note: content will soon be deprecated in @ai-sdk/react
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          id={chat.id}
          initialMessages={convertToUIMessages(messagesFromDb)}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType={chat.visibility}
          isReadonly={effectiveSession?.user?.id !== chat.userId}
          session={effectiveSession}
          autoResume={true}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        initialChatModel={chatModelFromCookie.value}
        initialVisibilityType={chat.visibility}
        isReadonly={effectiveSession?.user?.id !== chat.userId}
        session={effectiveSession}
        autoResume={true}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
