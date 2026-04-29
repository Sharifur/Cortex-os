import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const contacts = pgTable(
  'contacts',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    displayName: text('display_name'),
    email: text('email'),
    phone: text('phone'),
    source: text('source').notNull(),       // crisp | taskip | email | whatsapp | linkedin | manual
    sourceRef: text('source_ref').notNull(), // unique within source
    websiteTag: text('website_tag'),         // crisp website id (only when source=crisp)
    taskipUserId: text('taskip_user_id'),    // reference only — profile lives in Taskip
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    sourceRefUnique: uniqueIndex('contacts_source_ref_unique').on(t.source, t.sourceRef),
    emailIdx: index('contacts_email_idx').on(t.email),
    sourceIdx: index('contacts_source_idx').on(t.source),
    websiteTagIdx: index('contacts_website_tag_idx').on(t.websiteTag),
  }),
);

export const contactActivity = pgTable(
  'contact_activity',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    contactId: text('contact_id').notNull(),
    kind: text('kind').notNull(), // crisp_message | email_sent | email_received | note | task | follow_up_set | follow_up_resolved
    summary: text('summary').notNull(),
    refId: text('ref_id'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    contactIdx: index('contact_activity_contact_id_idx').on(t.contactId),
    createdAtIdx: index('contact_activity_created_at_idx').on(t.createdAt),
  }),
);
