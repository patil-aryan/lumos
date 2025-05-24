require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable not found');
    }
    
    const client = postgres(process.env.POSTGRES_URL);
    
    const result = await client`SELECT 1 as test`;
    console.log('✅ Database connected successfully');
    console.log('Test result:', result);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection(); 