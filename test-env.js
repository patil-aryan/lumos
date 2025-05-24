require('dotenv').config({ path: '.env.local' });

console.log('Environment variables check:');
console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('POSTGRES_URL preview:', process.env.POSTGRES_URL ? process.env.POSTGRES_URL.substring(0, 50) + '...' : 'undefined');
console.log('AUTH_SECRET exists:', !!process.env.AUTH_SECRET);
console.log('SLACK_CLIENT_ID exists:', !!process.env.SLACK_CLIENT_ID);

if (process.env.POSTGRES_URL) {
  try {
    const url = new URL(process.env.POSTGRES_URL);
    console.log('Database URL parsed:');
    console.log('  Host:', url.hostname);
    console.log('  Database:', url.pathname.substring(1));
    console.log('  Username:', url.username);
    console.log('  Has password:', !!url.password);
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error.message);
  }
} 