const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function testSlackRAG(targetWorkspaceId = null) {
  const sql = postgres(process.env.POSTGRES_URL);
  
  try {
    console.log('🔍 Testing Slack RAG functionality...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return;
    }
    
    let workspace;
    
    if (targetWorkspaceId) {
      // Use specific workspace ID if provided
      const workspaces = await sql`
        SELECT id, "teamName" 
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
        SELECT sw.id, sw."teamName", COUNT(sm.id) as message_count
        FROM "SlackWorkspace" sw
        LEFT JOIN "SlackMessage" sm ON sw.id = sm."workspaceId"
        WHERE sw."isActive" = true
        GROUP BY sw.id, sw."teamName"
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
    
    // Check for embeddings
    const embeddings = await sql`
      SELECT COUNT(*) as count 
      FROM "SlackMessageEmbedding" 
      WHERE "workspaceId" = ${workspace.id}
    `;
    
    console.log(`📊 Found ${embeddings[0].count} embeddings`);
    
    if (embeddings[0].count === 0) {
      console.log('❌ No embeddings found. Run generate-slack-embeddings.js first');
      return;
    }
    
    // Test queries
    const testQueries = [
      'project status',
      'meeting',
      'deadline',
      'bug',
      'feature',
      'help',
    ];
    
    console.log('\n🧪 Testing RAG search with sample queries...\n');
    
    // Import AI functions
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
    
    for (const query of testQueries) {
      console.log(`🔍 Query: "${query}"`);
      
      try {
        // Generate embedding for the query
        const { embedding: queryEmbedding } = await embed({
          model: embeddingModel,
          value: cleanMessageText(query),
        });
        
        // Search for similar messages using raw SQL
        const results = await sql`
          SELECT 
            "messageId",
            "content",
            "contextInfo",
            1 - ("embedding" <=> ${JSON.stringify(queryEmbedding)}) as similarity
          FROM "SlackMessageEmbedding"
          WHERE "workspaceId" = ${workspace.id}
            AND 1 - ("embedding" <=> ${JSON.stringify(queryEmbedding)}) > 0.5
          ORDER BY similarity DESC
          LIMIT 5
        `;
        
        console.log(`✅ Found ${results.length} relevant messages`);
        
        if (results.length > 0) {
          results.slice(0, 2).forEach((msg, index) => {
            const context = typeof msg.contextInfo === 'string' ? JSON.parse(msg.contextInfo) : msg.contextInfo;
            const similarity = Math.round(msg.similarity * 100);
            console.log(`   ${index + 1}. [${similarity}%] #${context.channelName} - ${context.userName}`);
            console.log(`      "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`);
          });
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error testing query "${query}":`, error.message);
      }
    }
    
    console.log('🎉 RAG testing complete!');
    
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
🧪 Slack RAG Tester

Usage:
  node scripts/test-slack-rag.js [workspace-id]

Examples:
  # Use workspace with most messages (automatic)
  node scripts/test-slack-rag.js
  
  # Use specific workspace
  node scripts/test-slack-rag.js cf69c5ac-2c9d-4371-bc8f-c4d4cdce8dd8
  
  # Show help
  node scripts/test-slack-rag.js --help
    `);
    process.exit(0);
  }
  
  testSlackRAG(workspaceId);
}

module.exports = { testSlackRAG }; 