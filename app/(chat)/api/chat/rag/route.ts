import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { slackWorkspace } from '@/lib/db/schema';
import { findSimilarSlackMessages } from '@/lib/ai/embeddings';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

interface RAGChatRequest {
  message: string;
  workspaceId: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface SlackSource {
  messageId: string;
  content: string;
  channelName: string;
  userName: string;
  timestamp: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, workspaceId, conversationHistory = [] }: RAGChatRequest = await request.json();

    if (!message || !workspaceId) {
      return NextResponse.json({ 
        error: 'Message and workspace ID are required' 
      }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== session.user.id) {
      return NextResponse.json({ 
        error: 'Workspace not found or unauthorized' 
      }, { status: 404 });
    }

    // Find relevant Slack messages using vector search
    const similarMessages = await findSimilarSlackMessages(
      message,
      workspaceId,
      5, // limit
      0.7 // similarity threshold
    );

    // Prepare context from Slack messages
    const slackContext = similarMessages.map((msg, index) => {
      const contextInfo = msg.contextInfo;
      return `[Source ${index + 1}] Channel: #${contextInfo.channelName} | User: ${contextInfo.userName} | Time: ${new Date(parseInt(contextInfo.timestamp) * 1000).toLocaleString()}
Message: ${msg.content}`;
    }).join('\n\n');

    // Prepare sources for response
    const sources: SlackSource[] = similarMessages.map((msg, index) => ({
      messageId: msg.messageId,
      content: msg.content,
      channelName: msg.contextInfo.channelName,
      userName: msg.contextInfo.userName,
      timestamp: msg.contextInfo.timestamp,
      similarity: msg.similarity,
    }));

    // Create system prompt with Slack context
    const systemPrompt = `You are a helpful AI assistant that answers questions based on Slack workspace messages. 

IMPORTANT INSTRUCTIONS:
1. Only use information from the provided Slack messages to answer questions
2. If the provided context doesn't contain relevant information, say "I don't have enough information from the Slack messages to answer that question"
3. When referencing information, cite the source using [Source X] format
4. Be concise and helpful
5. If multiple sources contain similar information, mention all relevant sources

SLACK CONTEXT:
${slackContext || 'No relevant Slack messages found for this query.'}

Current date: ${new Date().toLocaleDateString()}`;

    // Prepare conversation messages
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Generate streaming response
    const result = streamText({
      model: openai('gpt-4o'),
      messages,
      temperature: 0.1, // Lower temperature for more factual responses
      maxTokens: 1000,
    });

    // Create a custom response that includes sources
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send the sources metadata
          const sourcesData = JSON.stringify({ 
            type: 'sources', 
            sources: sources.length > 0 ? sources : null 
          });
          controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`));

          // Then stream the AI response
          for await (const chunk of result.textStream) {
            const data = JSON.stringify({ type: 'text', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('RAG chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process RAG chat request' },
      { status: 500 }
    );
  }
}

// GET endpoint to test RAG search without generating a response
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const workspaceId = searchParams.get('workspaceId');

    if (!query || !workspaceId) {
      return NextResponse.json({ 
        error: 'Query and workspace ID are required' 
      }, { status: 400 });
    }

    // Verify workspace ownership
    const workspace = await db
      .select()
      .from(slackWorkspace)
      .where(eq(slackWorkspace.id, workspaceId))
      .limit(1);

    if (!workspace.length || workspace[0].userId !== session.user.id) {
      return NextResponse.json({ 
        error: 'Workspace not found or unauthorized' 
      }, { status: 404 });
    }

    // Find similar messages
    const similarMessages = await findSimilarSlackMessages(
      query,
      workspaceId,
      10, // More results for testing
      0.5  // Lower threshold for testing
    );

    return NextResponse.json({
      query,
      results: similarMessages.map(msg => ({
        messageId: msg.messageId,
        content: msg.content,
        context: msg.contextInfo,
        similarity: msg.similarity,
      })),
    });

  } catch (error) {
    console.error('RAG search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Slack messages' },
      { status: 500 }
    );
  }
} 