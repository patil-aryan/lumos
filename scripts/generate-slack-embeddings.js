const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// Import the embedding functions directly
async function generateSlackEmbeddings(targetWorkspaceId = null) {
  const sql = postgres(process.env.POSTGRES_URL);
  
  try {
    console.log('🔍 Checking environment...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return;
    }
    
    console.log('✅ Environment variables configured');
    console.log('🔍 Checking for Slack workspaces...');
    
    let workspace;
    
    if (targetWorkspaceId) {
      // Use specific workspace ID if provided
      const workspaces = await sql`
        SELECT id, "teamName", "userId" 
        FROM "SlackWorkspace" 
        WHERE id = ${targetWorkspaceId}
        LIMIT 1
      `;
      
      if (workspaces.length === 0) {
        console.log(`❌ Workspace with ID ${targetWorkspaceId} not found`);
        return;
      }
      workspace = workspaces[0];
    } else {
      // Find workspace with most messages
      const workspaceWithMostMessages = await sql`
        SELECT sw.id, sw."teamName", sw."userId", COUNT(sm.id) as message_count
        FROM "SlackWorkspace" sw
        LEFT JOIN "SlackMessage" sm ON sw.id = sm."workspaceId"
        WHERE sw."isActive" = true
        GROUP BY sw.id, sw."teamName", sw."userId"
        ORDER BY message_count DESC
        LIMIT 1
      `;
      
      if (workspaceWithMostMessages.length === 0) {
        console.log('❌ No active Slack workspaces found');
        return;
      }
      workspace = workspaceWithMostMessages[0];
      console.log(`🎯 Using workspace with most messages: ${workspace.teamName} (${workspace.message_count} messages)`);
    }
    
    console.log(`✅ Selected workspace: ${workspace.teamName} (${workspace.id})`);
    
    // Check for messages
    const messages = await sql`
      SELECT * 
      FROM "SlackMessage" 
      WHERE "workspaceId" = ${workspace.id}
    `;
    
    console.log(`📊 Found ${messages.length} messages in workspace`);
    
    if (messages.length === 0) {
      console.log('❌ No messages found to embed');
      return;
    }
    
    // Check for existing embeddings
    const existingEmbeddings = await sql`
      SELECT "messageId"
      FROM "SlackMessageEmbedding" 
      WHERE "workspaceId" = ${workspace.id}
    `;
    
    const existingMessageIds = new Set(existingEmbeddings.map(e => e.messageId));
    console.log(`📊 Found ${existingEmbeddings.length} existing embeddings`);
    
    // Filter messages that don't have embeddings
    const messagesToEmbed = messages.filter(msg => !existingMessageIds.has(msg.id));
    
    if (messagesToEmbed.length === 0) {
      console.log('✅ All messages already have embeddings');
      return;
    }
    
    console.log(`🚀 Processing ${messagesToEmbed.length} new messages...`);
    
    // Import embedding functions
    const { embed } = require('ai');
    const { openai } = require('@ai-sdk/openai');
    
    const embeddingModel = openai.embedding('text-embedding-ada-002');
    
    // Clean message text function
    function cleanMessageText(text) {
      if (!text) return '';
      return text
        .replace(/<@[UW][A-Z0-9]+>/g, '@user')
        .replace(/<#[C][A-Z0-9]+\|([^>]+)>/g, '#$1')
        .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1')
        .replace(/<https?:\/\/[^>]+>/g, '[link]')
        .replace(/:\w+:/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Process messages in batches
    const batchSize = 5; // Smaller batch size for local processing
    let processed = 0;
    let saved = 0;
    
    for (let i = 0; i < messagesToEmbed.length; i += batchSize) {
      const batch = messagesToEmbed.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messagesToEmbed.length / batchSize)}`);
      
      const embeddings = [];
      
      for (const message of batch) {
        try {
          if (!message.text || message.text.trim().length === 0) {
            processed++;
            continue;
          }
          
          const cleanText = cleanMessageText(message.text);
          if (cleanText.length < 10) {
            processed++;
            continue;
          }
          
          const { embedding } = await embed({
            model: embeddingModel,
            value: cleanText,
          });
          
          embeddings.push({
            messageId: message.id,
            workspaceId: message.workspaceId,
            content: cleanText,
            contextInfo: {
              messageId: message.messageId,
              workspaceId: message.workspaceId,
              channelName: message.channelName || 'unknown',
              userName: message.userName || 'unknown',
              timestamp: message.timestamp,
              threadTs: message.threadTs || undefined,
            },
            embedding: JSON.stringify(embedding),
          });
          
          processed++;
          
        } catch (error) {
          console.error(`❌ Error processing message ${message.messageId}:`, error.message);
          processed++;
        }
      }
      
      // Save embeddings to database
      if (embeddings.length > 0) {
        try {
          await sql`
            INSERT INTO "SlackMessageEmbedding" ("messageId", "workspaceId", "content", "contextInfo", "embedding")
            VALUES ${sql(embeddings.map(emb => [
              emb.messageId,
              emb.workspaceId,
              emb.content,
              JSON.stringify(emb.contextInfo),
              emb.embedding
            ]))}
          `;
          saved += embeddings.length;
          console.log(`✅ Saved ${embeddings.length} embeddings from this batch`);
        } catch (error) {
          console.error('❌ Error saving embeddings:', error.message);
        }
      }
      
      // Rate limiting delay
      if (i + batchSize < messagesToEmbed.length) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n🎉 Embedding generation complete!`);
    console.log(`📊 Processed: ${processed} messages`);
    console.log(`💾 Saved: ${saved} embeddings`);
    console.log(`⏭️  Skipped: ${processed - saved} messages`);
    
    // Final stats
    const finalEmbeddings = await sql`
      SELECT COUNT(*) as count 
      FROM "SlackMessageEmbedding" 
      WHERE "workspaceId" = ${workspace.id}
    `;
    
    const coverage = messages.length > 0 ? (finalEmbeddings[0].count / messages.length * 100).toFixed(1) : 0;
    console.log(`📈 Total embeddings: ${finalEmbeddings[0].count}/${messages.length} (${coverage}% coverage)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

// Check if we're running this script directly
if (require.main === module) {
  // Get workspace ID from command line arguments
  const workspaceId = process.argv[2];
  
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🚀 Slack Embedding Generator

Usage:
  node scripts/generate-slack-embeddings.js [workspace-id]

Examples:
  # Use workspace with most messages (automatic)
  node scripts/generate-slack-embeddings.js
  
  # Use specific workspace
  node scripts/generate-slack-embeddings.js cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8
  
  # Show help
  node scripts/generate-slack-embeddings.js --help

Available workspaces:
  - Lumos: cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8 (147 messages)
  - Test Workspace: 7f8f6d2c-9c48-4e45-a3a6-281dd7b5ff3a (0 messages)
    `);
    process.exit(0);
  }
  
  generateSlackEmbeddings(workspaceId);
}

module.exports = { generateSlackEmbeddings }; 