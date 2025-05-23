import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from './schema';

// Load environment variables
config({
  path: '.env.local',
});

/**
 * Utility script to check database connection
 * Run with: npx tsx lib/db/check-connection.ts
 */
const checkConnection = async () => {
  console.log('🔍 Checking database connection...');
  
  // Check if POSTGRES_URL is defined
  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL environment variable is not defined');
    console.log('Please make sure you have created a .env.local file with POSTGRES_URL defined');
    process.exit(1);
  }
  
  console.log('✅ POSTGRES_URL is defined');
  
  try {
    // Try to connect to the database
    console.log('🔄 Connecting to database...');
    const connection = postgres(process.env.POSTGRES_URL, { max: 1, idle_timeout: 10 });
    const db = drizzle(connection);
    
    // Try to query the database
    console.log('🔄 Testing query execution...');
    const result = await db.select().from(user).limit(1);
    
    console.log('✅ Successfully connected to database and executed query');
    console.log(`ℹ️ Found ${result.length} users in the database`);
    
    // Close the connection
    await connection.end();
    console.log('✅ Connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to database or execute query:');
    console.error(error);
    
    console.log('\n📋 Troubleshooting tips:');
    console.log('1. Check if your database service is running');
    console.log('2. Verify your connection string in .env.local is correct');
    console.log('3. Make sure your IP is allowed in the database firewall settings');
    console.log('4. Check if the database user has the correct permissions');
    console.log('5. For Neon.tech databases, verify your project is active');
    
    process.exit(1);
  }
};

checkConnection(); 