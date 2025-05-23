import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { isDevelopmentEnvironment } from '@/lib/constants';

export default async function Page() {
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

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          session={effectiveSession}
          autoResume={false}
        />
        <DataStreamHandler id={id} />
      </>
    );
  }

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={effectiveSession}
        autoResume={false}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
