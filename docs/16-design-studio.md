# Design Studio — Training-Sample Carousel System

How the design studio works end-to-end: DNA extraction, template storage, asset collection, slide generation, and the chat state machine.

---

## What it is

The Design Studio is a two-stage image generation pipeline built on top of gpt-image-1:

1. **Analysis stage** — User uploads a design image (PNG/JPG). An LLM analyzes it and extracts a `DesignDNA` JSON that describes the visual style, color palette, headline word count, presence of avatar zones, and what parameters to collect from the user.

2. **Generation stage** — When the Canva agent generates a carousel, it passes the original uploaded image + the user-supplied content to `gpt-image-1 images.edit()`. The model edits the template image — preserving the exact background, fonts, and decorative elements — and replaces only the text and face.

This replaces the older `images.generate()` path (text-to-image from scratch), which could not reliably reproduce a specific visual style.

---

## Files

| File | Purpose |
|---|---|
| `apps/api/src/modules/design-studio/design-studio.processor.ts` | BullMQ worker — runs DNA extraction per upload; exports `DesignDNA` interface and `EXTRACT_SYSTEM` prompt |
| `apps/api/src/modules/design-studio/design-studio.service.ts` | Service — `importBatch()`, `generateEdit()`, `generateAndSave()`; holds `snapImageSize()` |
| `apps/api/src/modules/design-studio/design-studio.controller.ts` | REST endpoints for upload, template CRUD, job polling |
| `apps/api/src/modules/design-studio/schema.ts` | Drizzle tables: `designStudioJobs`, `designStudioTemplates` |
| `apps/api/src/modules/design-studio/design-studio.module.ts` | NestJS module wiring |

---

## Database tables

### `design_studio_jobs`
Tracks the async DNA extraction job for each uploaded image.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | cuid2 |
| `name` | text | Filename the user uploaded |
| `status` | text | `pending` → `processing` → `done` / `failed` |
| `error` | text | Error message if failed |
| `template_id` | text | FK to `design_studio_templates` after success |
| `preview_data` | text | Not used (template stores it) |

### `design_studio_templates`
One row per successfully analyzed template. `spec` stores the full `DesignDNA`.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | cuid2 — used as `sampleId` in agent state |
| `name` | text | From the original filename |
| `preview_data` | text | Base64 data URL of the original uploaded image — passed verbatim to `images.edit()` as the base |
| `parameters` | jsonb | Array of `{ key, description, example, type }` — collected from user before generation |
| `spec` | jsonb | Full `DesignDNA` object |

---

## DesignDNA schema

Defined in `design-studio.processor.ts`. Extracted once per template, stored in `spec`, read at generation time.

```typescript
interface DesignDNA {
  stylePrompt: string;         // 3-5 sentence DALL-E style guide; never contains original text
  colors: string[];            // Dominant hex colors, up to 3 used in the edit prompt
  dimensions: { width: number; height: number };
  orientation: 'portrait' | 'landscape' | 'square';
  headlineWordCount?: number;  // Word count of the most prominent headline visible
  hasAvatarZone?: boolean;     // Circular profile photo is present in the design
  hasBrandLogoZone?: boolean;  // Brand / company logo area is present
  parameters: Array<{
    key: string;               // Internal key used in assetParams
    description: string;       // Shown as form label to the user
    example: string;           // Shown as placeholder
    type?: 'text' | 'image';  // 'image' → renders as file upload button in the chat form
  }>;
}
```

### Auto-detected parameters

The extraction prompt (`EXTRACT_SYSTEM` in `design-studio.processor.ts`) auto-adds these parameters when the design triggers them:

| Condition | Auto-added parameter |
|---|---|
| Always | `topic` (type: text) |
| `hasAvatarZone: true` | `avatar_image` (type: image) |
| Person's name visible | `username` (type: text) |
| Social handle visible | `social_handle` (type: text) |
| Website URL visible | `website_url` (type: text) |

---

## Generation pipeline

### Step 1 — Upload and extraction

User uploads images via the Design Samples UI (Canva agent → Design Samples tab).

`DesignStudioService.importBatch()`:
1. Inserts a `design_studio_jobs` row per image
2. Enqueues a `DESIGN_STUDIO` BullMQ job

`DesignStudioProcessor.process()`:
1. Calls `LlmRouterService.complete()` with `EXTRACT_SYSTEM` + the image as base64
2. Parses the JSON response into `DesignDNA`
3. Inserts a `design_studio_templates` row with `previewData = "data:{mimeType};base64,{imageBase64}"`
4. Updates the job row to `done` and emits `design-studio.job.updated`

### Step 2 — Template selection in chat

When the user picks a training sample in the chat, the Canva agent receives `sampleId` in the trigger payload. The agent:
1. Reads `headlineWordCount` from the template DNA — used to constrain headline length so generated text visually fits
2. Checks `parameters` — any parameter with `type: 'image'` will show an upload button in the chat form

### Step 3 — Asset collection (ExtraParamsGatherState)

Tracked by a JSON marker embedded in the agent's reply message:
```
[extra-params-gather:{...ExtraParamsGatherState...}]
```

`ExtraParamsGatherState` shape (in `agent.ts`):
```typescript
{
  confirmedSlides: Array<{ headline: string; body?: string; slideLabel?: string }>;
  templateSlides: Array<{ id: string }>;  // template IDs cycling through for each slide
  extraParams: Array<{ key: string; description: string; example?: string; type?: string }>;
  collected: Record<string, string>;      // values gathered so far
  idx: number;                            // which param is currently being asked
}
```

The frontend renders this as `AssetParamsCard` — an inline form with:
- Text inputs for `type: 'text'` params
- Upload button + URL fallback for `type: 'image'` params

On submit, the form encodes all values as:
```
[asset-params-all:{"username":"...","social_handle":"...","avatar_image":"data:image/jpeg;base64,..."}]
```

**Critical**: Both the `[extra-params-gather:]` JSON and `[asset-params-all:]` JSON are extracted on the backend using a balanced-brace depth counter (`extractNestedJson` in `agent.ts`). Never use a non-greedy regex like `(\{[\s\S]+?\})` — it stops at the first `}` inside nested arrays (confirmedSlides contains objects), producing invalid JSON.

### Step 4 — Slide generation

`decideChat()` in `agent.ts` receives the `[asset-params-all:]` submission and:
1. Parses `ExtraParamsGatherState` from the last agent message using `extractNestedJson`
2. Parses collected values from the query using `extractNestedJson`
3. Splits into `assetParams`: everything except `topic` (`username`, `social_handle`, `website_url`, `avatar_image`)
4. Loops through `confirmedSlides`, calling `DesignStudioService.generateAndSave(templateId, headline, assetParams)` for each
5. Emits a `post_ai_slide_end` log event per slide that includes `slide_url` — the frontend polls this and shows each slide as it completes

### Step 5 — Image generation via `images.edit()`

`DesignStudioService.generateEdit(id, headline, assetParams)`:

1. Loads the template from `design_studio_templates`
2. Decodes `previewData` (the original uploaded image) into a `Buffer` → `toFile()` → `imageFile`
3. If `assetParams.avatar_image` starts with `data:`, decodes the base64 → second `toFile()` → `avatarFile`
4. Builds the edit prompt:
   - Replace the headline text with exactly: `"${headline}"`
   - Preserve background color, font weight, decorative elements
   - No body paragraph text
   - If `avatarFile`: "Place the person's face from the second reference image exactly into the circular profile photo zone"
   - Replace author name / handle / website if provided
5. Calls `client.images.edit({ model: 'gpt-image-1', image: avatarFile ? [imageFile, avatarFile] : imageFile, prompt, size, n: 1 })`
6. Returns the PNG buffer

### Step 6 — File storage

Generated PNG is saved to disk at `~/Designs/AI-Agent/DnaRenders/{renderId}.png`.

The API serves it at `/design-studio/renders/:renderId` via a static-file route.

`generateAndSave()` returns `{ renderId, url: '/design-studio/renders/{renderId}' }`.

---

## Size snapping

`snapImageSize(dna)` maps orientation to the three sizes gpt-image-1 accepts:

| Orientation | Size |
|---|---|
| `portrait` | `1024x1536` |
| `landscape` | `1536x1024` |
| `square` | `1024x1024` |

---

## Chat state machine markers

The Canva agent embeds structured markers in its reply messages. All are stripped before the text is displayed to the user.

| Marker | Where | Purpose |
|---|---|---|
| `[styles:{...}]` | Agent message | Carries `StyleEntry[]` for the style picker card |
| `[layout-pending:{...}]` | Agent message | Remembers topic/format while user picks a layout |
| `[content-confirm]` | Agent message | Signals ContentConfirmCard to render |
| `[pending:{...}]` | Agent message | Carries proposed slide content |
| `[extra-params-gather:{...}]` | Agent message | Signals AssetParamsCard to render; carries full ExtraParamsGatherState |
| `[asset-upload-request]` | Agent message | Deprecated single-param hint; form uses `type: 'image'` in params instead |
| `[asset-params-all:{...}]` | User message | Bulk form submission; parsed by backend to extract all asset values |
| `[carousel-gather:{...}]` | Agent message | Carousel refinement state between slides |
| `[post-render:...]` | Agent message | Final output — slide URLs passed to SlideGrid |

**JSON extraction rule**: every marker that embeds JSON must be parsed with `extractNestedJson(text, '[marker-name:')`, not a regex. The function walks character by character counting `{`/`}` depth.

---

## Frontend components

All in `apps/web/src/pages/AgentChatPage.tsx`.

| Component | Trigger | Purpose |
|---|---|---|
| `AssetParamsCard` | `parseExtraParamsGather()` returns non-null on the last agent message | Inline form for all template parameters |
| `StylePickerCard` | `parseStylePicker()` | Grid of training sample thumbnails to pick from |
| `ContentConfirmCard` | `parseContentConfirm()` | Shows proposed slide list with Confirm/Edit |
| `SlideGrid` | Agent message starts with `SLIDE_RENDER_PREFIX` | Final slide display + zip download |
| `RenderProgressBubble` | `renderProgress` is non-null while thinking | Shows completed slides + skeletons during generation |
| `SlideThumb` | Used by SlideGrid and RenderProgressBubble | Single slide thumbnail; uses named group `group/thumb` to prevent hover bleed |

### Progressive slide reveal

While slides are generating, the frontend polls `/runs/{runId}/logs` every 800ms. Each `post_ai_slide_end` log event carries `slide_url`. The `renderProgress` memo collects these into a `slideUrls` array. `RenderProgressBubble` renders each URL as a `SlideThumb` immediately, leaving remaining slots as animated skeletons.

### Hover scoping

`SlideThumb` uses `group/thumb` + `group-hover/thumb:` (named Tailwind group). This is required because the parent `MessageBubble` div has `class="group"` for reply button fade-in — an unnamed `group-hover:` on a child would fire for the entire message on hover, showing the overlay icon on all thumbnails at once.

---

## Activity log events

Events emitted during DNA-path generation (all under `runId` in `agent_run_logs`):

| `event_type` | When | Key metadata fields |
|---|---|---|
| `post_render_start` | Before the generation loop starts | `slide_count`, `render_id: 'dna'` |
| `post_ai_slide_start` | Before each slide | `slide_index` |
| `post_ai_slide_end` | After each successful slide | `slide_index`, `slide_url`, `duration_ms`, `estimated_cost_usd` |
| `post_ai_slide_fallback` | After each failed slide | `slide_index` |
| `post_upload_done` | After all slides complete | `slide_urls` (array) |

`render_id: 'dna'` is the sentinel the frontend uses to distinguish the DNA-edit path from the traditional SVG render path. When `renderId === 'dna'`, `RenderProgressBubble` reads `slideUrls` from `post_ai_slide_end` events instead of constructing URLs from the render ID.

---

## History context stripping

Before the `triggerMutation` sends history to the API, it sanitizes each message:
- Strips base64 data URLs: `data:[mime];base64,[chars]` → `[image]`
- Strips `[asset-params-all:{...}]` markers → friendly summary via `assetParamsSummary()`

This prevents the ~2M token error that occurs when a base64 avatar photo from the form ends up in the LLM context via history.

The user-facing message for an `[asset-params-all:]` submission is formatted as `"Sharifur Rahman · @handle · taskip.net · [photo uploaded]"` — built by `assetParamsSummary()` in `AgentChatPage.tsx`.

---

## Adding a new training sample

1. Open Agents → Canva → Design Samples tab
2. Click Upload → select one or more PNG/JPG images
3. Wait for DNA extraction (green checkmark on the card)
4. Verify the extracted params: the card shows `hasAvatarZone`, `headlineWordCount`, and the auto-detected parameters
5. The template is now selectable in the style picker when starting a carousel

To re-analyze a sample (e.g. after changing the `EXTRACT_SYSTEM` prompt):
- Delete the template and re-upload the image

---

## Constraints and known limits

| Constraint | Detail |
|---|---|
| Max 2 input images to `images.edit()` | gpt-image-1 accepts an array but the API behaviour with >2 is undefined; we pass `[template, avatar]` |
| Avatar must be uploaded as a file | URL-based avatars (non-`data:`) are passed as a text prompt hint only; gpt-image-1 cannot reliably fetch URLs |
| `images.edit()` size must be one of 3 fixed values | `snapImageSize()` snaps orientation → size; custom pixel dimensions are not supported |
| BullMQ `lockDuration: 300000` | 7 slides × ~20s each = ~140s total; the default 30s lock causes stall-retries and duplicate generation runs |
| DNA renders stored on local disk | `~/Designs/AI-Agent/DnaRenders/`; not replicated; restart-safe but not multi-node safe |
| `EXTRACT_SYSTEM` prompt change requires re-upload | Existing templates keep the DNA extracted at upload time |
