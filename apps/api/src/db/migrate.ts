import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { db } from './client';

export async function runMigrations() {
  // CWD is apps/api when started via npm scripts — drizzle/ lives there
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}
