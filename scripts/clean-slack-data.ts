import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  slackWorkspace, 
  slackUser, 
  slackChannel, 
  slackMessage, 
  slackReaction, 
  slackFile, 
  slackChannelMember, 
  slackSyncLog 
} from '../lib/db/schema-new-slack';

// Initialize database connection
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

async function cleanSlackData() {
  console.log('🧹 Starting Slack data cleanup...');

  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting reactions...');
    await db.delete(slackReaction);
    
    console.log('Deleting files...');
    await db.delete(slackFile);
    
    console.log('Deleting channel members...');
    await db.delete(slackChannelMember);
    
    console.log('Deleting messages...');
    await db.delete(slackMessage);
    
    console.log('Deleting channels...');
    await db.delete(slackChannel);
    
    console.log('Deleting users...');
    await db.delete(slackUser);
    
    console.log('Deleting sync logs...');
    await db.delete(slackSyncLog);
    
    console.log('Deleting workspaces...');
    await db.delete(slackWorkspace);
    
    console.log('✅ All Slack data cleaned successfully!');
    console.log('📊 Database is now clean and ready for fresh Slack data ingestion.');
    
  } catch (error) {
    console.error('❌ Error cleaning Slack data:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the cleanup
cleanSlackData()
  .then(() => {
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  }); 