import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
// Removed generateCode import - using direct code generation instead
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      // Only attempt to create resumable stream context if REDIS_URL is defined
      if (process.env.REDIS_URL) {
        globalStreamContext = createResumableStreamContext({
          waitUntil: after,
        });
      } else {
        console.log(
          ' > Resumable streams are using in-memory fallback due to missing REDIS_URL',
        );
        // Use a simpler context without Redis
        globalStreamContext = {
          resumableStream: async (id, getStream) => {
            const stream = await getStream();
            return stream;
          }
        } as ResumableStreamContext;
      }
    } catch (error: any) {
      console.error('Failed to initialize stream context:', error);
      // Fallback to a simple context
      globalStreamContext = {
        resumableStream: async (id, getStream) => {
          const stream = await getStream();
          return stream;
        }
      } as ResumableStreamContext;
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType, selectedSources = ['all'] } =
      requestBody;

    console.log('Request received with sources:', selectedSources);

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // Skip rate limiting in development environment
    if (process.env.NODE_ENV !== 'development') {
      // Get message count but handle potential database errors gracefully
      let messageCount = 0;
      try {
        messageCount = await getMessageCountByUserId({
          id: session.user.id,
          differenceInHours: 24,
        });
      } catch (countError) {
        console.error('Error getting message count, defaulting to 0:', countError);
        // Continue with messageCount = 0
      }

      if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse();
      }
    } else {
      console.log('Development mode: skipping rate limiting');
    }

    let existingChat = false;
    let chat = null;
    
    try {
      chat = await getChatById({ id });
    } catch (chatError) {
      console.error('Error retrieving chat:', chatError);
      // Proceed with chat = null
    }

    if (!chat) {
      // Chat doesn't exist, create a new one
      try {
        let title = 'New Conversation';
        
        try {
          title = await generateTitleFromUserMessage({ message }) || title;
        } catch (titleError) {
          console.error('Failed to generate title:', titleError);
          // Continue with default title
        }
        
        try {
          await saveChat({
            id,
            userId: session.user.id,
            title,
            visibility: selectedVisibilityType,
          });
        } catch (saveChatError) {
          console.error('Failed to save chat:', saveChatError);
          // Continue without saving chat - this might cause issues but we'll try
        }
      } catch (chatCreationError) {
        console.error('Failed in chat creation flow:', chatCreationError);
        // Continue anyway and hope for the best
      }
    } else {
      existingChat = true;
      // Only check user ID if chat exists and has a userId property
      if (chat && typeof chat.userId === 'string' && chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    // Get previous messages with error handling
    let previousMessages: any[] = [];
    try {
      previousMessages = await getMessagesByChatId({ id });
    } catch (messagesError) {
      console.error('Failed to retrieve previous messages:', messagesError);
      // Continue with empty messages array
    }

    const messages = appendClientMessage({
      messages: previousMessages,
      message,
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Save the user message
    try {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: 'user',
            parts: message.parts,
            attachments: message.experimental_attachments ?? [],
            createdAt: new Date(),
          },
        ],
      });
    } catch (error) {
      console.error('Failed to save user message:', error);
      // Continue even if saving fails - we'll try to generate a response anyway
    }

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Create a system message that includes information about selected sources
    const systemMessage = getSystemPromptWithSources(selectedSources, selectedChatModel, requestHints);

    // Create the streaming response
    try {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemMessage,
        messages,
        maxSteps: 5,
        experimental_activeTools:
          selectedChatModel === 'chat-model-reasoning'
            ? []
            : [
                'getWeather',
              ],
        experimental_generateMessageId: generateUUID,
        tools: {
          getWeather,
        },
        onFinish: async ({ response }) => {
          if (session.user?.id) {
            try {
              const assistantId = getTrailingMessageId({
                messages: response.messages.filter(
                  (message) => message.role === 'assistant',
                ),
              });

              if (!assistantId) {
                throw new Error('No assistant message found!');
              }

              const [, assistantMessage] = appendResponseMessages({
                messages: [message],
                responseMessages: response.messages,
              });

              await saveMessages({
                messages: [
                  {
                    id: assistantId,
                    chatId: id,
                    role: assistantMessage.role,
                    parts: assistantMessage.parts,
                    attachments:
                      assistantMessage.experimental_attachments ?? [],
                    createdAt: new Date(),
                  },
                ],
              });
            } catch (error) {
              console.error('Failed to save assistant message:', error);
            }
          }
        },
        experimental_telemetry: {
          isEnabled: isProductionEnvironment,
          functionId: 'stream-text',
        },
        experimental_transform: smoothStream({ chunking: 'word' }),
      });

      return result.toDataStreamResponse();
    } catch (error) {
      console.error('Failed to create stream:', error);
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new Response('Internal Server Error: Failed to process request', { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Unhandled error in chat API:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    // Fallback for unhandled errors with more detailed message
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Helper function to create a system prompt that includes information about selected sources
function getSystemPromptWithSources(
  selectedSources: string[],
  selectedChatModel: string,
  requestHints: RequestHints
): string {
  let basePrompt = systemPrompt({ selectedChatModel, requestHints });
  
  // If 'all' is not selected, append information about which sources to use
  if (!selectedSources.includes('all')) {
    basePrompt += `\n\nImportant: When answering, only use information from the following sources: ${selectedSources.join(', ')}.`;
  }
  
  return basePrompt;
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat | null;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
