import { pgTable, text, timestamp, boolean, integer, real } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const linkedinAccounts = pgTable('linkedin_accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  unipileAccountId: text('unipile_account_id').notNull().unique(),
  label: text('label').notNull(),
  profileUrl: text('profile_url'),
  isActive: boolean('is_active').notNull().default(true),
  enableConnections: boolean('enable_connections').notNull().default(true),
  enableComments: boolean('enable_comments').notNull().default(true),
  enableDMs: boolean('enable_dms').notNull().default(true),
  maxConnectionsPerRun: integer('max_connections_per_run'),
  maxDMsPerRun: integer('max_dms_per_run'),
  maxCommentsPerRun: integer('max_comments_per_run'),
  dailyConnectionsLimit: integer('daily_connections_limit'),
  hourlyConnectionsLimit: integer('hourly_connections_limit'),
  dailyCommentsLimit: integer('daily_comments_limit'),
  hourlyCommentsLimit: integer('hourly_comments_limit'),
  dailyDmsLimit: integer('daily_dms_limit'),
  hourlyDmsLimit: integer('hourly_dms_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const linkedinNiches = pgTable('linkedin_niches', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => linkedinAccounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  targetJobTitles: text('target_job_titles').array().notNull().default([]),
  targetIndustries: text('target_industries').array().notNull().default([]),
  keywords: text('keywords').array().notNull().default([]),
  icpDescription: text('icp_description'),
  dailyConnectLimit: integer('daily_connect_limit').notNull().default(5),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const linkedinConnectionRequests = pgTable('linkedin_connection_requests', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => linkedinAccounts.id),
  nicheId: text('niche_id').references(() => linkedinNiches.id),
  profileId: text('profile_id').notNull(),
  profileName: text('profile_name').notNull(),
  profileHeadline: text('profile_headline'),
  profileUrl: text('profile_url'),
  status: text('status').notNull().default('pending'), // pending | sent | accepted | declined | failed
  noteSent: text('note_sent'),
  icpScore: real('icp_score'),
  icpReason: text('icp_reason'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const linkedinLeads = pgTable('linkedin_leads', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').references(() => linkedinAccounts.id),
  nicheId: text('niche_id').references(() => linkedinNiches.id),
  profileUrl: text('profile_url').notNull().unique(),
  profileId: text('profile_id'),
  name: text('name'),
  headline: text('headline'),
  connectionStatus: text('connection_status').notNull().default('none'), // none | pending | connected | declined | ignored
  status: text('status').notNull().default('new'), // new | dm_sent | replied | converted | ignored
  icpScore: real('icp_score'),
  icpReason: text('icp_reason'),
  lastContactedAt: timestamp('last_contacted_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const linkedinPosts = pgTable('linkedin_posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').references(() => linkedinAccounts.id),
  externalId: text('external_id').notNull().unique(),
  authorName: text('author_name'),
  content: text('content').notNull(),
  draftComment: text('draft_comment'),
  status: text('status').notNull().default('pending'), // pending | approved | posted | skipped
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
