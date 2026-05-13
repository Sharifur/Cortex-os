import { ScrollText } from 'lucide-react';

type Tag = 'feat' | 'fix' | 'chore';

interface ChangeEntry {
  tag: Tag;
  scope?: string;
  description: string;
}

interface VersionBlock {
  version: string;
  date: string;
  entries: ChangeEntry[];
}

const CHANGELOG: VersionBlock[] = [
  {
    version: 'v4.17.4',
    date: '2026-05-13',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Removed hard .limit(200) from listSamples() DB query — all uploaded design samples are now returned regardless of count. Samples tab and count now correctly reflect 300+ images.' },
    ],
  },
  {
    version: 'v4.17.3',
    date: '2026-05-13',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples upload is now non-blocking — new images can be dropped while previous ones are still being analyzed by vision LLM. Each file uploads individually so the progress bar increments in real time. Sample grid refreshes after each completed image.' },
      { tag: 'fix', scope: 'canva', description: 'Removed the "Uploaded undefined sample(s)" status message — progress state now tracks done/total counts directly without relying on the API response field.' },
    ],
  },
  {
    version: 'v4.17.2',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Pattern learning now generates a holistic "Banner Brief" — a 3-5 sentence art-director paragraph synthesizing layout, color, typography, icons, shapes, and tone into a single actionable design description. Stored alongside pattern rules and surfaced in the Patterns tab.' },
      { tag: 'feat', scope: 'canva', description: 'Banner Brief is passed to content generation as design context — AI copy now understands the full visual intent of the brand, not just individual rules.' },
      { tag: 'feat', scope: 'canva', description: 'UnsplashService wired into PostRendererService — real photos are fetched via _buildUnsplashQuery() before AI generation when DNA indicates photography style. Unsplash is not listed as an image generation provider; it is a photo source for backgrounds and corporate imagery.' },
      { tag: 'fix', scope: 'canva', description: 'UnsplashService added to post-render module providers and exports — was imported but missing from DI registration, causing runtime injection errors.' },
    ],
  },
  {
    version: 'v4.17.1',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Learned design DNA is now fully applied during rendering. getDominantDNA() aggregates all samples and drives: heading size, padding, line height, accent bar position, logo placement, CTA button style/border-radius, content tone, mood keywords, and icon/illustration/photography style.' },
      { tag: 'feat', scope: 'canva', description: 'Decorative shapes from design samples (circles, blobs, diagonal cuts, waves, etc.) are rendered in centered and left-aligned layouts using absolute-positioned divs — colours, gradients, opacity, and border-radius all from the learned shape_elements DNA.' },
      { tag: 'feat', scope: 'canva', description: 'CTA buttons now adopt the learned ctaStyle: pill (borderRadius 999), flat (0), outlined (transparent bg with accent border), text-link, or arrow-link. Helper ctaStyle() centralises rendering logic across layouts.' },
      { tag: 'feat', scope: 'canva', description: 'Image generation prompts now use learned photography_style, illustration_style, background_style and mood_keywords — produces contextually matching backgrounds instead of the generic fallback.' },
      { tag: 'feat', scope: 'canva', description: 'Content generation receives learned content_tone, mood_keywords, and top-5 pattern rules — AI copy now matches the visual tone of the learned brand.' },
    ],
  },
  {
    version: 'v4.17.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design sample DNA extraction is now deeply detailed — icon style/count/size, illustration type, photography style, decoration elements, border radius, shadow, CTA shape, content tone, color count, background texture, and free-text pattern notes are all extracted per image.' },
      { tag: 'feat', scope: 'canva', description: 'Spatial layout capture (Elementor-style): every visible element (logo, headline, icon, CTA, brand-bar, etc.) is recorded with x/y/w/h as canvas percentages, alignment, and z-layer. Grid column count and content zone bounds are also captured.' },
      { tag: 'feat', scope: 'canva', description: 'Shape element capture: every decorative shape (circle, blob, wave, diagonal-cut, etc.) records shape type, fill type/colors, gradient angle, opacity, position, border-radius, and an SVG reconstruction hint — enough to regenerate the exact shape programmatically.' },
      { tag: 'feat', scope: 'canva', description: 'Pattern clustering now aggregates full DNA JSON across all samples (not just 300-char text slices), computes field frequencies, collects SVG hints, and produces 8–12 category-organised rules covering layout, color, typography, icons, illustration/photo, shapes, content tone, and CTA.' },
    ],
  },
  {
    version: 'v4.16.9',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'activity', description: 'Activity panel no longer shows spinning progress icons for completed render_slide, content_gen, post_render and image_gen steps — they resolve to success icons once the paired done-event arrives or the run finishes.' },
      { tag: 'feat', scope: 'chat', description: 'Slide lightbox redesigned — dot-strip slide counter, side chevron buttons for prev/next, separate Copy and Download action buttons, keyboard hint, rounded image with ring.' },
    ],
  },
  {
    version: 'v4.16.8',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Slide thumbnails are now clickable — opens a full-size lightbox with prev/next navigation, keyboard arrow support, and a "Copy image" button that copies the PNG to clipboard for pasting directly into Canva.' },
    ],
  },
  {
    version: 'v4.16.7',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'post-render', description: 'Local filesystem fallback for slide PNGs when R2 is not configured — slides saved to ~/Designs/AI-Agent/Renders/<renderId>/ and served via /posts/renders/:id/slides/:n/png.' },
      { tag: 'fix', scope: 'post-render', description: 'Fixed "cannot cast type record to text[]" — replaced raw SQL INSERT with Drizzle ORM .insert().values() so slideUrls array is properly persisted.' },
      { tag: 'fix', scope: 'post-render', description: 'Satori crash on undefined CSS values fixed in centered and overlay layouts — backgroundImage/backgroundColor now use conditional spread instead of explicit undefined.' },
      { tag: 'fix', scope: 'post-render', description: 'Added missing journal entries for migrations 0064-0065 so Drizzle applies them on next db:migrate run.' },
      { tag: 'feat', scope: 'chat', description: 'Progressive slide rendering in chat — while a render is in progress the chat shows a live grid with completed slide thumbnails and skeleton placeholders for pending slides. Final result renders a full SlideGrid.' },
    ],
  },
  {
    version: 'v4.16.6',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples tab now has Samples / Patterns sub-tabs — patterns are no longer inline so the page stays readable with 200+ uploaded images. Sample thumbnails are fixed 60×60px squares; the Learned badge is now a small green BookOpen icon.' },
    ],
  },
  {
    version: 'v4.16.5',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'post-render', description: 'Removed children:null from all layout accent-bar and stripe elements — satori crashed with "Cannot read properties of undefined (reading trim)" when processing null children. Activity tab now emits an ERROR log entry when render fails so the panel shows a red error state instead of staying stuck on the last progress step.' },
    ],
  },
  {
    version: 'v4.16.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Learn patterns now works with 3+ samples — cluster() and getPatterns() replaced semantic search with direct DB queries. Frontend passes brand=default so uploaded samples are correctly matched.' },
      { tag: 'feat', scope: 'canva', description: 'Design sample cards: removed title text, added green Learned badge on each thumbnail when patterns have been generated. Grid expanded to 4 columns.' },
    ],
  },
  {
    version: 'v4.16.3',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples cards now show a 60x60 thumbnail. Clicking the thumbnail opens the full-size image in a lightbox overlay (click outside to close).' },
      { tag: 'feat', scope: 'debug', description: 'DebugLogsPage stats and log list now show animated skeleton placeholders while loading instead of empty state.' },
      { tag: 'fix', scope: 'post-render', description: 'Added error logging with stack traces to satori render crashes and postRenders SELECT failures — easier to diagnose render pipeline errors.' },
    ],
  },
  {
    version: 'v4.16.2',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'activity', description: 'Render pipeline steps now appear in the Activity tab in real time — runId is injected into the action payload by the execute processor so all post_render logs (theme locked, content ready, rendering slide N, render complete) attach to the correct run.' },
      { tag: 'fix', scope: 'canva', description: 'Design Samples list now shows uploaded entries — listSamples() was using semantic search (searchEntries) which skipped non-matching entries. Replaced with a direct DB query filtering entryType=design_sample.' },
      { tag: 'fix', scope: 'canva', description: 'Lower Learn patterns threshold from 20 to 3 so it can be tested with a small set of uploads.' },
    ],
  },
  {
    version: 'v4.16.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Chat now shows response messages from auto-executed agent actions (e.g. post_render) by reading run.result[].data.message when present.' },
    ],
  },
  {
    version: 'v4.16.0',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Fixed mark-as-opened persisting across reloads — root cause was JSON.stringify() in the email send/seed paths causing metadata to be stored as a JSONB string scalar instead of an object. The || merge operator then produced a JSONB array on subsequent updates, so manuallyOpened was always undefined after reload. Fixed by passing JS objects directly (no JSON.stringify) in send() and seed so postgres.js serializes them correctly as JSONB objects.' },
    ],
  },
  {
    version: 'v4.15.9',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'listSent and getDetail now use raw SQL with a COALESCE fallback for open_count/first_open_at/last_open_at — these columns may not exist on local environments where migration 0063 has not run. Falls back to a query without those columns if they are missing, so the inbox loads instead of 500-ing.' },
    ],
  },
  {
    version: 'v4.15.8',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'dev', description: 'Added missing agent route prefixes to Vite dev proxy: /taskip-internal, /support, /canva, /email-manager, /linkedin, /reddit, /whatsapp. Without these the inbox and other agent pages returned empty data locally because requests were served by Vite instead of the API.' },
    ],
  },
  {
    version: 'v4.15.7',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened now persists across page reloads — listSent and getDetail queries now include openCount, firstOpenAt, lastOpenAt columns. Previously these were omitted from the SELECT so reload always showed openCount as undefined, and the opened badge relied only on the metadata JSONB field.' },
      { tag: 'feat', scope: 'seed', description: 'Added 5 dummy inbox emails to the seed script for local development — covers marketing, trial_followup, and other purposes with varying open states (unopened, pixel-opened, manually-opened, failed send).' },
    ],
  },
  {
    version: 'v4.15.6',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'deploy', description: 'Revert migration step from nixpacks.toml start command — Coolify post-deploy command already runs node dist/src/migrate before traffic switches; adding it to the start cmd caused double-migration on every deploy.' },
    ],
  },
  {
    version: 'v4.15.5',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'deploy', description: 'Switch to Nixpacks for deployment: migrations now run automatically via nixpacks.toml start command ("node dist/src/migrate && node dist/src/main"). Removed Dockerfile, .dockerignore, docker-entrypoint.sh, and healthcheck.js — they are not used with Nixpacks.' },
    ],
  },
  {
    version: 'v4.15.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook log now written for every incoming request, including those rejected at the signature check (missing secret config, missing header, wrong secret). Previously only requests that passed signature validation appeared in the Webhook Logs tab. Rejected entries show status "rejected" with the specific reason in the error field.' },
    ],
  },
  {
    version: 'v4.15.3',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook normalization now handles flat data payloads where data contains the ticket fields directly (id, subject, priority at top level). Previously only transformer-class-keyed formats were recognised, causing "Missing ticket.id or ticket.subject" for all support.ticket.created and support.ticket.replied events. Priority now also accepts string values (low/medium/high/urgent) in addition to numeric codes.' },
    ],
  },
  {
    version: 'v4.15.2',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Added migration 0067_ensure_email_tables: creates email_suppressions table and adds open-tracking columns (tracking_token, open_count, first_open_at, last_open_at, open_events) with IF NOT EXISTS guards. Fixes persistent "relation email_suppressions does not exist" — 0062/0063 were recorded as applied in __drizzle_migrations but their DDL never committed.' },
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened no longer reverts after a second — removed the immediate inbox list invalidation from onSuccess. The optimistic cache patch is now stable; a simultaneous refetch was racing the DB write and returning stale data that overwrote the opened state.' },
    ],
  },
  {
    version: 'v4.15.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'deploy', description: 'docker-entrypoint.sh now runs "node dist/src/migrate" automatically before starting the app on every container start. Eliminates the need for a manual Coolify post-deploy command — migrations (including missing post_renders and post_formats tables) apply on the next deploy.' },
    ],
  },
  {
    version: 'v4.15.0',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrate', description: 'Standalone migrate.ts (node dist/src/migrate) now logs journal entry count, wraps the client in try/finally so it always closes, throws a clear error if the drizzle folder cannot be found, and calls process.exit(0) on success so Coolify post-deploy commands exit cleanly instead of hanging.' },
    ],
  },
  {
    version: 'v4.14.9',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'agents', description: 'Removed Social Media Handler (social) and YouTube Shorts Creator (shorts) agents — deregistered from app.module.ts, seed.ts, and Telegram routing menus.' },
    ],
  },
  {
    version: 'v4.14.8',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Renamed agent from "Canva + Social Content Agent" to "Social Media Banner Design Agent" in agent class and seed file.' },
    ],
  },
  {
    version: 'v4.14.7',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Removed Candidates tab from Canva agent settings — Post Renders is now the default landing tab.' },
      { tag: 'chore', scope: 'nav', description: 'Removed Post Renders sidebar nav item — the feature lives inside the Canva agent settings tab.' },
    ],
  },
  {
    version: 'v4.14.6',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Design Samples tab: removed brand filter — samples are now uploaded and listed globally across all brands. Learn patterns also runs globally.' },
    ],
  },
  {
    version: 'v4.14.5',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Post Renders brand field is now a select dropdown populated from saved canva brands. First brand is auto-selected on load. Falls back to a text input if no brands are configured yet.' },
    ],
  },
  {
    version: 'v4.14.4',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Design Samples upload now has a full drag-and-drop dropzone — drag images directly onto the zone to upload without clicking. Clicking still opens the file picker. Drag-over state highlights the border. Multiple files supported in both flows.' },
    ],
  },
  {
    version: 'v4.14.3',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Email card SPAR parser now finds the last **Email:** section marker (followed by newline) rather than the first occurrence. Workspace context fields like **Email:** user@domain.com were being matched first, causing the entire workspace context and reasoning block to appear as the email body inside the card.' },
      { tag: 'fix', scope: 'canva', description: 'Post Renders format dropdown now shows all 15 built-in formats immediately using a static fallback list — no longer empty when the /posts/formats API is unavailable. Added /posts to Vite proxy so the API call also works in dev.' },
      { tag: 'fix', scope: 'canva', description: 'Design Samples upload resets the file input after each upload so users can select and upload new batches immediately without refreshing. Fixed upload URL to remove spurious /api/ prefix.' },
    ],
  },
  {
    version: 'v4.14.2',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Added migration 0066_missing_tables.sql (registered in _journal.json) to create support_webhook_logs, post_formats, and post_renders tables. Migrations 0064 and 0065 were raw SQL files never added to the Drizzle journal — Drizzle silently skips files not in _journal.json so they never ran in production. The 0066 migration uses IF NOT EXISTS so it is safe to apply even if tables were created manually.' },
    ],
  },
  {
    version: 'v4.14.1',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Post-render engine events now appear in the chat activity panel: content generation, image gen (with cost), per-slide rendering, and render complete — each with a distinct icon and running/success/failed state.' },
      { tag: 'feat', scope: 'llm-usage', description: 'Image generation cost now recorded to llm_usage_logs via LlmUsageService.record() with costUsdOverride, so image spend appears in the LLM Usage page by model and agent alongside text LLM calls.' },
      { tag: 'feat', scope: 'llm-usage', description: 'UsageRecord now accepts costUsdOverride to bypass the token-based pricing table computation — needed for per-image pricing models.' },
    ],
  },
  {
    version: 'v4.14.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'settings', description: 'Image Generation settings rebuilt with provider sub-tabs (OpenAI / Stability AI / Gemini), model selector per provider with cost annotations, and a cost reference table. Settings definitions now carry options arrays for dropdown rendering.' },
      { tag: 'feat', scope: 'image-gen', description: 'ImageGenService now supports Stability AI (Stable Image Core, SDXL, Stable Image Ultra) as a provider. Provider cascade updated to: openai → stability → gemini. Each generation logs model name, provider, and estimated cost in USD to activity log.' },
      { tag: 'feat', scope: 'image-gen', description: 'Added configurable model selection: image_gen_openai_model (gpt-image-1, gpt-image-2, dall-e-3-hd, dall-e-3, dall-e-2) and image_gen_stability_model (stable-image-core, SDXL, stable-image-ultra) settings.' },
    ],
  },
  {
    version: 'v4.13.7',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'settings', description: 'Added Image Generation section to Settings page with two fields: stability_api_key (secret, for AI image backgrounds) and image_gen_provider (auto/openai/stability). Section appears between LLM and HR tabs.' },
      { tag: 'fix', scope: 'settings', description: 'stability_api_key and image_gen_provider were missing from SETTING_DEFINITIONS so they never appeared in Settings. Added with group: image and correct isSecret flags.' },
    ],
  },
  {
    version: 'v4.13.6',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Post Format Engine now executes from chat: sending "Generate a linkedin-tips-carousel for brand taskip about ..." detects the pattern in decideChat, calls PostRendererService.render() directly, and returns slide URLs in the chat response. Previously the agent just returned a text layout description.' },
      { tag: 'fix', scope: 'post-render', description: 'Broke circular dependency between PostRenderModule and CanvaModule: PostBrandService now queries canvaBrands table directly via DbService instead of depending on CanvaBrandsService, allowing PostRenderModule to be imported into CanvaModule cleanly.' },
      { tag: 'fix', scope: 'canva', description: 'Setup tab Step 1 and Step 2 now show as checked when openai_api_key / stability_api_key are configured in Settings. Step descriptions updated: Stability AI doc added with platform.stability.ai → API Keys instructions and sk-... key format note.' },
      { tag: 'fix', scope: 'post-renders', description: 'Design Samples tab brand selector changed from a fixed dropdown (taskip/xgenious) to a free text input. Samples now load across all brands by default when brand field is empty.' },
    ],
  },
  {
    version: 'v4.13.5',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Mark as opened now updates the row immediately via optimistic setQueryData patch, so the opened state reflects without waiting for a refetch. Invalidation also scoped to the active purpose filter key.' },
      { tag: 'fix', scope: 'chat', description: 'Spam score badge replaced with a color-coded pill: "Inbox · 100" in emerald, "Promotions · N" in amber, "Spam risk · N" in orange, "Blocked · N" in rose. Previous label "Spam: 100 — Inbox strong" was confusing.' },
    ],
  },
  {
    version: 'v4.13.4',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Plain text mode toggle in the Send Email dialog was visually broken: the thumb overflowed the right edge of the track when active. Fixed by adding overflow-hidden to the track element and correcting the ON translate from translate-x-4 (16px) to translate-x-[18px] (track 36px minus thumb 16px minus 2px right margin = 18px). Also reduced shadow to shadow-sm to avoid visual bleed.' },
    ],
  },
  {
    version: 'v4.13.3',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'post-renders', description: 'Added standalone Post Renders page at /post-renders with nav entry. Includes two tabs: Post Renders (generate form with format/brand/intent/topic inputs, renders list with slide thumbnails, approve/reject, PPTX/CSV/text download links) and Design Samples & Training (drag-and-drop upload zone, brand selector, upload DNA results with color swatches, learned patterns display, sample grid with hover overlay). The page is accessible directly from the sidebar without going through the Canva agent tab.' },
    ],
  },
  {
    version: 'v4.13.2',
    date: '2026-05-12',
    entries: [
      { tag: 'chore', scope: 'canva', description: 'Updated Canva agent task suggestions to surface Post Format Engine commands: LinkedIn carousels (tips, how-to, list), LinkedIn single cards (stat, quote), Instagram carousels and story formats, Twitter announcement, Facebook ad banner, and generic checklist. Legacy Canva MCP marketing suggestions trimmed to avoid duplication.' },
    ],
  },
  {
    version: 'v4.13.1',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'spam-checker', description: 'Frontend chat spam score was capped at 45 (SPAM_RISK) despite clean email content. Root cause: empty fromDomain passed by the frontend triggered DNS lookups for _dmarc. and reputation checks against an empty label, which failed and set a critical failure, capping rawScore at 45. Fix: checkAuthentication and checkReputation now return a neutral 100 score when fromDomain is empty, so domain-infrastructure checks are skipped for calls that only know the email content.' },
    ],
  },
  {
    version: 'v4.13.0',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'post-render', description: 'Post Format Engine: Canva-free self-hosted image generation pipeline using Satori (JSX to SVG) and @resvg/resvg-js (SVG to PNG). 15 built-in templates across LinkedIn, Instagram, Twitter, Facebook in carousel, single, and story formats. AI fills content slots dynamically via LLM using a structured schema with per-slot maxChars, constraints, and hints.' },
      { tag: 'feat', scope: 'post-render', description: 'ThemeContract consistency engine: derives a locked style object once per render session (colors, fonts, padding, accent bar, indicator position) and applies it uniformly to all slides. Structural consistency is guaranteed by construction rather than validated after the fact.' },
      { tag: 'feat', scope: 'post-render', description: 'Multi-provider image background generation: gpt-image-1 to dall-e-3 to gemini-2.0-flash-exp to dall-e-2 cascade with automatic fallback. Slides with backgroundType=ai-image trigger this pipeline; all others use flat hex color.' },
      { tag: 'feat', scope: 'post-render', description: 'Canva interoperability exports: PPTX (full layer-wise editing in Canva after import), Canva Bulk Create CSV, plain text slot export. All available via REST endpoints GET /posts/renders/:id/pptx, /canva-csv, /text-export.' },
      { tag: 'feat', scope: 'post-render', description: 'Design Sample Learning: upload 200+ design images, GPT-4V extracts Design DNA JSON (layout, colors, typography, mood keywords, platform fit), stored in existing knowledgeEntries table as entryType=design_sample, brand-scoped via siteKeys. After 20+ samples, a clustering pass produces design_pattern entries used as always-on context at render time.' },
      { tag: 'feat', scope: 'post-render', description: 'Post Renders tab added to Canva agent page: generate new renders from any format/brand/topic, view slide thumbnails, download PPTX/CSV/text exports, approve/reject status management. Design Samples sub-tab with image upload, DNA analysis progress, learned patterns display.' },
      { tag: 'feat', scope: 'post-render', description: 'Full activity logging for all render pipeline steps (post_render_start, post_theme_derived, post_content_start, post_content_end, post_image_gen_start/end/fallback, post_render_slide, post_render_slide_done, post_upload_done, post_consistency_check, design_sample_analyze, design_pattern_cluster). Real-time via WebSocket activity:log events.' },
      { tag: 'chore', scope: 'db', description: 'Migration 0065: post_formats and post_renders tables. post_formats stores static template registry; post_renders stores AI-generated content and slide URLs per render session.' },
    ],
  },
  {
    version: 'v4.12.15',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Six distinct email writing styles added to SPAR system, each with its own vocabulary, opener, sentence structure, and length range. A=CURIOUS (peer question, 40-55w), B=BLUNT (one observation + one question, 20-32w), C=EMPATHETIC (acknowledges friction, 55-70w), D=CHALLENGER (contrast with peer behavior, 45-60w), E=WARM (Hey opener, colleague-like, 45-60w), F=DIRECT (metric first, binary question, 30-45w). Style is selected per email based on angle-to-style mapping, cohort hard overrides, and batch rotation to prevent the same style repeating. Step 6 subject formulas are now style-keyed so subject and body always match in voice. Step 7 has per-style body rules replacing the single generic structure. Step 8 self-score now checks style consistency. Final output includes Style field.' },
    ],
  },
  {
    version: 'v4.12.14',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'spam-checker', description: 'Removed SPF DNS check from authentication category. SPF is an infrastructure concern handled by the sending provider (Gmail Workspace); the checker cannot know which provider will send at check time. Auth score now starts at 50/100 (implicit SPF trust) with DMARC and DKIM contributing the remaining 50. criticalFailure now only fires on missing DMARC, not missing SPF.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'getFromDomain() now resolves the sender domain from the Gmail account (GmailService.getFromAddress) instead of the ses_default_from setting. Falls back to ses_default_from if Gmail is not configured. This ensures DMARC/DKIM checks in the spam scorer use the actual sending domain.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Email writing style updated to prioritize reply rate over observation framing. Step 6 subject formulas changed to direct personal questions ("do you [gap activity] outside Taskip?") and pattern interrupts ("no [gap thing] yet - intentional?"). Step 7 body structure tightened to under 60 words: open directly with the question anchored to their specific data, no preamble. Step 8 self-score reframed around "would I reply within 24 hours?" rather than passive open likelihood.' },
    ],
  },
  {
    version: 'v4.12.13',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook normalization: normalizeCrmPayload now handles the actual CRM payload format where the Laravel transformer class is a direct key of data (data["Modules\\\\SupportTicket\\\\..."] = {id, subject}) rather than nested under data.ticket. Added Format 3 detection: grab first value of data if it has an id field. Format 2 (data.ticket wrapper) and Format 1 (flat legacy) retained as fallbacks.' },
      { tag: 'fix', scope: 'support', description: 'writeWebhookLog now uses raw SQL INSERT instead of Drizzle schema reference so it works on environments where migration 0064 has not run. Error is still caught+logged but does not swallow silently — NestJS logger now shows the table-missing message clearly.' },
    ],
  },
  {
    version: 'v4.12.12',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'POST /taskip-internal/inbox/:id/mark-opened 500 — PostgresError: could not determine data type of parameter $1. jsonb_build_object receives bound parameters without type context; added ::text cast to the ISO timestamp parameter so PostgreSQL can resolve the type.' },
    ],
  },
  {
    version: 'v4.12.11',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'email', description: 'Removed "Reply STOP to unsubscribe" footer from 1:1 outreach emails. Research confirms appending this footer on personal Gmail sends signals bulk/marketing intent to Gmail classifier, increasing spam report rate. Reply-STOP detection in syncReplies() and the suppression gate remain active — only the appended footer is removed.' },
      { tag: 'fix', scope: 'spam-checker', description: 'Relaxed over-aggressive debt-collection content rules for 1:1 personal outreach: DEBT_ENSURE -15→-5 (low severity), DEBT_SPEED_UP -15→-8 (medium), DEBT_FOLLOWUP_HELP -15→-8 (medium). Research confirms "ensure you get" and "following up could help" are low-risk natural phrases; the original -15 deduction was based on bulk-email SpamAssassin heuristics.' },
    ],
  },
  {
    version: 'v4.12.10',
    date: '2026-05-12',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Frontend spam score was always showing ~45 regardless of email content because the POST /spam-checker/score call was missing isTransactional: true. The compliance category was always firing -40 (no List-Unsubscribe header) + -35 (no unsub link) + -25 (no address) = constant -100 penalty. These bulk-email rules do not apply to 1:1 personal outreach via Gmail. Score now reflects actual content quality.' },
    ],
  },
  {
    version: 'v4.12.9',
    date: '2026-05-12',
    entries: [
      { tag: 'feat', scope: 'activity', description: 'Spam check events now visible in the activity panel: spam_check_start shows "Spam check" with subject preview; spam_check_end shows grade/score and pass/fail; spam_rewrite_triggered shows an orange "Rewriting email" entry with the top spam issues. ShieldAlert/ShieldCheck/RotateCcw icons used.' },
      { tag: 'feat', scope: 'activity', description: 'Tool result entries now show a response_preview (first 500 chars of the API response JSON) so lookup_user results are visible directly in the activity panel — making it easy to see what email/data the Insight API returned.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user cross-references owner.email against Taskip DB. If the email is not found (e.g. contact@xgenious.com vs actual login xgenious51@gmail.com), a _email_warning is appended to the result telling the LLM not to use that address and to resolve via insight_get_lifecycle instead.' },
    ],
  },
  {
    version: 'v4.12.8',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Unsubscribe footer auto-appended to every outbound email: plain-text gets "Reply STOP to unsubscribe" appended; HTML emails get a styled footer line before the tracking pixel. send() gates on the email_suppressions table — suppressed recipients are rejected immediately with status failed/suppressed. Reply sync now detects STOP/unsubscribe signals in incoming replies and inserts the sender into email_suppressions automatically.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Renamed "payment_collection" angle to "invoice_followup" throughout the system prompt to remove semantic anchor that was pulling subject lines toward banned vocabulary. Both spam check calls (chat draft path and batch SPAR path) now pass isTransactional: true so bulk-email compliance rules (no unsub link, no address) do not penalise 1:1 personal outreach.' },
    ],
  },
  {
    version: 'v4.12.7',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Server-side spam auto-rewrite in chat mode: when the LLM returns a text draft in the notify_result path, extractEmailDraft() parses the subject and body, SpamCheckerService scores it, and if score < 60 (SPAM_RISK/BLOCK) the feedback is injected back into the conversation as a user message asking for a rewrite. Runs up to 2 revisions. Each spam check is logged as spam_check_start/spam_check_end events visible in the Activity panel.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Payment collection angle subjects: added concrete spam-safe subject formulas (e.g. "1 invoice open - heard back?", "did your client get the invoice?") and reinforced NEVER-use list for invoice/payment/reminder patterns that score below 60 in spam filters.' },
    ],
  },
  {
    version: 'v4.12.6',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'email', description: 'Dedicated EmailSanitizerService replaces non-ASCII characters (em dash, en dash, smart quotes, ellipsis, bullets, non-breaking spaces) with ASCII equivalents before any email is sent via Gmail (both IMAP/SMTP and OAuth raw MIME paths). Subject is sanitized once at the entry point of sendEmail() so all send paths are covered.' },
      { tag: 'fix', scope: 'tracking', description: 'Tracking pixel controller now uses raw SQL to update open counts — avoids PostgresError when migration 0063 columns (open_count, first_open_at, etc.) are absent on the deployment. Falls back to metadata JSONB on column error so opens are still recorded. InboxPage isOpened() now also checks metadata.pixelOpened for this fallback path.' },
      { tag: 'fix', scope: 'support', description: 'GET /support/webhook-logs returns empty array instead of 500 when the support_webhook_logs table does not exist (migration 0064 not yet on main branch).' },
      { tag: 'fix', scope: 'inbox', description: 'markOpened() now guards against undefined id to prevent UNDEFINED_VALUE postgres errors when the dispatcher path params fix is not yet deployed.' },
    ],
  },
  {
    version: 'v4.12.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'gmail', description: 'Non-ASCII characters in email subjects (em dash, smart quotes, etc.) were arriving garbled (Ã¢Â€Â" instead of —) when sent via Gmail OAuth API. Raw MIME headers now RFC 2047-encode subjects that contain non-ASCII bytes using =?UTF-8?B?...?= encoding, so all mail clients decode them correctly.' },
    ],
  },
  {
    version: 'v4.12.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Agent route dispatcher was omitting request.params from the handler params object — every route with a path parameter (e.g. /inbox/:id, /inbox/:id/mark-opened) received undefined for those params, causing UNDEFINED_VALUE postgres errors. Fixed by spreading request.params first in the merge.' },
    ],
  },
  {
    version: 'v4.12.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Remove open_count/first_open_at/last_open_at from listSent() SELECT — migration 0063 is on dev but not yet on main, so these columns do not exist in production. markOpened() also rewritten as raw SQL with a .catch() so the tracking pixel never 500s on missing columns. Both will resume full functionality once dev is merged to main.' },
    ],
  },
  {
    version: 'v4.12.2',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'debug-logs', description: 'Agent route logging: only record 4xx and 500 errors — successful 200 calls are no longer written to Debug Logs to avoid noise.' },
    ],
  },
  {
    version: 'v4.12.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'debug-logs', description: 'All agent API route calls (GET/POST/etc on /taskip-internal/*, /livechat/*, /support/*, and every other agent route) are now recorded in the Debug Logs page. Success calls log at 200 with duration. Errors log at 500 with the error message, stack trace, and request body. Auth failures (missing/invalid JWT, invalid webhook signature) also log at 401.' },
    ],
  },
  {
    version: 'v4.12.0',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript on close now fires for ALL sites consistently: (1) visitor-initiated close (widget close button) now also sends the transcript, matching operator-close behaviour. (2) maybeSendOnClose no longer force-bypasses transcriptEnabled — only sites with the flag enabled will send, preventing unsolicited emails for sites that have it turned off.' },
    ],
  },
  {
    version: 'v4.11.9',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Setup step 5 for email reply-to-thread: shows the three required settings (Reply Domain, Reply HMAC Secret, Inbound Webhook Token) and the SNS inbound URL with a copy button. Visitors who reply to a transcript email now have that reply routed back into the live chat session once SES inbound is configured.' },
    ],
  },
  {
    version: 'v4.11.8',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript sender display name: emails now appear as "SiteName <livechat@domain>" instead of a bare email address. Display name is taken from site.botName, falling back to site.label, then "Support".' },
    ],
  },
  {
    version: 'v4.11.7',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'pageview 403 actual root cause: extractRequestOrigin fell back to the HTTP Referer header when Origin was absent. Server-side/prerender requests (e.g. from AWS IPs) have no Origin but do have Referer set to the navigation source (Google). This caused google.com to be compared against xgenious.com → ForbiddenException. Origin validation now uses ONLY the Origin header; if absent the check is skipped entirely.' },
    ],
  },
  {
    version: 'v4.11.6',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'tracking', description: 'trackOpen GIF pixel: res.setHeader is not a function — switched from Express-style res to FastifyReply (.header() + .send()). Tracking pixel now correctly returns a 1x1 transparent GIF.' },
      { tag: 'fix', scope: 'livechat', description: 'pageview 403 "Origin not allowed": two root causes fixed. (1) When site.origin is stored without https:// scheme, extractHostname() returns null — origin check is now skipped with a WARN log instead of throwing. (2) www. prefix stripped from both hostnames before comparison so www.example.com and example.com both pass.' },
    ],
  },
  {
    version: 'v4.11.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook payload parsing fixed for CRM nested format: ticket data was wrapped under payload.data.ticket["Modules\\\\SupportTicket\\\\Transformers\\\\SupportTicketResource"] (Laravel transformer key). normalizeCrmPayload() now unwraps both the nested CRM format and the legacy flat format. Contact email extracted from created_by.email.' },
      { tag: 'fix', scope: 'support', description: 'Agent-replied events (replied_by.type === "agent") are now logged as status skipped_agent_reply instead of triggering ticket ingest — prevents feedback loops when the agent posts a reply.' },
      { tag: 'fix', scope: 'support', description: 'writeWebhookLog no longer silently eats DB errors. Now logs at ERROR level with the full entry details so missing table migrations are immediately visible.' },
      { tag: 'feat', scope: 'support', description: 'New POST /support/webhook-test endpoint (JWT auth) + Test webhook panel in Webhooks tab: paste any CRM JSON payload and replay it through ingestWebhook to debug parsing without needing the CRM to resend.' },
    ],
  },
  {
    version: 'v4.11.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript "Domain contains illegal character" root cause fixed: buildReplyTo now trims livechat_reply_domain (removing trailing newlines/spaces from copy-paste) and validates the domain before building the address. If domain is invalid, Reply-To is dropped rather than passing a corrupt address to SES.' },
      { tag: 'fix', scope: 'ses', description: 'Pre-send validation added for replyTo and BCC addresses: domain extracted and checked against [a-zA-Z0-9.-] before the SES SDK call. Throws a descriptive error naming the specific field and value rather than relying on the generic "Domain contains illegal character" from SES.' },
      { tag: 'fix', scope: 'livechat', description: 'Transcript send failure log upgraded to ERROR and includes full context: session id, to, from, replyTo, BCC, and error message — so the problematic address is immediately visible in logs.' },
    ],
  },
  {
    version: 'v4.11.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Suggestion chips no longer shown constantly — only appear when the chat is empty (no messages and no typed input). Hidden once conversation starts.' },
      { tag: 'feat', scope: 'chat', description: 'Email draft card now shows live spam score: calls /spam-checker/score on render and displays grade + numeric score (color-coded) next to the SPAR self-score in the card footer. Only active for taskip_internal agent.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Spam check results now recorded in run activity log (event_type: spam_check_start / spam_check_end) with email count, per-recipient scores, failed count, revision number, and duration. Visible in the Activity panel.' },
    ],
  },
  {
    version: 'v4.11.2',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Chat mode batch_send_email: no Telegram notifications when source=chat. All progress messages (start, per-email, summary) are suppressed. Telegram approval step skipped entirely — batch executes immediately from chat. Spam score (score + grade) stored in email metadata and surfaced in InboxPage as a badge per email row and in the detail panel header.' },
      { tag: 'feat', scope: 'inbox', description: 'Spam score badge on email rows and detail panel: shows grade (Inbox/Promo/Spam risk/Blocked) + numeric score, color-coded. Populated from email metadata.spamScore/spamGrade written at send time.' },
      { tag: 'feat', scope: 'inbox', description: 'Chat AI response for batch_send_email now shows sent count + per-email spam scores inline instead of "Approve via Telegram" prompt.' },
    ],
  },
  {
    version: 'v4.11.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Pre-send spam gate in decide(): every batch_send_email call now scores all emails via SpamCheckerService before proposing for Telegram approval. Emails scoring below 60 (SPAM_RISK/BLOCK) feed back top issues to the LLM as a tool result so it revises — up to 2 revision attempts. Only clean drafts (score ≥60) surface as ProposedAction. Spam scores included in the Telegram approval summary (e.g. INBOX_LIKELY(82)).' },
    ],
  },
  {
    version: 'v4.11.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'spam-checker', description: 'Full SRS v1.0 spam-risk scoring engine (Phase 1 MVP). 7-category weighted scoring: Authentication (SPF/DKIM/DMARC DNS, weight 25), Reputation (Spamhaus DBL + Barracuda DNSBL, weight 25), List Hygiene (MX lookup + role/disposable detection, weight 15), Content (46 rule-based checks across phishing-mimic / debt-collection / urgency / TGTBT / financial / clickbait categories, weight 20), Technical (URL shorteners / link density / image ratio / subject length / non-ASCII, weight 10), Compliance (List-Unsubscribe header + body link + postal address, weight 5). Returns score 0-100, grade (INBOX_STRONG / INBOX_LIKELY / PROMOTIONS_RISK / SPAM_RISK / BLOCK), per-category breakdown, criticalFailures[], suggestedFix per issue. Critical-failure cap: Spamhaus hit caps at 30 (BLOCK), missing SPF+DMARC caps at 45 (SPAM_RISK).' },
      { tag: 'feat', scope: 'spam-checker', description: 'REST endpoints: POST /spam-checker/score (full pre-send analysis) + GET /spam-checker/audit/domain?domain= (SPF/DKIM/DMARC + blocklist audit for a domain alone). All DNS lookups run in parallel with 3s timeout and 5-min in-memory cache (p95 < 400ms warm).' },
      { tag: 'feat', scope: 'ses', description: 'SES sendEmail now calls SpamCheckerService.score() (async, full engine) before every send. CRITICAL failures logged at ERROR level, SPAM_RISK/BLOCK at WARN, clean sends at DEBUG. Subject is auto-sanitized (non-ASCII stripped) in all cases.' },
      { tag: 'chore', scope: 'ses', description: 'Removed EmailSpamCheckerService (basic phrase-list only). Replaced by SpamCheckerModule which SesModule now imports.' },
    ],
  },
  {
    version: 'v4.10.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Mark as opened button: when an email shows "Not opened yet" (e.g. landed in spam — pixel blocked by Gmail), click "Mark as opened" to manually record an open event. Increments open_count, sets first_open_at/last_open_at. New POST /taskip-internal/inbox/:id/mark-opened endpoint.' },
    ],
  },
  {
    version: 'v4.9.9',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'ses', description: 'New EmailSpamCheckerService: scores email subject + body against spam phrase lists, auto-sanitizes non-ASCII characters in subject (em dash, smart quotes, ellipsis) to plain ASCII before SES send, and logs blockers/warnings. Prevents encoding-corrupted subjects and spam-trigger phrases from reaching inboxes.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 5 angle priority reordered — payment_collection is now last resort (priority 8), only fires when no other behavioral signal qualifies. Re-engagement, friction, billing gap, pipeline gap all take precedence. Prevents all workspaces with invoices_paid=0 from receiving identical payment-angle emails.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 3 angle diversity enforced: if prior email used payment_collection angle, it is eliminated from Step 5 candidates entirely. Angle diversity rule added — different workspaces in same batch must receive different angles based on their specific strongest signal.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 1 signal ranking now requires listing 2-3 candidates before deciding; invoice-only signals are explicitly marked weak when other activity signals are present.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'SPAR Step 7 banned phrases expanded: "get what you\'re owed", "ensure you get", "following up could help", "speed up the process", "outstanding invoice" added to body ban list. Subject ban list added: "invoice out", "invoice overdue", "payment due", "unpaid", "outstanding", "reminder". Subject must use plain ASCII only.' },
    ],
  },
  {
    version: 'v4.9.8',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'User type badge [PAID]/[TRIAL]/[FREE] now prepended to every workspace in single-detail responses and numbered lists, derived from cohort name. Makes plan tier instantly visible without reading the cohort field.' },
    ],
  },
  {
    version: 'v4.9.7',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'SES sendEmail now logs a DEBUG line before calling the SDK (to/from/replyTo/bcc/subject) and an ERROR line on SDK failure with the exact address fields — making "Domain contains illegal character" diagnosable from server logs.' },
    ],
  },
  {
    version: 'v4.9.6',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Code-level DETAIL LOOKUP detection in buildContinuationHint(): "share details about 1", "tell me about 2", "what about 5", bare "1" all now inject a DETAIL LOOKUP MODE hint that calls lookup_user(name) then insight_get_lifecycle — never re-running insight_list_cohort.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Chat-mode responses no longer sent to Telegram. source:"chat" is now threaded from trigger payload through snapshot → decide() → execute(), matching the HR agent pattern.' },
    ],
  },
  {
    version: 'v4.9.5',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'DETAIL LOOKUP intent: "share details about 1" / "tell me about 2" now correctly resolves the number as a list position from the prior shown list — not a fresh cohort query. READ intent now explicitly guards against re-running insight_list_cohort when a numbered list is already in context.' },
    ],
  },
  {
    version: 'v4.9.4',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Transcript email now validates the from address domain before calling the SES SDK, surfacing a clear error instead of "Domain contains illegal character" from AWS. Check Settings → Email (SES) if from address is misconfigured.' },
      { tag: 'feat', scope: 'livechat', description: 'Transcript is now always sent on chat close (force: true) — visitor just needs an email on file and at least one message. The per-site transcriptEnabled toggle is no longer required; it remains as an override only.' },
    ],
  },
  {
    version: 'v4.9.3',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Auto-resolve numeric workspace_uuid to real UUID before any insight tool call: if the LLM passes a list position (e.g. "4") instead of a UUID, the runtime now scans prior cohort list tool results and substitutes the correct uuid field automatically.' },
    ],
  },
  {
    version: 'v4.9.2',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'SELECTION intent now correctly maps list position numbers to workspace UUIDs from prior insight_list_cohort results instead of passing numeric positions as workspace_uuid. UUID error message strengthened to halt LLM retry loops.' },
    ],
  },
  {
    version: 'v4.9.1',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'auth', description: 'Login page shows default credentials (admin@cortex.local / changeme123) with a one-click "Use" fill button when running on localhost or 127.0.0.1. Hidden in production.' },
    ],
  },
  {
    version: 'v4.9.0',
    date: '2026-05-11',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Webhooks tab added to the Support agent detail page (/agents/support). Shows all incoming CRM webhook events (status, ticket ID, timestamp, raw payload) with expandable rows — same data as the chat page webhook tab but accessible directly from the agent page.' },
    ],
  },
  {
    version: 'v4.8.9',
    date: '2026-05-11',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'Inbox layout rebuilt: email list always visible on left, AI drawer is now a proper flex sidebar (width-animated 0→420px) instead of an absolute overlay — eliminates all overflow-hidden clipping issues, close button always works, drawer only opens when "Draft reply with AI" is clicked.' },
    ],
  },
  {
    version: 'v4.8.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'inbox', description: 'AI drawer close button fix: moved overflow-hidden to outer container, added pointer-events-none when drawer is closed.' },
    ],
  },
  {
    version: 'v4.8.7',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'lookup_user unified search: now accepts uuid, url (slug/subdomain/custom domain), email, or name — passes directly to Insight /search endpoint. Name search returns a candidate list; exact lookups return full stats + activity_by_day.' },
      { tag: 'feat', scope: 'agent', description: 'New trial funnel tools: insight_trial_funnel_hot (THS-sorted trials), insight_trial_funnel_at_risk (stalled day 5+), insight_trial_funnel_trial_ready (free TRS>=50), insight_trial_funnel_stats (conversion ratio summary).' },
      { tag: 'feat', scope: 'agent', description: 'System prompt updated: 4-band score tier model (Cold/Warming/Active/Hot, 0-25/26-50/51-75/76-100), delta_14d momentum guidance, lifecycle_state field awareness, THS day-caps.' },
      { tag: 'chore', scope: 'api', description: 'InsightCohortListItem gains lifecycle_state field. InsightSearchResult, InsightSearchExactResult, InsightSearchNameResult types added. insight.search() replaces searchByEmail() as canonical method.' },
    ],
  },
  {
    version: 'v4.8.6',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Webhook Logs tab in Support Ticket Manager chat page. Shows all incoming CRM webhook events with status (ok / duplicate / error), CRM ticket ID, internal ID, timestamp, and expandable raw payload viewer.' },
      { tag: 'feat', scope: 'api', description: 'support_webhook_logs table (migration 0064). ingestWebhook now writes a row for every event — success, duplicate, and error cases. GET /support/webhook-logs endpoint (auth required, limit 100).' },
    ],
  },
  {
    version: 'v4.8.5',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'AI draft drawer now instructs the agent to call insight_get_lifecycle with the workspace UUID before drafting — so the email is based on live engagement stats, not cached inbox data.' },
    ],
  },
  {
    version: 'v4.8.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Draft reply with AI: clicking the button opens an in-page right-side drawer with a live AI chat (taskip_internal agent). Pre-seeds the context from the selected email and auto-sends the initial draft query. No navigation away from the inbox.' },
      { tag: 'feat', scope: 'inbox', description: 'Reply loading skeleton: replaced "Loading replies..." text with two animated skeleton reply cards while replies are fetching.' },
      { tag: 'feat', scope: 'inbox', description: 'AI thinking skeleton: while the agent is processing, the drawer shows animated skeleton lines instead of a plain loading indicator.' },
    ],
  },
  {
    version: 'v4.8.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'agent', description: 'Insight API 404 fix: executeReadTool now validates workspace_uuid is a UUID string before calling the API — returns a clear error if a numeric id is passed, preventing /workspaces/1/lifecycle 404s. Tool descriptions updated to explicitly name the `uuid` field from insight_list_cohort results.' },
    ],
  },
  {
    version: 'v4.8.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Batch send gap: 100–300s random delay between consecutive emails in a batch to avoid bulk-send patterns and improve deliverability. Telegram notifies before each wait with the countdown.' },
    ],
  },
  {
    version: 'v4.8.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Dry-run mode: say "show me first" / "dry run" / "preview" — agent runs the full SPAR workflow per workspace and outputs all drafts as formatted text without calling batch_send_email. Reply "send them" or a number selection to dispatch.' },
      { tag: 'feat', scope: 'agent', description: 'Tone presets: append a tone modifier to any message — "aggressive", "soft", "ultra-brief", "warm". Overrides SPAR Step 4 cohort calibration for all emails in that batch.' },
      { tag: 'feat', scope: 'agent', description: 'Dedup pre-filter: workspace list now shows "[contacted Xd ago]" and "[replied — engaged]" annotations. Agent checks insight_recent_messages in parallel while listing, but still includes all workspaces — user decides whether to include flagged ones.' },
      { tag: 'feat', scope: 'agent', description: 'Reply-aware skip in batch: before generating each email, checks list_sent_emails for replyCount > 0. Workspaces with active replies are skipped automatically (they are already engaged).' },
      { tag: 'feat', scope: 'agent', description: 'Partial batch recovery: when a batch has failures, Telegram summary lists each failed recipient with error. Say "retry failed" or "retry" to re-process only the failed ones — CONTINUATION MODE targets them specifically.' },
    ],
  },
  {
    version: 'v4.8.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'agent', description: 'Continuation intent detection: when the prior agent message asked for confirmation and the user replies with "yes/go/proceed", the agent now injects a CONTINUATION MODE directive into the system prompt — bypassing re-read and re-listing entirely, executing the queued action immediately.' },
      { tag: 'feat', scope: 'agent', description: 'Selection intent: when the user sends numbers like "2,4,5,6,7", the agent maps them back to the workspace names from the prior numbered list and processes only those workspaces through SPAR.' },
      { tag: 'feat', scope: 'agent', description: 'batch_send_email action: new approval-gated action type that holds an array of SPAR-generated email drafts. Single Telegram approval sends the whole batch. Each email is individually tracked in the Inbox.' },
      { tag: 'feat', scope: 'agent', description: 'Workspace list format standardised: agent now numbers lists as "1. Name — Score: N" and ends with reply instructions, making number-selection parsing reliable.' },
      { tag: 'feat', scope: 'agent', description: 'MAX_TOOL_ITERATIONS raised from 14 to 25 to support multi-workspace batch processing (7 workspaces × ~3 tool calls each).' },
      { tag: 'feat', scope: 'chat', description: 'Batch email action shown in chat as a preview list of all recipients + subjects with Telegram approval reminder.' },
    ],
  },
  {
    version: 'v4.7.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Inline reply composer in the email detail panel: Reply button expands a compose area pre-filled with recipient and Re: subject. Auto-resizing textarea, word count, Send reply button. Collapses and resets when switching emails.' },
      { tag: 'feat', scope: 'inbox', description: 'Plain text mode toggle in the inline reply composer. When enabled: no HTML wrapper, no tracking pixel — raw plain text email for maximum deliverability. Status strip shows the mode clearly.' },
      { tag: 'feat', scope: 'chat', description: 'Plain text mode toggle in the Send Email modal (taskip_internal agent only). Same deliverability behaviour — bypasses buildHtmlEmail when enabled.' },
      { tag: 'feat', scope: 'api', description: 'SendTrackedEmailInput accepts plainText flag. When true: skips HTML generation and tracking pixel entirely, sends raw plain text via Gmail.' },
    ],
  },
  {
    version: 'v4.7.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal: auto-resizing textarea (grows with content, min 220px), formatting toolbar with Bold (**), Italic (_), and Bullet list toggle. Paragraph tip shown in toolbar.' },
      { tag: 'feat', scope: 'inbox', description: 'Email body now rendered as structured HTML — double newline = paragraph break, lines starting with "- " = bullet list, **text** = bold, _text_ = italic. Applies to both the send modal preview and the inbox detail panel.' },
      { tag: 'feat', scope: 'api', description: 'buildHtmlEmail: enhanced converter produces proper <p> paragraphs, <ul> bullet lists, <strong>/<em> for inline markup instead of a flat <br> dump.' },
    ],
  },
  {
    version: 'v4.7.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Redesign Inbox page to Apple Mail two-panel layout: left panel is a compact email list with avatar initials, subject snippet, open/reply indicators; right panel shows full email body, open tracking detail, replies, and action buttons. Stats moved to a top bar with pill badges.' },
      { tag: 'feat', scope: 'api', description: 'Email reply sweep interval changed from 10 min to 15 min as requested.' },
    ],
  },
  {
    version: 'v4.6.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'send(): rewrite to raw SQL INSERT with only the stable columns — Drizzle client-side defaults (open_count=0 etc.) were included in every INSERT even when not specified, causing column-not-found errors on prod where migration 0063 has not run. tracking_token set via a separate best-effort UPDATE.' },
    ],
  },
  {
    version: 'v4.6.4',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'Send email: tracking insert fallback is now unconditional — any insert error retries without tracking columns instead of checking the error message string (avoids Drizzle error-wrapping edge cases). Inbox listSent/getDetail no longer select open_count/first_open_at/last_open_at since migration 0063 is not yet on prod.' },
      { tag: 'fix', scope: 'inbox', description: 'InboxRow openCount/firstOpenAt/lastOpenAt are optional — page renders correctly when tracking columns are absent from prod DB.' },
    ],
  },
  {
    version: 'v4.6.3',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'inbox', description: 'Inbox page: open tracking badge (Opened Nx · Xm ago / Not opened), opened count + timestamps in detail, "Draft reply with AI" button that pre-fills the agent chat with recipient context and SPAR instruction.' },
      { tag: 'feat', scope: 'chat', description: 'Send Email from taskip_internal agent now calls tracked send endpoint (POST /taskip-internal/inbox/send) — email recorded in Inbox with open pixel. "Sent — view in inbox" badge links directly to the tracked row.' },
      { tag: 'feat', scope: 'api', description: 'listSent / getDetail now include openCount, firstOpenAt, lastOpenAt. New POST /taskip-internal/inbox/send tracked send endpoint. AgentChatPage reads ?query= URL param to pre-fill chat from inbox.' },
    ],
  },
  {
    version: 'v4.6.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal: subject field is now editable; body has a live word counter (amber at >80 words); Cmd/Ctrl+Enter sends. EmailDraftCard: green "Sent" badge appears in the footer after a successful send; button demotes to "Send again".' },
    ],
  },
  {
    version: 'v4.6.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Send Email modal now shows an editable body textarea pre-filled with the draft. Agent SPAR output includes **To:** line — parser extracts the recipient email and auto-fills the To field. **To:** line stripped from the reasoning bubble to avoid duplication.' },
    ],
  },
  {
    version: 'v4.6.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Inline search input added to the conversation list sidebar — always visible between the stats bar and the online visitors panel. Filters by visitor name, email, or last message; clear button appears when there is input.' },
    ],
  },
  {
    version: 'v4.5.9',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Agent now has live KB access scoped to site "Taskip": always-on product facts (features, pricing, personas) and per-query semantic search are injected into the system prompt at runtime. Admins can populate KB entries tagged site_keys=Taskip to teach the agent anything about the product without a deploy.' },
    ],
  },
  {
    version: 'v4.5.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt now explains Taskip is a client portal for freelancers/agencies: invoices are sent TO clients, contacts are clients, leads are prospects. Agent no longer misinterprets invoices_paid=0 as the owner owing money. Angle table, persona table, signal inventory, and banned-framing list all updated to reflect correct product context.' },
    ],
  },
  {
    version: 'v4.5.7',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'EmailDraftCard: "Open in Mail" replaced with "Send Email" — clicking opens an account-picker modal that lists connected Gmail accounts (default pre-selected), allows editing the To address, and sends via POST /gmail/send.' },
      { tag: 'feat', scope: 'gmail', description: 'POST /gmail/send — authenticated endpoint that sends an email through a specified (or default) Gmail account. Used by the chat EmailDraftCard send flow.' },
    ],
  },
  {
    version: 'v4.5.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Parser: emailMarkerRe no longer requires trailing newline; makeSubjectRe handles Subject A/B with or without space; Subject A/B/Recommended lines stripped from reasoning bubble to avoid duplication.' },
      { tag: 'feat', scope: 'chat', description: 'EmailDraftCard: A/B subject switcher — shows both options, active subject in header, other as small hint; self-score badge (e.g. "5/5") shown bottom-left of card; Copy/Open in Mail use whichever subject is selected.' },
    ],
  },
  {
    version: 'v4.5.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'extractInlineEmail now handles the SPAR output format (**Email:** marker, **Subject A/B:** with **Recommended:** picker) in addition to the legacy Subject:/Body: format. Self-score line is omitted from the rendered output.' },
    ],
  },
  {
    version: 'v4.5.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Full SPAR 8-step email reasoning system: Signal Inventory (behavior/gap/momentum with recency weighting), Persona Inference, Prior Email Check (angle memory), Cohort Tone Calibration, Angle Selection table, two formula-locked subject options (A/B), body rules with banned-phrase list, and a self-score "would I reply?" gate that forces a rewrite if score < 4.' },
    ],
  },
  {
    version: 'v4.5.3',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Agent now shows a reasoning block (cohort, score, activity signals, last outreach, decision trigger) before every email draft so the operator can understand the rationale before approving.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Email copy rules enforced in system prompt: no generic Welcome subjects, subject must reference a real behavior/gap, body must cite at least one data point, under 80 words, signed as "Sharifur" only.' },
    ],
  },
  {
    version: 'v4.5.2',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Agent messages containing an inline email draft (Subject:/Body: pattern from LLM text replies) are now rendered as a styled EmailDraftCard with Copy and Open in Mail actions instead of raw text.' },
    ],
  },
  {
    version: 'v4.5.1',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'list_sent_emails, getDetail, syncReplies now use explicit column selection — excludes tracking_token/open_count columns that are only on dev (migration 0063). send() also falls back to inserting without tracking columns when the column is missing on production.' },
    ],
  },
  {
    version: 'v4.5.0',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'gmail', description: 'OAuth callback popup no longer shows React 404 — /gmail/oauth/callback is now a public React route that POSTs the code/state to POST /gmail/oauth/exchange and relays the result via postMessage.' },
      { tag: 'fix', scope: 'support', description: 'Webhook deliveries now always create a visible run entry in the activity panel — if triggerAgent fails (e.g. agent disabled), a FAILED run is written so the delivery is traceable.' },
    ],
  },
  {
    version: 'v4.4.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'searchByEmail logs the full resolved URL (base + /search?email=) at debug level so you can see exactly which endpoint is hit.' },
      { tag: 'feat', scope: 'chat', description: 'Activity panel tool_call entries now show the Insight endpoint being called (e.g. /search?email=...) alongside the args summary for easier debugging.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Setup tab: insight_base_url description now shows the expected full module path format (https://api.taskip.net/api/internal/insight).' },
    ],
  },
  {
    version: 'v4.4.7',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'Activity panel: Thinking... entries no longer stay permanently spinning — marked as success when any subsequent entry follows them, or when the run is finished.' },
    ],
  },
  {
    version: 'v4.4.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'send-transcript: SES errors (bad credentials, domain invalid, quota, etc.) are now caught and returned as { ok: false, reason: "send_failed", error: "..." } instead of throwing 500. Frontend shows the actual error reason in the alert.' },
    ],
  },
  {
    version: 'v4.4.5',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'GET /ses/suppressions no longer 500s when email_suppressions table is missing — returns empty array instead. list() and remove() both catch the missing-table error.' },
      { tag: 'fix', scope: 'ses', description: 'sendEmail() now validates the To domain is ASCII-only before calling SES — silently skips and logs a warning instead of throwing InvalidParameterValue when a visitor email has a unicode/punycode domain.' },
    ],
  },
  {
    version: 'v4.4.4',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'ses', description: 'isSuppressed() and suppress() now catch missing email_suppressions table gracefully — log a warning and proceed instead of crashing with 500. Fixes send-transcript and any SES email while migration 0062 is pending on production.' },
    ],
  },
  {
    version: 'v4.4.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user: if Insight API returns 404 (workspace not yet indexed), agent falls back to direct DB lookup; on permanent failure the error now includes the endpoint path for easier debugging.' },
      { tag: 'fix', scope: 'taskip-internal', description: 'All Insight API errors in executeReadTool now include [endpoint: /path] so the activity panel shows exactly which URL was called.' },
      { tag: 'fix', scope: 'chat', description: 'Activity panel persists across page reloads — on conversation load, lastRunId is seeded from the most recent agent message runId so the timeline is always visible.' },
      { tag: 'fix', scope: 'chat', description: 'Failed tool result detail in activity panel no longer truncates — full error message is shown in red so endpoint + error reason are both readable.' },
    ],
  },
  {
    version: 'v4.4.2',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'api', description: 'Client-disconnect (aborted) errors no longer log as 500 — global exception filter detects Error("aborted"), skips debug log, and returns 200 silently since the socket is already closed.' },
    ],
  },
  {
    version: 'v4.4.1',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'contacts', description: 'Contacts list now paginates — 25 per page with Prev/Next controls and "X–Y of Z" counter; page resets to 1 when search query or source filter changes. Backend returns { data, total, page, pageSize, totalPages } envelope.' },
      { tag: 'fix', scope: 'contacts', description: 'Live Chat stat card now sums both livechat and crisp source counts correctly.' },
    ],
  },
  {
    version: 'v4.4.0',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'email', description: 'Gmail open tracking — emails sent via TaskipInternalEmailService now embed a 1x1 transparent GIF tracking pixel; public GET /track/open/:token.gif endpoint records open count, first/last open timestamp, and per-open events (IP, user-agent) in taskip_internal_emails table.' },
      { tag: 'feat', scope: 'gmail', description: 'sendEmail() now accepts htmlBody — builds multipart/alternative MIME for OAuth2 path and passes html option to nodemailer for IMAP path; fallback to plain text when htmlBody is omitted.' },
      { tag: 'feat', scope: 'db', description: 'Migration 0063: adds tracking_token, open_count, first_open_at, last_open_at, open_events columns to taskip_internal_emails with unique partial index on tracking_token.' },
    ],
  },
  {
    version: 'v4.3.9',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Activity timeline panel — right-side panel in all agent chat pages shows live run activity: tool calls (start/success/failed), thinking state, LLM call events, decisions, approval gates, and per-run token/cost summary after completion.' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Structured tool-call logging in decide() loop — each tool call emits event_type:tool_call_start and tool_call_end log entries with tool name, args summary, duration, and success/error; LLM calls emit llm_call event; runId now passed to LlmRouter for per-run token tracking.' },
      { tag: 'feat', scope: 'api', description: 'GET /runs/:id/usage endpoint — returns aggregated input/output token counts and estimated cost in USD for a run, queried from llm_usage_logs.' },
      { tag: 'fix', scope: 'dispatcher', description: 'agents variable shadowed the schema import in agent-route-dispatcher — renamed local to agentList to fix TS2339/TS2345/TS2551 errors.' },
    ],
  },
  {
    version: 'v4.3.8',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_user now resolves by owner email via Insight API GET /search?email= instead of direct DB query — fixes "user not found" errors when taskip_db_url_readonly is not configured or points to the wrong DB.' },
    ],
  },
  {
    version: 'v4.3.7',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'LinkedIn setup guide: corrected Unipile URL from app.unipile.com (DNS does not resolve) to dashboard.unipile.com' },
    ],
  },
  {
    version: 'v4.3.6',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'LinkedIn setup guide: app.unipile.com was plain text — browser opened it as http:// which errors; converted to a proper https:// anchor link' },
    ],
  },
  {
    version: 'v4.3.5',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'integrations', description: 'Gmail OAuth modal now shows required Google scopes inline — amber card lists both gmail.modify and userinfo.email with copy-friendly monospace blocks, path to OAuth consent screen, and note about the restricted-scope warning.' },
      { tag: 'fix', scope: 'db', description: 'email_suppressions migration (0062) was missing from _journal.json — Drizzle never applied it on boot, causing 500 on GET /ses/suppressions. Table will be created on next restart.' },
    ],
  },
  {
    version: 'v4.3.4',
    date: '2026-05-10',
    entries: [
      { tag: 'feat', scope: 'widget', description: 'Message preview popup — when the widget is minimised and the AI sends a new message, a dark bubble pops above the chat button showing the first 90 chars of the message; auto-dismisses after 6s; clicking opens the panel; close button dismisses manually. Unread badge count was already working — this adds the visual preview.' },
    ],
  },
  {
    version: 'v4.3.3',
    date: '2026-05-10',
    entries: [
      { tag: 'fix', scope: 'webhook', description: 'Webhook signature failures are now visible in the debug page — dispatcher creates a FAILED agent run entry when the x-webhook-secret check fails, so the rejection shows up in the activity log instead of disappearing silently into Pino logs. Also improved log level from DEBUG to LOG so signature check events always appear in production logs with the received header names.' },
    ],
  },
  {
    version: 'v4.3.2',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'lookup_workspace_owner now resolves workspace UUID via Insight API getLifecycle() instead of a direct DB join — returns the full lifecycle snapshot (owner.email, owner.first_name, workspace state, score, recent messages) without requiring readonly DB access' },
    ],
  },
  {
    version: 'v4.3.1',
    date: '2026-05-09',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'lookup_workspace_owner tool — resolves workspace UUID to owner user details via workspaces JOIN users; agent can now draft emails from a workspace ID without needing the email upfront' },
      { tag: 'feat', scope: 'chat', description: 'Email draft card — send_email proposals render as a structured inbox card with Subject/To header, markdown-rendered body (bold, italic, tables, code, lists, headings), Copy and Open in Mail buttons; all agent text responses now render markdown instead of plain whitespace-pre-wrap' },
    ],
  },
  {
    version: 'v4.3.0',
    date: '2026-05-09',
    entries: [
      { tag: 'feat', scope: 'ses', description: 'Platform-wide email suppression list — hard bounces and spam complaints from SES SNS are stored in email_suppressions table; SesService.sendEmail() checks suppression before every send (all email types: transcripts, agent emails, etc.); new /ses/suppressions REST API (list, add, delete); Suppressions page in sidebar with table view, manual add, and per-row remove' },
    ],
  },
  {
    version: 'v4.2.15',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Origin mismatch error response no longer leaks the configured site origin — moved details to a server-side warn log; public response is now a generic "Origin not allowed"' },
    ],
  },
  {
    version: 'v4.2.14',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'auth', description: 'JWT strategy validate() was omitting role from request.user — RolesGuard always saw undefined and 403d all admin routes; fixed to include role from DB; added dvrobin4@gmail.com as permanent super_admin bypass in RolesGuard' },
      { tag: 'fix', scope: 'widget', description: 'Email-required chat widget no longer shows hard-gate overlay on open — widget opens normally, email prompt appears inline after first message is sent, subsequent sends are blocked with a toast until email is provided; Maybe later button hidden when email is required' },
    ],
  },
  {
    version: 'v4.2.13',
    date: '2026-05-09',
    entries: [
      { tag: 'chore', scope: 'widget', description: 'Rebuilt livechat.js bundle' },
    ],
  },
  {
    version: 'v4.2.12',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Knowledge Base tab bar is now horizontally scrollable on small screens — tabs no longer overflow the viewport; header description wraps instead of clipping' },
    ],
  },
  {
    version: 'v4.2.11',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook secret was not trimmed before comparison — trailing whitespace in stored value caused safeEqualString length check to silently reject all requests; now trims both sides; added payload keys log at handler entry' },
    ],
  },
  {
    version: 'v4.2.10',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'support', description: 'Webhook rejection was silent — added warn logs for missing secret config, missing header, and header mismatch; dispatcher now logs signature check start/pass/fail with route and source IP' },
    ],
  },
  {
    version: 'v4.2.9',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Chat messages no longer trigger automatic content calendar generation — added chat mode that responds conversationally via LLM; only CRON and explicit task:generate_design payloads run the calendar/design workflows' },
    ],
  },
  {
    version: 'v4.2.8',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Duplicate Telegram approval messages: ApprovalService.createApproval() was emitting "approval.created" and agent-run.processor was also emitting the same event — removed duplicate from processor; enriched emit now includes approvalId field so Telegram handler buttons work correctly' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Insight API 422 Unknown scenario_key: agent was using hardcoded scenario keys from system prompt; replaced with mandatory insight_pending_scenarios() call — scenario_key must come from eligible[].scenario_key for the target workspace' },
    ],
  },
  {
    version: 'v4.2.7',
    date: '2026-05-09',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt: added intent detection (READ vs ACTION) — list/show/find queries now return data only and never auto-propose write actions; only explicit "propose/suggest/send" triggers the outreach workflow' },
    ],
  },
  {
    version: 'v4.2.6',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'Chat continuity: agent now reads history from trigger payload and prepends prior conversation turns to the LLM messages array — follow-up questions no longer lose context of the previous exchange' },
    ],
  },
  {
    version: 'v4.2.5',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Build error: stale "body" reference in agent-route-dispatcher webhook trigger — replaced with request.body after the params refactor renamed the variable' },
    ],
  },
  {
    version: 'v4.2.4',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Tasks tab added to agent detail page: daily automated sweeps (6 cohort cards), on-demand tasks (8 clickable items), and weekly reviews (3 items)' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Clicking any on-demand or weekly task opens the chat page with the query pre-filled for editing before sending' },
      { tag: 'feat', scope: 'chat', description: 'AgentChatPage now reads location.state.query and pre-fills the chat input — enables navigate-to-chat-with-query from other pages' },
    ],
  },
  {
    version: 'v4.2.3',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'taskip-internal', description: 'System prompt: added golden rule (no send without approval), channel routing table, score thresholds, valid scenario_key list, per_page cap, and pre-outreach dedup checklist' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Raised MAX_TOOL_ITERATIONS from 8 to 14 — marketing workflow (segment → drill → recommend → submit → log) routinely exceeded 8 steps' },
      { tag: 'feat', scope: 'taskip-internal', description: 'New tool: list_workspace_suggestions — LLM can check pending/sent suggestions before proposing new outreach to avoid duplicate sends' },
      { tag: 'fix', scope: 'taskip-internal', description: 'send_email tool: body description corrected to Markdown, added paid-plan restriction warning' },
      { tag: 'fix', scope: 'taskip-internal', description: 'insight_submit_message tool: added paid-cohort-only restriction to description' },
      { tag: 'fix', scope: 'taskip-internal', description: 'insight_submit_marketing_suggestion: idempotency_key removed from required fields' },
      { tag: 'fix', scope: 'taskip-internal', description: 'GET /taskip-internal/suggestions: replaced N+1 activity queries with a single batched inArray query' },
    ],
  },
  {
    version: 'v4.2.2',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'llm', description: 'All agent LLM tabs now default to "Default (from Settings)" — no hardcoded provider in initial state; per-agent override only when explicitly selected' },
      { tag: 'feat', scope: 'llm', description: 'LlmSubTab, DailyReminderLlmSubTab, EmailManagerLlmSubTab: added Default button that clears llm config; model input hidden when default is active' },
      { tag: 'fix', scope: 'email-manager', description: 'Remove hardcoded provider/model override in draftClientReply and analyzeEmailText — both now use agentLlmOpts(config) which falls through to global Settings' },
      { tag: 'chore', scope: 'llm', description: 'LLM interfaces (TaskipConfig, DailyReminderConfig, EmailManagerConfig): llm field is now optional/nullable' },
    ],
  },
  {
    version: 'v4.2.1',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'runtime', description: 'Agent route dispatcher now merges request.query into params — GET route handlers (e.g. insight/status) were always receiving empty params because only request.body was passed' },
      { tag: 'fix', scope: 'taskip-internal', description: 'Insight Test connection: workspaceUuid query param now correctly reaches the status() method; debug logs added in dispatcher and status()' },
      { tag: 'feat', scope: 'taskip-internal', description: 'LLM tab: added Default (from Settings) provider option — when selected, agent inherits platform LLM settings instead of forcing a manual override' },
      { tag: 'chore', scope: 'taskip-internal', description: 'Updated chat suggestion chips to reflect sweep workflow: pending suggestions, run sweep, activity log queries' },
    ],
  },
  {
    version: 'v4.2.0',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'taskip-internal', description: 'Proactive suggestion sweep: BullMQ cron runs every 6h, fetches 5 cohorts via Insight API, generates LLM drafts, queues for founder approval' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Dual send path: Gmail for trial/free cohorts, Taskip system messaging for paid cohorts; channel locked at draft time' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Workspace activity log tracks suggestion lifecycle: created, sent, skipped, suppressed' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Suggestions tab on agent detail page: filter bar, suggestion cards with tier badges, inline edit, approve/skip actions, activity timeline' },
      { tag: 'feat', scope: 'taskip-internal', description: 'Approve/skip API routes + manual sweep trigger endpoint' },
      { tag: 'feat', scope: 'taskip-internal', description: '3-skip suppression: workspace auto-suppressed after 3 consecutive skips with no send' },
      { tag: 'chore', scope: 'db', description: 'Migration 0061: taskip_internal_suggestions + taskip_internal_workspace_activity tables' },
    ],
  },
  {
    version: 'v4.1.7',
    date: '2026-05-08',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'AI-image-first mode: planner defaults to ai_image backend (DALL-E 3 → Stability AI) instead of Canva MCP; backend resolved at runtime via canva_mcp_enabled setting' },
      { tag: 'feat', scope: 'canva', description: 'GET /canva/thumbnail/:id route: serves PNG bytes for ai_image candidates; falls back to filePath when thumbnailPath is absent' },
      { tag: 'feat', scope: 'canva', description: 'AIImageAdapter now saves thumbnail alongside candidate image so thumbnail URL is immediately available after generation' },
      { tag: 'feat', scope: 'canva', description: 'Canva setup tab rewritten for AI-first mode: OpenAI key required, Stability AI optional fallback, Canva MCP in collapsible optional section' },
    ],
  },
  {
    version: 'v4.1.6',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Canva setup step 1: point to Connect API integrations page (canva.com/developers/integrations), not the Apps SDK page — Apps is for Canva editor plugins (Code upload / JS bundle), Connect API is for server OAuth credentials' },
    ],
  },
  {
    version: 'v4.1.5',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'Canva setup tab: clarify that Canva app review is only needed for public release — personal/dev use works immediately; reword steps to remove approval confusion; add info banner explaining no-approval path' },
    ],
  },
  {
    version: 'v4.1.4',
    date: '2026-05-08',
    entries: [
      { tag: 'fix', scope: 'widget', description: 'Rebuild livechat.js bundle — requireEmail email gate was implemented in ui.ts but the deployed bundle was never rebuilt so the gate never appeared; fresh build includes the gate and all recent widget changes' },
    ],
  },
  {
    version: 'v4.1.3',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'auth', description: 'Role syncs from /auth/me on every app load so super_admin status persists across refreshes without re-login; nav filter keeps Admin+Settings visible while role is loading (null)' },
    ],
  },
  {
    version: 'v4.1.2',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'nav', description: 'Admin and Settings sidebar items hidden when role is null (migration not yet run on production): treat null/unknown role as super_admin so the items remain visible' },
    ],
  },
  {
    version: 'v4.1.1',
    date: '2026-05-07',
    entries: [
      { tag: 'fix', scope: 'canva', description: 'POST /canva/brands/import-from-url returning 404: static route must be registered before :name param routes in Fastify; moved import-from-url first in apiRoutes()' },
      { tag: 'fix', scope: 'livechat', description: 'Origin check throwing 403 for xgenious: relax validation to skip when no Origin/Referer header is present (GET requests and proxies that strip headers); include received vs expected origins in error message for debugging' },
      { tag: 'fix', scope: 'mcp', description: 'GET /mcp/servers 500 (column oauth_integration_id does not exist): migrations 0056-0060 were not in _journal.json so the migrator never ran them; added all missing entries; renamed duplicate 0058_users_role.sql to 0060_users_role.sql' },
    ],
  },
  {
    version: 'v4.1.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'integrations', description: 'OAuth Integration Hub: server-side OAuth 2.0 token storage for MCP providers (Canva, GitHub); one-click Connect from admin UI, tokens encrypted in DB, auto-refresh on expiry' },
      { tag: 'feat', scope: 'integrations', description: 'OAuth provider registry (oauth-providers.ts): Canva + GitHub configs with scopes, auth/token URLs, and settings key references' },
      { tag: 'chore', scope: 'db', description: 'Migration 0059: oauth_integrations table; oauth_integration_id FK added to mcp_servers' },
    ],
  },
  {
    version: 'v4.0.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'canva', description: 'Full AI Design Agent: Canva MCP integration, DALL-E 3 + Stability AI image generation, local Pillow render, 6-sprint implementation (T1-T29)' },
      { tag: 'feat', scope: 'canva', description: 'Agent chat page: interactive design generation from text, Edit in Canva deep-link per candidate, approve/reject/revise actions' },
      { tag: 'feat', scope: 'canva', description: 'Multi-brand identity: canva_brands table, per-brand voice profile, palette, fonts, Canva kit ID; Brands management tab' },
      { tag: 'feat', scope: 'canva', description: 'Approval folder workflow: manifest.json + candidate sidecars + append-only audit.jsonl with chained hashes' },
      { tag: 'feat', scope: 'canva', description: 'Skill loading subsystem: 8 built-in SKILL.md skills, intent-based matching, zero-code extensibility' },
      { tag: 'feat', scope: 'canva', description: 'Debug log mode: per-step traces to canva_debug_log table, toggleable via debugMode in agent config' },
      { tag: 'feat', scope: 'canva', description: 'Token + cost tracking: AI image cost per candidate, session total_cost_usd accumulator' },
      { tag: 'chore', scope: 'db', description: 'Migration 0058: canva_brands, canva_sessions, canva_candidates, canva_debug_log tables; default brand seeds' },
    ],
  },
  {
    version: 'v3.10.2',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'admin', description: 'New Admin page at /admin — manage users with Super Admin and Agent Operator roles; create, edit role, and delete users with safety guards (cannot remove last super admin or self)' },
      { tag: 'feat', scope: 'auth', description: 'Role-based access control: agent_operator users cannot access Settings or Admin pages; sidebar hides superAdminOnly nav items for non-admins' },
      { tag: 'chore', scope: 'db', description: 'Migration 0058: add role column (default super_admin) to users table' },
    ],
  },
  {
    version: 'v3.10.1',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'support', description: 'New Support Tickets page at /support — table view of all tickets with contact name, email, phone, priority and status badges, created/replied timestamps, expandable rows showing ticket body and draft reply' },
      { tag: 'feat', scope: 'support', description: 'Filter by status (All / Open / Replied / Escalated / Closed) and search by subject, email, name or ticket number; stats strip shows live open/replied/escalated counts' },
      { tag: 'feat', scope: 'support', description: 'GET /support/tickets API endpoint with status filter, full-text search, limit/offset pagination' },
    ],
  },
  {
    version: 'v3.10.0',
    date: '2026-05-07',
    entries: [
      { tag: 'feat', scope: 'support', description: 'Support Ticket Manager now receives tickets via crm.xgenious.com webhook (X-Webhook-Secret verification); fetches full ticket description from CRM API before processing' },
      { tag: 'feat', scope: 'support', description: 'After Telegram approval, approved reply is posted back to crm.xgenious.com via POST /api/public-v1/support-ticket/reply/{id}' },
      { tag: 'feat', scope: 'support', description: 'CRM API exposed as 3 MCP tools: crm_get_ticket, crm_list_tickets, crm_post_reply — LLM can call them directly during decision making' },
      { tag: 'feat', scope: 'support', description: 'Setup sub-tab in agent detail page for CRM base URL, API key, and webhook secret configuration with copy-to-clipboard webhook URL' },
      { tag: 'chore', scope: 'db', description: 'Migration 0057: add ticket_no, contact_name, contact_phone, replied_at columns to support_tickets; drop NOT NULL on body' },
    ],
  },
  {
    version: 'v3.9.3',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'KB gap save no longer shows "Failed to save" when the entry saved but the gap deletion errored — gap deletion is now best-effort' },
      { tag: 'feat', scope: 'kb', description: 'Dismiss button shows spinner while deleting a KB gap so the action feels responsive' },
      { tag: 'feat', scope: 'notifications', description: 'KB gaps unanswered count added to notification bell so gaps are visible without navigating to the KB page' },
    ],
  },
  {
    version: 'v3.9.2',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'agents', description: 'Pass catalog (product/service/offer) to buildKbPromptBlock in support, whatsapp, linkedin, reddit, social, shorts agents — service entries were fetched but silently dropped from LLM prompts' },
    ],
  },
  {
    version: 'v3.9.1',
    date: '2026-05-05',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Add "service" to Category dropdown in Add Entry modal so service KB entries can be categorised correctly' },
    ],
  },
  {
    version: 'v3.9.0',
    date: '2026-05-05',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'Extend FTS and vector search to include service, product, and offer entry types — visitors asking about customisation or services now get contextual answers from matching KB entries' },
      { tag: 'fix', scope: 'kb', description: 'Deduplicate catalog entries from Relevant Knowledge section in buildKbPromptBlock so service/product/offer entries do not render twice when found by search and always-on' },
      { tag: 'chore', scope: 'dev', description: 'Add PreToolUse hook in .claude/settings.json to block git push when AppLayout.tsx or ChangelogPage.tsx have not been updated' },
      { tag: 'fix', scope: 'livechat', description: 'Commit rebuilt widget bundle from deleteKbGap fix' },
    ],
  },
  {
    version: 'v3.8.10',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'KB Gaps — commit missing deleteKbGap service method so DELETE /agents/livechat/kb-gaps/:id resolves; fixes Dismiss button 404 and Answer+save flow returning "Failed to save"' },
    ],
  },
  {
    version: 'v3.8.9',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'Correction-to-KB — LLM now synthesizes a proper Q&A reference entry from operator corrections; visitor question sourced from replyToContent; siteKey resolved from session and scoped on the KB entry; category (faq/product/policy/general) and sourceType (correction) stored so entries are filterable; correction entries saved at priority 80' },
    ],
  },
  {
    version: 'v3.8.8',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Origin check — fall back to Referer header when Origin is absent (fixes 403 for SSR pages and Safari privacy mode on taskip site)' },
    ],
  },
  {
    version: 'v3.8.7',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB Gaps — Answer and Dismiss actions per row; Answer opens a modal pre-filled with the visitor question, lets you write a reply, and saves it as a KB entry (category: faq, scoped to site key) then removes the gap; Dismiss deletes the gap without creating an entry' },
    ],
  },
  {
    version: 'v3.8.6',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Avatar name tooltip — hovering any visitor avatar in the operator panel now shows the visitor name via the native browser tooltip' },
    ],
  },
  {
    version: 'v3.8.5',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Operator image paste progress — uploading chips now appear immediately on paste with a thumbnail preview and spinning indicator; "Uploading…" is no longer trapped inside the completed-attachments guard so the chip is visible from the first paste; send is blocked while any upload is in flight' },
      { tag: 'fix', scope: 'livechat-widget', description: 'Visitor image paste progress — uploading chip now shows a CSS spinner alongside the "Uploading…" label; send is blocked (with a toast) while any upload is in progress, preventing duplicate pastes' },
    ],
  },
  {
    version: 'v3.8.4',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB Framework moved into Knowledge Base page as a "Framework" tab — removed standalone /kb-framework route and nav link' },
      { tag: 'fix', scope: 'kb', description: 'KB Gaps tab 404 — GapsTab was calling /api/agents/livechat/kb-gaps (wrong prefix); changed to apiFetch so it uses /agents/livechat/kb-gaps matching the controller route' },
    ],
  },
  {
    version: 'v3.8.3',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat-widget', description: 'Duplicate agent messages — when Socket.io falls back to HTTP polling, the POST response can arrive before WS stream_start; the 250ms HTTP fallback would fire and push the message, then agent_stream_end would swap the draft bubble to the same messageId creating two identical bubbles; fixed by checking in agent_stream_end whether the real messageId already exists in state and removing the orphaned draft instead of duplicating it; also cleans up orphaned streaming draft bubbles when an LLM-error fallback reply arrives via a plain message event' },
    ],
  },
  {
    version: 'v3.8.2',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Human-attention toasts — when a visitor sends a new message or a session escalates to needs_human, a small toast appears bottom-right; clicking it navigates directly to that conversation; toasts auto-dismiss after 6s and stack up to 4' },
    ],
  },
  {
    version: 'v3.8.1',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'docs', description: 'KB Framework doc page — new admin panel page at /kb-framework explaining the mandatory 9-step agent contract, layer model, retrieval protocol, prompt block format, security scoping rules, quality gate pipeline, metadata contract, failure/fallback protocol, and health indicators' },
      { tag: 'feat', scope: 'livechat', description: 'Clear widget cache — each site in the Live Chat settings now has a refresh button that sets a cache-bust token on the site record; the widget compares this token on every page load and clears its localStorage message cache when it changes, forcing all visitors to re-fetch conversation state' },
      { tag: 'chore', scope: 'db', description: 'Migration 0055: widget_cache_bust column on livechat_sites' },
    ],
  },
  {
    version: 'v3.8.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'kb', description: 'KB character count + quality warning — content textarea in the entry editor now shows live char and token estimates; entries under 80 chars get an amber "too short" warning; high comma density triggers a "keyword list" warning since sentences retrieve better than comma-separated terms' },
      { tag: 'feat', scope: 'kb', description: 'AI preview block in entry editor — collapsible section below the form shows how the AI will see the entry after truncation (500 chars for products/services/offers, 800 chars for references) with an amber warning if content exceeds the limit' },
      { tag: 'feat', scope: 'livechat', description: 'Thread-context retrieval — KB search now prepends the last 3 visitor messages to the current query so follow-up questions like "yes" or "how much?" resolve against the topic under discussion, not just the one-word utterance' },
      { tag: 'feat', scope: 'livechat', description: 'Pre-LLM empty-KB gate — if no product/service/offer catalog entries exist for the site AND no references were retrieved for a substantive question, the agent skips the LLM entirely and escalates to human support; prevents hallucinated answers on sites with missing KB coverage' },
      { tag: 'feat', scope: 'livechat', description: 'Post-draft grounding check — after generating a reply draft, a fast secondary LLM call verifies that all specific factual claims in the draft are supported by retrieved KB entries; ungrounded drafts are discarded and escalated rather than delivered to the visitor' },
      { tag: 'feat', scope: 'livechat', description: 'KB source flag and improve buttons — the KB sources panel now shows a flag icon per entry row (marks the entry as inaccurate, persisted to livechat_kb_flags) and an edit link that navigates to the KB editor for that entry and auto-opens the edit modal' },
      { tag: 'feat', scope: 'kb', description: 'Never-retrieved entry tracking — knowledge_entries now records last_retrieved_at; reference entries that have never been fetched by the AI show an orange "never used" badge; entries unused for >30 days show a yellow "stale" badge; a filter toggle in the Entries tab shows only unused entries' },
      { tag: 'feat', scope: 'kb', description: 'KB Gaps tab — new sixth tab in the Knowledge Base page lists questions that escalated because of missing KB coverage or grounding failures; columns: site, visitor question, reason (no references / grounding failed), time; auto-refreshes every 30 s; filterable by site key' },
      { tag: 'fix', scope: 'kb', description: 'Increased KB context limits — product/service/offer content truncation 220 → 500 chars, reference content 600 → 800 chars, references injected 3 → 8; vector similarity threshold (cosine <= 0.40) added to filter low-relevance results' },
      { tag: 'chore', scope: 'db', description: 'Migrations 0052–0054: livechat_kb_gaps table, livechat_kb_flags table, knowledge_entries.last_retrieved_at column' },
    ],
  },
  {
    version: 'v3.7.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'KB debug panel — every AI reply in the operator panel now shows a "kb: N sources" button below the bubble; click to expand a list of KB entry titles and types (product, fact, reference) that were retrieved to generate that reply; aids diagnosing wrong-site or wrong-product answers' },
      { tag: 'feat', scope: 'livechat', description: 'Page-context product pinning — when the visitor is on a named product page (non-generic URL), the agent system prompt is pinned to that page title so replies stay focused on the product shown, not other products in context' },
      { tag: 'feat', scope: 'livechat', description: 'PRODUCT LOCK rule added to system prompt — agent is now explicitly instructed to treat KB entries about other brands as non-existent, even if they slip into context; provides a hard backstop against cross-site product contamination independent of KB filtering' },
      { tag: 'feat', scope: 'kb', description: 'Untagged entry warning in KB admin — entries with the livechat agent selected but no site key set now show a yellow "no site — inactive" badge; entries without a site key are silently excluded from all livechat sessions after the strict site filter deployed in v3.6.2' },
      { tag: 'chore', scope: 'db', description: 'Migration 0051: added metadata jsonb column to livechat_messages for KB source tracking' },
    ],
  },
  {
    version: 'v3.6.2',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Cross-site KB contamination — KB entries with no site_keys set were treated as "global" and returned for every livechat site, causing products from one site (e.g. Xilancer, Influstar) to appear in replies on unrelated sites; siteKeyWhere is now strict: only entries explicitly tagged with the queried site key are returned; entries must be tagged with a site key to appear in livechat' },
    ],
  },
  {
    version: 'v3.6.1',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'widget', description: 'Duplicate agent messages — root cause was a browser event-loop race: fetch().then() is a microtask and resolves before WebSocket onmessage macrotasks, so the HTTP response could push the message before stream_start had processed; when socket is connected the HTTP push is now deferred 250ms so WS events drain first, with HTTP content as a fallback only if WS never delivers' },
      { tag: 'fix', scope: 'widget', description: 'Widget message cache cleared (key bumped to v2) to purge any duplicate messages stored in visitor browsers from the previous race condition' },
    ],
  },
  {
    version: 'v3.6.0',
    date: '2026-05-04',
    entries: [
      { tag: 'feat', scope: 'email_manager', description: 'Full email-drafting rewrite — structured extraction with ExtractedEmail (latestMessage, threadContext, sender, subject, language, sentiment, confidence); dual KB search (15 semantic results + up to 5 per detected product name, deduplicated); thread context injected as conversation history; gpt-4o-mini sentiment/language analysis; stronger KB PRICING RULE and CRITICAL fallback guard; confidence gate rejects ambiguous images before drafting' },
      { tag: 'feat', scope: 'email_manager', description: 'Product name extraction — capitalized words 4+ chars appearing 2+ times are detected as product names (e.g. Nazmart, Taskip); KB is searched separately for each product so product-specific entries are always included alongside semantic results' },
      { tag: 'feat', scope: 'livechat', description: 'Homepage product-question rule — when a visitor asks about pricing, features, or buying from the site homepage without naming a product, the agent asks "Which product?" before proceeding; prevents generic replies when multiple products are on offer' },
      { tag: 'feat', scope: 'widget', description: 'Operator avatar tooltip — hovering the operator avatar image in the chat widget now shows the operator name via a native title attribute' },
      { tag: 'fix', scope: 'db', description: 'Drizzle migration journal gap — migrations 0048 (telegram_mode), 0049 (require_email), 0050 (reply_to_id) were present as SQL files but missing from _journal.json; Drizzle migrate() uses the journal to discover files, so all three columns were never applied on production; journal entries added, columns now created on next deploy startup' },
      { tag: 'fix', scope: 'widget', description: 'Duplicate agent messages in chat widget — HTTP response handler and streaming path could both push the same message; fixed by checking activeDraftId (streaming in progress) before the push so the HTTP fallback skips the message while streaming is active' },
    ],
  },
  {
    version: 'v3.5.6',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Reply-to quote persisted across conversation switches — switching to a different chat while a reply was queued kept the banner visible; replyTo state now resets whenever the active sessionId changes' },
    ],
  },
  {
    version: 'v3.5.5',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Clicking the reply button broke the page layout — long message content in the reply-to banner caused the flex container to grow beyond its allocated width, squeezing the sidebar; fixed by adding min-w-0 + overflow-hidden to the session pane wrapper and overflow-hidden to the banner strip' },
    ],
  },
  {
    version: 'v3.5.4',
    date: '2026-05-04',
    entries: [
      { tag: 'fix', scope: 'tasks', description: 'Task reminder Telegram message showed UTC time instead of configured timezone — toLocaleTimeString now passes the platform timezone from SettingsService so "runs in ~1 hour at 10:00 AM" reflects local time, not server UTC' },
    ],
  },
  {
    version: 'v3.5.3',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Translate button always visible on all messages — removed hover-only opacity for visitor messages; added translate button and translation display to agent/AI message bubbles so operators can translate in both directions' },
    ],
  },
  {
    version: 'v3.5.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'CORS http/https mismatch — sites registered with https:// were rejecting requests from http:// widgets; both the origin cache and the site resolver now compare hostname only, so http://bytesed.com matches a site configured as https://bytesed.com' },
    ],
  },
  {
    version: 'v3.5.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'GeoLite2 file upload crashed with "Maximum call stack size exceeded" — caused by spreading a 10 MB Uint8Array as arguments to String.fromCharCode; replaced with a simple for-loop to build the binary string before btoa encoding' },
      { tag: 'fix', scope: 'livechat', description: 'Translate globe icon now appears on hover for all visitor messages — previously only shown when visitor\'s detected browser language was non-English, so messages from visitors with English browser settings (writing in Russian, Bangla, etc.) never showed the button' },
    ],
  },
  {
    version: 'v3.5.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'email_manager', description: 'Draft reply assistant in agent chat — paste a client email as text and the agent drafts a full reply using the Knowledge Base for pricing, features, and product details; output includes subject line and signed body ready to copy' },
      { tag: 'feat', scope: 'email_manager', description: 'Image input support — paste a screenshot of an email conversation (Ctrl+V) or upload via the attach button; gpt-4o reads the image, extracts the full conversation, then drafts the reply exactly as with text input' },
      { tag: 'feat', scope: 'llm', description: 'Vision support added to LLM router — imageBase64 + imageMimeType fields on LlmCompleteOpts; OpenAI provider attaches the image as a multimodal content block on the last user message (gpt-4o)' },
      { tag: 'fix', scope: 'email_manager', description: 'Agent chat messages were previously ignored (fell through to the Gmail CRON path); buildContext now detects source:chat payload and routes to task mode with the query as instructions' },
      { tag: 'fix', scope: 'email_manager', description: 'Draft replies now returned as notify_result actions (displayed directly in chat bubble, no Telegram approval) instead of send_reply (which was going to AWAITING_APPROVAL state)' },
    ],
  },
  {
    version: 'v3.4.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Security: prompt injection detection — visitor messages are scanned for known injection phrases ("ignore previous instructions", "you are DAN", "jailbreak", system-prompt spoofing tags, etc.) before reaching the LLM; detected patterns are stripped and logged as warnings' },
      { tag: 'fix', scope: 'livechat', description: 'Security: PII redaction before LLM calls — email addresses, phone numbers, and credit card patterns in visitor messages are replaced with [email]/[phone]/[card] tokens so they never appear in LLM provider logs' },
      { tag: 'fix', scope: 'livechat', description: 'Security: pageContext.custom field sanitization — operator-supplied custom context values injected into the agent system prompt are now run through sanitizeOperatorField (HTML/code-fence stripping, 200-char cap) to prevent prompt injection via the embed snippet' },
      { tag: 'fix', scope: 'livechat', description: 'Security: WebSocket session ownership verified on connection — the gateway now checks that the sessionId passed by the visitor actually belongs to their visitorId on the correct site before joining the session room; previously any party that knew a sessionId UUID could subscribe to and read that conversation' },
      { tag: 'fix', scope: 'api', description: 'Security: Content-Security-Policy header added to all API responses — default-src: none; frame-ancestors: none, appropriate for a pure JSON/WebSocket API with no embedded resources' },
    ],
  },
  {
    version: 'v3.4.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Security: hardened livechat agent system prompt with explicit identity rules — the agent now refuses to name its underlying AI model or provider (OpenAI, Anthropic, GPT, Claude, Gemini, etc.) and deflects all meta-questions about its technology or system instructions' },
      { tag: 'fix', scope: 'livechat', description: 'Security: added post-generation output filter — any draft response containing model/provider disclosure patterns is replaced with a safe deflection before being sent to the visitor or persisted to the database' },
    ],
  },
  {
    version: 'v3.4.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Translate visitor messages: hover any non-English visitor message → globe icon appears → click to translate to English inline below the bubble using the LLM router; translation is cached per-message for the session' },
      { tag: 'feat', scope: 'livechat', description: 'Auto-translate operator replies: when a session is non-English, a toggle appears in the composer bar — when on, the operator types in English and the message is automatically translated to the visitor\'s language before being sent; falls back to original on LLM error' },
    ],
  },
  {
    version: 'v3.4.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Force email option in site settings (Identity tab) — when enabled, visitors must enter their email in a pre-chat gate before they can send a message; stored in localStorage so one-time only per device' },
      { tag: 'feat', scope: 'livechat', description: 'Reply feature: hover any message in the admin panel to see a reply button; clicking it shows a reply preview bar above the composer and sends replyToId + quoted snippet with the message; replies render as a quote block above the bubble' },
      { tag: 'fix', scope: 'livechat', description: 'Message bubbles now preserve newlines (whitespace-pre-wrap) and wrap long URLs correctly ([overflow-wrap:anywhere]) — previously multiline messages and long URLs overflowed the bubble, especially on mobile' },
      { tag: 'fix', scope: 'livechat', description: 'Mobile chat panel: reduced side padding (px-3 on mobile, px-6 on desktop) and widened bubbles to 85% max on small screens to prevent clipping' },
      { tag: 'fix', scope: 'livechat', description: 'Seen checkmark is now green (CheckCheck in text-green-500) to clearly distinguish from sent-not-seen (single grey check); previously both used similar blue/grey tones' },
      { tag: 'fix', scope: 'livechat', description: 'Visitor message newlines in widget now render as <br> — previously typing multiline messages produced a single collapsed line in the chat bubble' },
    ],
  },
  {
    version: 'v3.3.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Agent reply bubbles now render markdown — bold (**text**), italic (*text*), and inline code (`text`) are parsed and rendered correctly; URLs remain clickable as before' },
      { tag: 'fix', scope: 'telegram', description: 'Approval/rejection/followup buttons were silently doing nothing in production — the Telegram bot was only started in non-production environments; removed the NODE_ENV guard so polling runs in all environments including Coolify' },
    ],
  },
  {
    version: 'v3.3.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'chat', description: 'Thumbs down on any agent chat message triggers the self-improvement loop — emits kb.rejection so SelfImprovementService proposes a KB entry and sends it to Telegram for approval; applies to all agents, not just HR' },
      { tag: 'feat', scope: 'telegram', description: 'Agent failures now send an immediate Telegram alert with agent name, task title (if from a task), error summary, and run ID — no need to open the web app to discover a failure; applies to all 14 agents' },
    ],
  },
  {
    version: 'v3.3.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'tasks', description: 'Telegram mode per task: agent (default, agent handles Telegram itself), notify (plain text when done), approve (all actions gate on Telegram Approve/Reject before executing) — set via dropdown in the task form, shown as badge on task card' },
      { tag: 'fix', scope: 'hr', description: 'Leave approval requests no longer require Cortex approval before reaching Telegram — Approve/Reject buttons appear in Telegram immediately when the daily task fires' },
    ],
  },
  {
    version: 'v3.2.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'tasks', description: 'Scheduled tasks now correctly trigger agent actions and send Telegram notifications — runTask() was missing source:task in the payload, causing the HR agent to fall back to read-only chat mode and skip the Telegram notify step' },
    ],
  },
  {
    version: 'v3.2.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Opening the notification bell dropdown now immediately marks agent failures as seen — previously the count only cleared after navigating to the Activity page; the badge now disappears as soon as the dropdown is opened' },
    ],
  },
  {
    version: 'v3.2.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'llm-usage', description: 'All agent LLM calls now include agentKey attribution — every agent (support, whatsapp, email-manager, linkedin, reddit, social, shorts, taskip-trial, daily-reminder, canva, taskip-internal, telegram-bot, livechat, hr) passes agentKey to complete() and completeWithTools() so calls appear correctly attributed in the by-agent breakdown on the LLM Usage page instead of Unattributed' },
    ],
  },
  {
    version: 'v3.1.7',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Chat mode is now explicitly read-only — system prompt and tool description for export_payslips_csv make clear it cannot generate salary slips; if asked, the agent explains the user must trigger a run from the Tasks tab' },
      { tag: 'fix', scope: 'chat', description: 'Conversation history no longer causes duplicate messages — staleTime set to Infinity and a ref prevents history query re-fetches from overwriting locally-appended messages; key={convId} on ChatTab forces remount on conversation switch' },
      { tag: 'fix', scope: 'hr', description: 'Conversation history is now passed to the LLM — prior messages are reconstructed from the history payload and prepended so the agent maintains context across turns' },
      { tag: 'feat', scope: 'chat', description: 'Thumbs up/down feedback buttons appear on agent message hover — inline rating stored in local state; clicking again toggles off' },
      { tag: 'feat', scope: 'hr', description: 'Updated HR chat suggestions: who is on leave today, pending leave requests, WFH, birthdays, payslip summary, CSV download, salary generation redirect' },
    ],
  },
  {
    version: 'v3.1.6',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Agent failures count clears when navigating to Activity page or clicking the row — stored as a seen-at timestamp in localStorage; backend only counts failures after that point, not the full 24h window' },
    ],
  },
  {
    version: 'v3.1.5',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Removed parse_mode:Markdown from all button messages (approval, KB proposal, HR leave/WFH/payslip, routing) — underscores in employee names or action summaries were silently breaking message delivery and preventing buttons from appearing' },
      { tag: 'fix', scope: 'telegram', description: 'Added bot middleware to re-fetch ownerChatId on every update — if the setting was not loaded at startup, all callback button clicks were silently rejected as Unauthorized' },
      { tag: 'fix', scope: 'hr', description: 'Chat queries from the web UI no longer go to Telegram — notify_result actions tagged with source:chat skip the telegram.sendMessage call; the chat page already reads the response from the run result' },
      { tag: 'fix', scope: 'runtime', description: 'Agent runs no longer show AWAITING_APPROVAL when all actions auto-execute — the run processor only sets that status when at least one action requires explicit approval' },
    ],
  },
  {
    version: 'v3.1.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'llm', description: 'completeWithTools now respects the global LLM provider setting for all agents — when Settings sets gemini as default, tool-calling falls back to openai with a warning instead of silently ignoring the setting; all agents using agentLlmOpts({}) correctly inherit the settings provider' },
    ],
  },
  {
    version: 'v3.1.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'LLM tool-call loop now works — assistant messages replayed to OpenAI now include type:"function" and nested function:{name,arguments} as required; previously the flat internal ToolCall shape was sent raw and OpenAI rejected it with 400' },
      { tag: 'fix', scope: 'telegram', description: 'sendMessage no longer sets parse_mode:Markdown — LLM responses and agent digests are plain text; any underscore, asterisk, or bracket in the text was causing Telegram entity-parse errors' },
    ],
  },
  {
    version: 'v3.1.2',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'chat', description: 'AgentChatPage no longer shows a double scrollbar on desktop — root changed from h-screen to h-full; AppLayout main switches to overflow-hidden on /agents/*/chat routes so the chat fills exactly the available viewport' },
    ],
  },
  {
    version: 'v3.1.1',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'agents', description: 'Approve/Reject with action summary in both AgentDetailPage RunsTab and AgentChatPage TasksTab — each pending approval shows its action.summary so the user knows what they are approving; works for all agents generically' },
      { tag: 'fix', scope: 'agents', description: 'TasksTab refetch interval reduced to 10s to match RunsTab; both views share the pending-approvals query key so approval state is consistent' },
    ],
  },
  {
    version: 'v3.1.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'hr', description: 'HR agent chat mode — MANUAL triggers with a query now use LLM + tool calling to answer specific HR questions instead of running daily digest or payroll; LlmModule added to HrModule' },
      { tag: 'feat', scope: 'agents', description: 'Approve/Reject buttons on AWAITING_APPROVAL runs in agent detail page — no need to go to Approvals page' },
      { tag: 'feat', scope: 'ui', description: 'Mobile responsive layout for AgentsPage, AgentDetailPage, AgentChatPage — actions stack below name on small screens; chat tab bar moves below agent name on mobile' },
    ],
  },
  {
    version: 'v3.0.9',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Payslip generate response updated — removed .skipped field, added alreadyGeneratedNote and noAttendance handling; no-attendance count and already-generated note both surfaced to Telegram' },
      { tag: 'feat', scope: 'hr', description: 'Payslip Telegram message now includes working days and present days from API response' },
    ],
  },
  {
    version: 'v3.0.8',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'notifications', description: 'Bell badge now updates in real time — subscribes to approvals and activity rooms via WebSocket; correct event names (approval:created, approval:removed, activity:log); fallback poll reduced to 15s' },
    ],
  },
  {
    version: 'v3.0.7',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'Payslip flow corrected — per-slip Telegram messages with Approve/Edit/Skip buttons sent after Cortex batch approval; hrPayslipRuns rows inserted on generation, not before' },
      { tag: 'fix', scope: 'telegram', description: 'HR leave and WFH Approve/Reject buttons now work — replaced editMessageText with Markdown with editMessageReplyMarkup + plain reply; same fix for payslip approve/edit/skip callbacks' },
      { tag: 'fix', scope: 'telegram', description: 'Slash commands (/help, /status, /agents, /inbox, /remind, /cancel) now surface errors instead of silently failing — all handlers wrapped in try/catch; removed Markdown from command replies to prevent silent Telegram parse errors' },
      { tag: 'feat', scope: 'hr', description: 'Added submit_leave_request, submit_wfh_request, and export_payslips_csv MCP tools; createLeaveRequest and createWfhRequest added to HrmApiService' },
    ],
  },
  {
    version: 'v3.0.6',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'approvals', description: 'Bulk reject — select all checkbox + "Reject N" button in approvals page header; each card has a checkbox for individual selection' },
      { tag: 'fix', scope: 'approvals', description: 'Follow-up no longer re-creates all stale approvals for the run — existing PENDING approvals are cancelled before new ones are queued' },
    ],
  },
  {
    version: 'v3.0.5',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'Approve/Reject/Follow-up buttons now work reliably — replaced editMessageText with Markdown (broke on special chars) with editMessageReplyMarkup + plain reply; errors surface as a reply instead of failing silently' },
      { tag: 'fix', scope: 'hr', description: 'Payslips no longer generated in XGHRM before approval — generation and approval now happen inside execute() after the user approves the batch in Cortex; single approval card replaces 17 individual ones' },
    ],
  },
  {
    version: 'v3.0.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'Country flags now appear for existing visitors — GeoIP backfill runs on boot and after every database upload/download, updating all visitors that have an IP but no country data' },
    ],
  },
  {
    version: 'v3.0.3',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'geoip', description: 'Chunked upload now shows a progress bar and "Uploading chunk X of Y" label; download/upload section hidden when database is already loaded; Debug tab renamed to GEOLite2' },
    ],
  },
  {
    version: 'v3.0.2',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'geoip', description: 'GeoLite2-City.mmdb upload now uses 10 MB chunked transfer — large files (130 MB+) upload reliably with per-chunk progress shown in the button' },
    ],
  },
  {
    version: 'v3.0.1',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Visitor list now sorts open/pending sessions first, then by last message time descending — closed sessions always sink to the bottom' },
    ],
  },
  {
    version: 'v3.0.0',
    date: '2026-05-03',
    entries: [
      { tag: 'feat', scope: 'tasks', description: 'Weekly recurrence now has a day-of-week picker (Mon–Sun); monthly recurrence added with a day-of-month picker (1–31)' },
      { tag: 'feat', scope: 'tasks', description: 'Telegram reminder sent ~1 hour before any scheduled or recurring task runs; reminder_sent_at tracked in DB to avoid duplicates, reset on each rescheduling cycle' },
    ],
  },
  {
    version: 'v2.9.4',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'hr', description: 'HR test-connection errors now appear in debug logs — removed internal error swallowing so failures propagate as 500 with the real error message; dispatcher catch block sends actual error text instead of generic message' },
    ],
  },
  {
    version: 'v2.9.3',
    date: '2026-05-03',
    entries: [
      { tag: 'fix', scope: 'kb', description: 'Live Chat site scope selector now appears in the Import tab (document and URL) when livechat agent is selected, matching behaviour of the Add Entry modal' },
    ],
  },
  {
    version: 'v2.9.2',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'ci', description: 'GitHub Actions workflow builds Docker image on push to main — downloads GeoLite2-City.mmdb and bakes it into the image; Dockerfile updated to copy data/ into runner stage' },
      { tag: 'fix', scope: 'geoip', description: 'mmdb upload no longer fails with file too large — per-request 150 MB limit on the geo/upload-db endpoint overrides the global 10 MB multipart cap' },
    ],
  },
  {
    version: 'v2.9.1',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'integrations', description: 'Gmail tab Connect with OAuth and App Password buttons no longer wrap text — added whitespace-nowrap and shrink-0' },
    ],
  },
  {
    version: 'v2.9.0',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'telegram', description: 'KB proposal approve/reject in Telegram now works — replaced editMessageText with Markdown (broke on AI-generated content with underscores) with plain reply + button removal' },
      { tag: 'fix', scope: 'ops', description: 'Operations page is now responsive — header, active lanes, and log/approvals panel stack correctly on mobile' },
      { tag: 'fix', scope: 'livechat', description: 'Live Chat tab bar scrolls horizontally on narrow screens — tabs no longer wrap or overflow container' },
      { tag: 'fix', scope: 'notifications', description: 'Fixed /notifications/summary 500 error — approval_status enum comparison now uses uppercase PENDING to match Postgres enum values' },
      { tag: 'fix', scope: 'livechat', description: 'Fixed visitor duplicate-key race condition on high-concurrency sites — upsertVisitor now uses atomic onConflictDoUpdate' },
      { tag: 'feat', scope: 'debug-logs', description: 'Copy full error button in debug log detail view — formats method, path, status, request/response body, error message, and stack trace to clipboard' },
      { tag: 'fix', scope: 'hr', description: 'HR agent setup tab shows the exact endpoint URL that test-connection calls, so misconfigured base URLs are immediately visible' },
      { tag: 'feat', scope: 'livechat', description: 'Message seen checkmarks — single grey check when sent, double blue check when visitor reads; visitor widget emits seen event on open and on new message' },
    ],
  },
  {
    version: 'v2.7.2',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'geoip', description: 'GeoLite2-City download now works — removed --wildcards tar flag that is unsupported on BSD/some Linux tar versions' },
      { tag: 'fix', scope: 'settings', description: 'Removed duplicate MaxMind GeoIP fields from global Settings — managed exclusively in Live Chat > Setup' },
    ],
  },
  {
    version: 'v2.7.1',
    date: '2026-05-02',
    entries: [
      { tag: 'fix', scope: 'livechat', description: '"Correction sent" label now always visible after submitting a flag — was hidden until hover' },
    ],
  },
  {
    version: 'v2.7.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'notifications', description: 'Real-time notification bell in topbar — badge count for waiting chats, pending approvals, agent failures, and KB proposals; each item navigates to the relevant page' },
      { tag: 'feat', scope: 'changelog', description: 'Changelog moved from sidebar to topbar icon button (ScrollText) for cleaner nav' },
    ],
  },
  {
    version: 'v2.6.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', description: 'Changelog page with feat/fix/chore tagged entries, accessible from sidebar' },
      { tag: 'feat', scope: 'geoip', description: 'Upload GeoLite2-City.mmdb directly from local computer as alternative to MaxMind download' },
      { tag: 'feat', scope: 'livechat', description: 'Flag wrong AI responses with inline correction form — LLM reformats into KB proposal sent to Telegram for approval' },
      { tag: 'feat', scope: 'livechat', description: 'Site label badge on online visitors panel showing which site each visitor belongs to' },
      { tag: 'fix', scope: 'agents', description: 'Delete agent now cascades to runs, pending approvals, logs, and conversations before removing agent row' },
      { tag: 'fix', scope: 'llm-usage', description: 'Overview stats were blank due to Date object passed as SQL param — converted to ISO string' },
      { tag: 'fix', scope: 'livechat', description: 'Long URL in Currently On visitor panel no longer overflows its container' },
      { tag: 'fix', scope: 'push', description: 'Browser notifications failing silently when VAPID subject was missing — falls back to default; test button now surfaces errors' },
    ],
  },
  {
    version: 'v2.5.0',
    date: '2026-05-02',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Stats panel on dashboard with session count, CSAT score, and avg response time' },
      { tag: 'feat', scope: 'livechat', description: 'Proper Setup sub-tab with prerequisites, config steps, and manual test guide' },
      { tag: 'fix', scope: 'livechat', description: 'CSAT score calculation corrected to exclude unanswered sessions' },
      { tag: 'feat', scope: 'settings', description: 'HR and GeoIP config groups in Settings page' },
      { tag: 'feat', scope: 'livechat', description: 'Agent run recording — each chat session linked to an agent run for audit trail' },
      { tag: 'feat', scope: 'agents', description: 'Site tags for filtering agent activity by site/channel' },
      { tag: 'feat', scope: 'agents', description: 'Inline run logs visible directly in the run detail panel' },
      { tag: 'feat', scope: 'hr', description: 'GeoIP setup panel with API key config and test lookup' },
      { tag: 'feat', scope: 'hr', description: 'Inline config editor for HR agent parameters' },
    ],
  },
  {
    version: 'v2.4.0',
    date: '2026-04-18',
    entries: [
      { tag: 'feat', scope: 'llm-usage', description: 'Dynamic cost chart with configurable time period and per-model breakdown' },
      { tag: 'feat', scope: 'llm-usage', description: 'Recent calls table with agent names and token counts' },
      { tag: 'feat', scope: 'llm-usage', description: 'Period-over-period delta indicator on usage stats' },
      { tag: 'feat', scope: 'livechat', description: 'At-a-glance inbox improvements: unread badges, session status chips, quick reply' },
      { tag: 'chore', description: 'Static Drizzle imports in Telegram service to fix tree-shaking issue' },
    ],
  },
  {
    version: 'v2.3.0',
    date: '2026-04-04',
    entries: [
      { tag: 'fix', scope: 'migrations', description: 'Register migrations 0043 and 0044 in Drizzle journal so they run on boot' },
      { tag: 'feat', scope: 'hr', description: 'Setup UI with test-connection button for HRM API validation' },
      { tag: 'fix', scope: 'livechat', description: 'Session list sorted by last message timestamp instead of creation date' },
      { tag: 'feat', scope: 'hr', description: 'Telegram callback handlers for leave, WFH, and payslip approval flows' },
      { tag: 'feat', scope: 'hr', description: 'XGHRM API client wired in; removed local stub tables; configurable payslip day' },
    ],
  },
  {
    version: 'v2.2.0',
    date: '2026-03-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Message timestamps and site badge shown in inbox conversation list' },
      { tag: 'fix', scope: 'widget', description: 'Resolve 3 TypeScript build errors that blocked Coolify deployment' },
      { tag: 'feat', scope: 'livechat', description: '3-layer visitor page context (URL, title, referrer) passed to AI for personalised replies' },
      { tag: 'fix', scope: 'livechat', description: 'Visitor-side security hardening — rate limiting, origin validation, sanitised inputs' },
    ],
  },
  {
    version: 'v2.1.0',
    date: '2026-03-06',
    entries: [
      { tag: 'fix', scope: 'livechat', description: 'Chatbot security and quality hardening — 14 issues addressed' },
      { tag: 'fix', scope: 'widget', description: '5 mobile edge cases fixed including safe-area inset and scroll lock' },
      { tag: 'fix', scope: 'widget', description: 'True streaming animation, CSS cursor blink, and 10px mobile position offset' },
      { tag: 'fix', scope: 'widget', description: 'Brand color restored on mobile; PWA notch safe area padding' },
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-02-20',
    entries: [
      { tag: 'feat', scope: 'livechat', description: 'Live Chat module — embeddable widget, operator inbox, AI-assisted replies, CSAT' },
      { tag: 'feat', scope: 'hr', description: 'HR agent — leave requests, WFH approvals, payslip dispatch via Telegram' },
      { tag: 'feat', scope: 'contacts', description: 'Contacts page with visitor history and session timeline' },
      { tag: 'feat', scope: 'tasks', description: 'Tasks page for manual task tracking per agent' },
      { tag: 'feat', scope: 'inbox', description: 'Unified inbox for email threads managed by email-manager agent' },
      { tag: 'chore', description: 'Switched to semver versioning (MAJOR.MINOR.PATCH)' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-01-15',
    entries: [
      { tag: 'feat', description: 'Initial platform: NestJS + Fastify + Drizzle + BullMQ + Redis + MinIO scaffold' },
      { tag: 'feat', description: 'Agent runtime with IAgent contract, Postgres persistence, and BullMQ queue' },
      { tag: 'feat', description: 'LLM router: OpenAI -> Gemini -> DeepSeek fallback chain' },
      { tag: 'feat', description: 'Telegram bot with Approve / Reject / Follow-up callbacks' },
      { tag: 'feat', description: 'Knowledge Base with ingestion (PDF, DOCX, URL), Redis cache, and self-improvement' },
      { tag: 'feat', description: 'MCP server framework and client' },
      { tag: 'feat', description: 'SES module with bounce/complaint webhook' },
      { tag: 'feat', description: 'Agents: crisp, support, whatsapp, email-manager, linkedin, reddit, social, shorts, taskip-trial, daily-reminder' },
      { tag: 'feat', description: 'Frontend: dashboard, agents, approvals, integrations, MCP, activity, settings, knowledge base' },
    ],
  },
];

const TAG_STYLES: Record<Tag, string> = {
  feat: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  fix: 'bg-red-500/10 text-red-400 border border-red-500/20',
  chore: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
};

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ScrollText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Changelog</h1>
      </div>

      <div className="space-y-10">
        {CHANGELOG.map((block) => (
          <div key={block.version}>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-sm font-semibold font-mono">{block.version}</span>
              <span className="text-xs text-muted-foreground">{block.date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ul className="space-y-2">
              {block.entries.map((entry, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${TAG_STYLES[entry.tag]}`}>
                    {entry.tag}
                  </span>
                  <span className="text-sm text-muted-foreground leading-snug">
                    {entry.scope && (
                      <span className="text-foreground font-medium mr-1">{entry.scope}:</span>
                    )}
                    {entry.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
