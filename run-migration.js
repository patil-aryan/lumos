require('dotenv').config();
const postgres = require('postgres');
const fs = require('fs');

const sql = postgres(process.env.POSTGRES_URL);

async function runMigration() {
  try {
    console.log('🔄 Running Confluence tables migration...');
    const migration = fs.readFileSync('./lib/db/migrations/0010_confluence_tables.sql', 'utf8');
    await sql.unsafe(migration);
    console.log('✅ Confluence tables migration applied successfully');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigration(); 