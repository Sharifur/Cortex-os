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
  throw new Error(
    `drizzle migrations folder not found. Searched:\n${candidates.join('\n')}\nSet DRIZZLE_MIGRATIONS_FOLDER to override.`,
  );
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const migrationsFolder = findMigrationsFolder();
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'));
  console.log(`[migrate] folder: ${migrationsFolder}`);
  console.log(`[migrate] journal entries: ${journal.entries.length}`);

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    console.log('[migrate] all migrations applied successfully');
  } finally {
    await client.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
