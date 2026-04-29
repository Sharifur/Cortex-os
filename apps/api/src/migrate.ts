import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import fs from 'fs';

function findMigrationsFolder(): string {
  if (process.env.DRIZZLE_MIGRATIONS_FOLDER) return process.env.DRIZZLE_MIGRATIONS_FOLDER;
  const candidates = [
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(__dirname, '..', '..', 'drizzle'),
    path.resolve(__dirname, '..', '..', '..', 'drizzle'),
    path.resolve(__dirname, '..', '..', '..', '..', 'drizzle'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'meta', '_journal.json'))) return p;
  }
  return candidates[0];
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = findMigrationsFolder();
  console.log(`[migrate] running migrations from ${migrationsFolder}`);

  await migrate(db, { migrationsFolder });

  console.log('[migrate] complete');
  await client.end();
}

runMigrations().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
