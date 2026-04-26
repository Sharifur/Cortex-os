import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const queryClient = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
