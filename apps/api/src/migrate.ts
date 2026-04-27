import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join } from 'path';

async function runMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = join(process.cwd(), 'drizzle');
  console.log(`Running migrations from ${migrationsFolder}`);

  await migrate(db, { migrationsFolder });

  console.log('Migrations complete');
  await client.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
