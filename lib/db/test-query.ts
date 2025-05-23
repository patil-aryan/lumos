import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables
config({
  path: '.env.local',
});

const checkDatabaseTables = async () => {
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
        table_name, 
        table_schema
      FROM 
        information_schema.tables 
      WHERE 
        table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY 
        table_schema, 
        table_name;
    `;
    
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`- ${table.table_schema}.${table.table_name}`);
    });
    
    // Try to get users from both potential table names
    console.log('\nTrying "User" table:');
    try {
      const usersUpperCase = await sql`SELECT * FROM "User" LIMIT 3`;
      console.log(`Found ${usersUpperCase.length} users in "User" table`);
      if (usersUpperCase.length > 0) {
        console.log('Sample user:', usersUpperCase[0]);
      }
    } catch (error) {
      console.error('Error querying "User" table:', error.message);
    }
    
    console.log('\nTrying "user" table:');
    try {
      const usersLowerCase = await sql`SELECT * FROM "user" LIMIT 3`;
      console.log(`Found ${usersLowerCase.length} users in "user" table`);
      if (usersLowerCase.length > 0) {
        console.log('Sample user:', usersLowerCase[0]);
      }
    } catch (error) {
      console.error('Error querying "user" table:', error.message);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
};

checkDatabaseTables().catch(console.error); 