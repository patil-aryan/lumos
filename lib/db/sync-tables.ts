import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Load environment variables
config({
  path: '.env.local',
});

const syncTables = async () => {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not defined');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
    const db = drizzle(connection);
    
    console.log('Running migrations to ensure schema is up to date...');
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    
    console.log('✅ Database synchronized successfully');
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error synchronizing database:', error);
    process.exit(1);
  }
};

syncTables().catch(console.error); 