import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cosineDistance, desc, gt, sql, eq, and } from 'drizzle-orm';
import { slackMessageEmbedding, slackMessage, type SlackMessage } from '../db/schema';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

const embeddingModel = openai.embedding('text-embedding-ada-002');

interface SlackMessageContext {
  messageId: string;
  workspaceId: string;
  channelName: string;
  userName: string;
  timestamp: string;
  threadTs?: string;
}

interface EmbeddingResult {
  messageId: string;
  content: string;
  contextInfo: SlackMessageContext;
  embedding: number[];
}

interface SimilarMessage {
  messageId: string;
  content: string;
  contextInfo: SlackMessageContext;
  similarity: number;
}

/**
 * Generate embedding for a single Slack message
 */
export async function generateSlackMessageEmbedding(
  message: SlackMessage,
  contextInfo: SlackMessageContext
): Promise<EmbeddingResult | null> {
  try {
    if (!message.text || message.text.trim().length === 0) {
      console.log(`Skipping empty message: ${message.messageId}`);
      return null;
    }

    // Clean and prepare the text for embedding
    const cleanText = cleanMessageText(message.text);
    
    if (cleanText.length < 10) {
      console.log(`Skipping short message: ${message.messageId}`);
      return null;
    }

    const { embedding } = await embed({
      model: embeddingModel,
      value: cleanText,
    });

    return {
      messageId: message.id,
      content: cleanText,
      contextInfo,
      embedding,
    };
  } catch (error) {
    console.error(`Error generating embedding for message ${message.messageId}:`, error);
    return null;
  }
}

/**
 * Generate embeddings for multiple Slack messages in batch
 */
export async function generateSlackMessageEmbeddings(
  messages: SlackMessage[],
  getContextInfo: (message: SlackMessage) => SlackMessageContext
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}`);
    
    const batchPromises = batch.map(async (message) => {
      const contextInfo = getContextInfo(message);
      return generateSlackMessageEmbedding(message, contextInfo);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean) as EmbeddingResult[]);
    
    // Rate limiting delay
    if (i + batchSize < messages.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Save embeddings to the database
 */
export async function saveSlackMessageEmbeddings(embeddings: EmbeddingResult[]): Promise<void> {
  try {
    if (embeddings.length === 0) return;
    
    const insertData = embeddings.map(emb => ({
      messageId: emb.messageId,
      workspaceId: emb.contextInfo.workspaceId,
      content: emb.content,
      contextInfo: emb.contextInfo,
      embedding: emb.embedding,
    }));
    
    await db.insert(slackMessageEmbedding).values(insertData);
    console.log(`✅ Saved ${embeddings.length} embeddings to database`);
  } catch (error) {
    console.error('Error saving embeddings:', error);
    throw error;
  }
}

/**
 * Find similar Slack messages using vector search
 */
export async function findSimilarSlackMessages(
  query: string,
  workspaceId: string,
  limit: number = 5,
  similarityThreshold: number = 0.7
): Promise<SimilarMessage[]> {
  try {
    // Generate embedding for the query
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: cleanMessageText(query),
    });

    // Calculate cosine similarity and search
    const similarity = sql<number>`1 - (${cosineDistance(
      slackMessageEmbedding.embedding,
      queryEmbedding,
    )})`;

    const similarMessages = await db
      .select({
        messageId: slackMessageEmbedding.messageId,
        content: slackMessageEmbedding.content,
        contextInfo: slackMessageEmbedding.contextInfo,
        similarity,
      })
      .from(slackMessageEmbedding)
      .where(
        and(
          eq(slackMessageEmbedding.workspaceId, workspaceId),
          gt(similarity, similarityThreshold)
        )
      )
      .orderBy(desc(similarity))
      .limit(limit);

    return similarMessages.map((msg: any) => ({
      messageId: msg.messageId,
      content: msg.content,
      contextInfo: msg.contextInfo as SlackMessageContext,
      similarity: msg.similarity,
    }));
  } catch (error) {
    console.error('Error finding similar messages:', error);
    throw error;
  }
}

/**
 * Clean message text for better embedding quality
 */
function cleanMessageText(text: string): string {
  return text
    // Remove Slack-specific formatting
    .replace(/<@[UW][A-Z0-9]+>/g, '@user') // Replace user mentions
    .replace(/<#[C][A-Z0-9]+\|([^>]+)>/g, '#$1') // Replace channel mentions
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1') // Replace formatted links
    .replace(/<https?:\/\/[^>]+>/g, '[link]') // Replace plain links
    .replace(/:\w+:/g, '') // Remove emoji codes
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a message already has an embedding
 */
export async function hasEmbedding(messageId: string): Promise<boolean> {
  try {
    const existing = await db
      .select({ id: slackMessageEmbedding.id })
      .from(slackMessageEmbedding)
      .where(eq(slackMessageEmbedding.messageId, messageId))
      .limit(1);
    
    return existing.length > 0;
  } catch (error) {
    console.error('Error checking existing embedding:', error);
    return false;
  }
}

/**
 * Get embedding statistics for a workspace
 */
export async function getEmbeddingStats(workspaceId: string) {
  try {
    const [embeddingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(slackMessageEmbedding)
      .where(eq(slackMessageEmbedding.workspaceId, workspaceId));
    
    const [messageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(slackMessage)
      .where(eq(slackMessage.workspaceId, workspaceId));
    
    return {
      totalMessages: messageCount.count,
      embeddedMessages: embeddingCount.count,
      embeddingCoverage: messageCount.count > 0 ? (embeddingCount.count / messageCount.count) * 100 : 0,
    };
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    return {
      totalMessages: 0,
      embeddedMessages: 0,
      embeddingCoverage: 0,
    };
  }
} 