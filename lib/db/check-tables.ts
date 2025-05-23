import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables
config({
  path: '.env.local',
});

const checkTables = async () => {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(process.env.POSTGRES_URL);

  try {
    console.log('Checking database tables...');
    
    // Get all tables in the database
    const tables = await sql`
      SELECT 
        table_name 
      FROM 
        information_schema.tables 
      WHERE 
        table_schema = 'public'
      ORDER BY 
        table_name;
    `;
    
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    // List of required tables
    const requiredTables = ['User', 'Chat', 'Message', 'Message_v2', 'Vote', 'Vote_v2', 'Document', 'Stream', 'Suggestion'];
    
    // Check if required tables exist
    console.log('\nChecking required tables:');
    for (const tableName of requiredTables) {
      const exists = tables.some(t => t.table_name === tableName);
      console.log(`${tableName}: ${exists ? '✅ Exists' : '❌ Missing'}`);
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await sql.end();
  }
};

checkTables().catch(console.error); 