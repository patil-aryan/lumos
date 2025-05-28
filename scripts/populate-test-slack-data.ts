import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { slackWorkspace, slackUser, slackChannel, slackMessage, slackReaction, slackFile } from '../lib/db/schema-new-slack';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

async function populateTestData() {
  try {
    console.log('🔄 Populating test Slack data...');

    // Create a test workspace
    const workspace = await db.insert(slackWorkspace).values({
      teamId: 'T1234567890',
      teamName: 'Test Workspace',
      teamDomain: 'test-workspace',
      teamUrl: 'https://test-workspace.slack.com',
      userId: 'test-user-id', // Replace with actual user ID
      isActive: true,
      accessToken: 'test-token',
      lastSyncAt: new Date(),
    }).returning();

    const workspaceId = workspace[0].id;
    console.log('✅ Created workspace:', workspaceId);

    // Create test users
    const users = await db.insert(slackUser).values([
      {
        userId: 'U1234567890',
        username: 'john.doe',
        realName: 'John Doe',
        displayName: 'john.doe',
        email: 'john@example.com',
        isAdmin: true,
        isBot: false,
        workspaceId,
      },
      {
        userId: 'U0987654321',
        username: 'jane.smith',
        realName: 'Jane Smith',
        displayName: 'jane.smith',
        email: 'jane@example.com',
        isAdmin: false,
        isBot: false,
        workspaceId,
      },
      {
        userId: 'B1111111111',
        username: 'slackbot',
        realName: 'Slackbot',
        displayName: 'slackbot',
        isAdmin: false,
        isBot: true,
        workspaceId,
      }
    ]).returning();

    console.log('✅ Created users:', users.length);

    // Create test channels
    const channels = await db.insert(slackChannel).values([
      {
        channelId: 'C1234567890',
        name: 'general',
        isChannel: true,
        isPrivate: false,
        memberCount: 10,
        workspaceId,
      },
      {
        channelId: 'C0987654321',
        name: 'random',
        isChannel: true,
        isPrivate: false,
        memberCount: 8,
        workspaceId,
      },
      {
        channelId: 'D1111111111',
        name: 'direct-message',
        isIm: true,
        isPrivate: true,
        memberCount: 2,
        workspaceId,
      }
    ]).returning();

    console.log('✅ Created channels:', channels.length);

    // Create test messages
    const now = Math.floor(Date.now() / 1000);
    const messages = await db.insert(slackMessage).values([
      {
        messageId: '1234567890.123456',
        channelId: 'C1234567890',
        channelName: 'general',
        userId: 'U1234567890',
        userName: 'John Doe',
        text: 'Hello everyone! This is a test message in the general channel.',
        timestamp: (now - 3600).toString(), // 1 hour ago
        messageType: 'message',
        workspaceId,
      },
      {
        messageId: '1234567891.123457',
        channelId: 'C1234567890',
        channelName: 'general',
        userId: 'U0987654321',
        userName: 'Jane Smith',
        text: 'Hi John! This is a reply to your message.',
        timestamp: (now - 3000).toString(), // 50 minutes ago
        messageType: 'message',
        workspaceId,
      },
      {
        messageId: '1234567892.123458',
        channelId: 'D1111111111',
        channelName: 'D1111111111',
        userId: 'U1234567890',
        userName: 'John Doe',
        text: 'This is a direct message between John and Jane.',
        timestamp: (now - 1800).toString(), // 30 minutes ago
        messageType: 'message',
        workspaceId,
      },
      {
        messageId: '1234567893.123459',
        channelId: 'C0987654321',
        channelName: 'random',
        userId: 'U0987654321',
        userName: 'Jane Smith',
        text: 'This is a message in the random channel with some emoji reactions! 🎉',
        timestamp: (now - 900).toString(), // 15 minutes ago
        messageType: 'message',
        reactionCount: 2,
        workspaceId,
      },
      {
        messageId: '1234567894.123460',
        channelId: 'C1234567890',
        channelName: 'general',
        userId: 'U1234567890',
        userName: 'John Doe',
        text: 'This is a thread parent message.',
        timestamp: (now - 600).toString(), // 10 minutes ago
        messageType: 'message',
        replyCount: 2,
        workspaceId,
      },
      {
        messageId: '1234567895.123461',
        channelId: 'C1234567890',
        channelName: 'general',
        userId: 'U0987654321',
        userName: 'Jane Smith',
        text: 'This is a thread reply.',
        timestamp: (now - 300).toString(), // 5 minutes ago
        messageType: 'message',
        threadTs: '1234567894.123460',
        isThreadReply: true,
        workspaceId,
      }
    ]).returning();

    console.log('✅ Created messages:', messages.length);

    // Create test reactions
    const reactions = await db.insert(slackReaction).values([
      {
        messageId: messages[3].id,
        channelId: 'C0987654321',
        emoji: 'thumbsup',
        count: 1,
        users: ['U1234567890'],
        workspaceId,
      },
      {
        messageId: messages[3].id,
        channelId: 'C0987654321',
        emoji: 'heart',
        count: 1,
        users: ['U0987654321'],
        workspaceId,
      }
    ]).returning();

    console.log('✅ Created reactions:', reactions.length);

    // Create test files
    const files = await db.insert(slackFile).values([
      {
        fileId: 'F1234567890',
        name: 'test-document.pdf',
        title: 'Important Test Document',
        mimetype: 'application/pdf',
        filetype: 'pdf',
        size: 1024000,
        userId: 'U1234567890',
        userName: 'John Doe',
        channelId: 'C1234567890',
        channelName: 'general',
        messageId: messages[0].id,
        workspaceId,
      },
      {
        fileId: 'F0987654321',
        name: 'screenshot.png',
        title: 'Screenshot',
        mimetype: 'image/png',
        filetype: 'png',
        size: 512000,
        userId: 'U0987654321',
        userName: 'Jane Smith',
        channelId: 'C0987654321',
        channelName: 'random',
        workspaceId,
      }
    ]).returning();

    console.log('✅ Created files:', files.length);

    console.log('\n🎉 Test data populated successfully!');
    console.log(`Workspace ID: ${workspaceId}`);
    console.log(`Users: ${users.length}`);
    console.log(`Channels: ${channels.length}`);
    console.log(`Messages: ${messages.length}`);
    console.log(`Reactions: ${reactions.length}`);
    console.log(`Files: ${files.length}`);

  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

populateTestData(); 