import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { getChatsByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const limit = Number.parseInt(searchParams.get('limit') || '10');
    const startingAfter = searchParams.get('starting_after');
    const endingBefore = searchParams.get('ending_before');

    if (startingAfter && endingBefore) {
      return new ChatSDKError(
        'bad_request:api',
        'Only one of starting_after or ending_before can be provided.',
      ).toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    try {
      const chats = await getChatsByUserId({
        id: session.user.id,
        limit,
        startingAfter,
        endingBefore,
      });

      return Response.json(chats);
    } catch (dbError) {
      console.error('Database error in history route:', dbError);
      // Return empty result instead of error
      return Response.json({ chats: [], hasMore: false });
    }
  } catch (error) {
    console.error('Unhandled error in history route:', error);
    return Response.json(
      { error: 'Failed to retrieve history' },
      { status: 500 }
    );
  }
}
