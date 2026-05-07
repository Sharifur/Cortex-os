import { pgTable, text, timestamp, integer, real, jsonb, boolean } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// Existing: content calendar ideas (unchanged)
export const contentIdeas = pgTable('content_ideas', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  month: text('month').notNull(),
  format: text('format').notNull(),
  hook: text('hook').notNull(),
  body: text('body').notNull(),
  cta: text('cta').notNull(),
  platform: text('platform'),
  brand: text('brand'),
  canvaDesignId: text('canva_design_id'),
  mediaUrl: text('media_url'),
  status: text('status').notNull().default('idea'),
  scheduledFor: timestamp('scheduled_for'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// T29: Per-brand identity — each brand has its own voice, palette, fonts, Canva kit
export const canvaBrands = pgTable('canva_brands', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull().unique(),         // taskip | xgenious
  displayName: text('display_name').notNull(),
  voiceProfile: text('voice_profile').notNull().default(''),
  palette: jsonb('palette').notNull().default('[]'),   // string[] hex colors
  fonts: jsonb('fonts').notNull().default('[]'),       // string[] font names
  canvaKitId: text('canva_kit_id'),                    // Canva brand kit ID
  platforms: jsonb('platforms').notNull().default('[]'), // string[] platform names
  logoUrl: text('logo_url'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// T3: Design generation sessions
export const canvaSessions = pgTable('canva_sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  brief: jsonb('brief').notNull(),                // DesignBrief JSON
  status: text('status').notNull().default('active'),  // active | closed
  approvalFolderPath: text('approval_folder_path'),
  totalCostUsd: real('total_cost_usd').notNull().default(0),
  iteration: integer('iteration').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
});

// T3: Individual design candidates
export const canvaCandidates = pgTable('canva_candidates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull(),
  status: text('status').notNull().default('pending'), // pending | approved | rejected | revised | failed
  backend: text('backend').notNull(),                   // canva | ai_image | local
  tool: text('tool'),                                   // export-design | dalle3 | pillow | etc.
  filePath: text('file_path'),
  format: text('format'),                               // png | pdf | svg | jpg
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes'),
  sha256: text('sha256'),
  phash: text('phash'),
  parentCandidateId: text('parent_candidate_id'),
  iteration: integer('iteration').notNull().default(1),
  feedback: text('feedback'),
  costUsd: real('cost_usd').notNull().default(0),
  rationale: text('rationale'),
  canvaDesignId: text('canva_design_id'),
  canvaEditUrl: text('canva_edit_url'),
  thumbnailPath: text('thumbnail_path'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// T27: Per-step debug log (written only when debugMode=true in agent config)
export const canvaDebugLog = pgTable('canva_debug_log', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id'),
  candidateId: text('candidate_id'),
  step: text('step').notNull(),     // parse | skill_match | plan | canva_call | image_generate | local_render | approve | reject | revise
  actor: text('actor').notNull(),   // service class name
  data: jsonb('data'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
