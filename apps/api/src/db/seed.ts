import 'dotenv/config';
import { db } from './client';
import { users } from './schema';
import * as bcrypt from 'bcrypt';

async function seed() {
  const email = process.env.OWNER_EMAIL ?? 'admin@example.com';
  const password = process.env.OWNER_PASSWORD ?? 'changeme';

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log('Owner already exists, skipping seed');
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, password: hash });

  console.log(`Owner created: ${email}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
