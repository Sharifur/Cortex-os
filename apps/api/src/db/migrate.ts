import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import fs from 'fs';
import { db } from './client';

function findMigrationsFolder(): string {
  if (process.env.DRIZZLE_MIGRATIONS_FOLDER) return process.env.DRIZZLE_MIGRATIONS_FOLDER;

  // Try the cwd first (npm script flow: cwd = apps/api),
  // then walk up from this file's directory looking for `drizzle/`.
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

export async function runMigrations() {
  const migrationsFolder = findMigrationsFolder();
  await migrate(db, { migrationsFolder });
}
