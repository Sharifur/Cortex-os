# Post Format Engine — Usage & Training Guide

Self-hosted image generation pipeline for social media posts. Converts a format template + brand identity + topic into rendered PNG slides — no Canva API, no browser, no external rendering service.

---

## How to generate a post from agent chat

Type a message in the Canva agent chat following this pattern:

```
Generate a <format-id> for brand <brand-name> about "<topic>"
```

### Available format IDs

| Format ID | Platform | Type | Slides | Dimensions |
|---|---|---|---|---|
| `linkedin-tips-carousel` | LinkedIn | carousel | 6 | 1080×1080 |
| `linkedin-howto-carousel` | LinkedIn | carousel | 5 | 1080×1080 |
| `linkedin-stat-single` | LinkedIn | single | 1 | 1200×627 |
| `linkedin-quote-single` | LinkedIn | single | 1 | 1200×627 |
| `linkedin-list-carousel` | LinkedIn | carousel | 7 | 1080×1080 |
| `instagram-quote` | Instagram | single | 1 | 1080×1080 |
| `instagram-fact` | Instagram | single | 1 | 1080×1080 |
| `instagram-carousel-edu` | Instagram | carousel | 6 | 1080×1080 |
| `instagram-story-tip` | Instagram | story | 1 | 1080×1920 |
| `instagram-story-announce` | Instagram | story | 1 | 1080×1920 |
| `twitter-announcement` | Twitter | single | 1 | 1600×900 |
| `twitter-thread-card` | Twitter | single | 1 | 1600×900 |
| `facebook-ad-banner` | Facebook | single | 1 | 1200×628 |
| `generic-infographic` | Any | single | 1 | 1080×1080 |
| `generic-checklist` | Any | single | 1 | 1080×1080 |

### Example prompts (copy and paste into chat)

```
Generate a linkedin-tips-carousel for brand taskip about "5 ways to save 4 hours a week on client work"

Generate a linkedin-howto-carousel for brand taskip about "how to onboard a new client in 3 steps"

Generate a linkedin-stat-single for brand taskip about "87% of freelancers waste time on manual follow-ups"

Generate an instagram-story-tip for brand xgenious about "one habit that saves developers 2 hours a week"

Generate a generic-checklist for brand taskip about "before you launch: the 7-point SaaS checklist"

Generate a twitter-announcement for brand taskip about our new Insight analytics dashboard
```

### Optional parameters

Add `intent` to steer content angle:

```
Generate a linkedin-tips-carousel for brand taskip about "client management" intent tips

Generate a linkedin-stat-single for brand taskip about "productivity" intent stat
```

Supported intents: `tips`, `announcement`, `quote`, `stat`, `how to`, `checklist`, `list`

---

## REST API

Generate directly without the chat agent:

```
POST /posts/render
Content-Type: application/json

{
  "formatId": "linkedin-tips-carousel",
  "brand": "taskip",
  "topic": "saving time on admin",
  "intent": "tips"
}
```

Response:
```json
{
  "id": "cm...",
  "formatId": "linkedin-tips-carousel",
  "brand": "taskip",
  "slideUrls": [
    "https://your-minio/post-render/taskip/linkedin-tips-carousel/slide-1.png",
    "..."
  ],
  "status": "draft",
  "createdAt": "2026-05-12T..."
}
```

List renders:
```
GET /posts/renders?brand=taskip&limit=20
GET /posts/renders/:id
```

Approve / reject:
```
POST /posts/renders/:id/approve
POST /posts/renders/:id/reject
```

List available formats:
```
GET /posts/formats
GET /posts/formats/linkedin-tips-carousel
```

---

## Downloading and exporting

Every render has four export formats accessible from the Post Renders tab (Canva agent → Post Renders):

| Export | Endpoint | Best for |
|---|---|---|
| PNG slides | Direct URLs in `slideUrls` | Publishing directly, sharing |
| PPTX | `GET /posts/renders/:id/pptx` | Import into Canva — each element is a separate editable layer |
| Canva Bulk Create CSV | `GET /posts/renders/:id/canva-csv` | Upload to Canva Apps → Bulk Create to auto-fill a Canva template |
| Plain text | `GET /posts/renders/:id/text-export` | Paste individual text into any design tool |

### Importing PPTX into Canva

1. Download the PPTX from the Post Renders tab
2. In Canva: **File → Import** → select the `.pptx` file
3. Each text block, accent bar, and logo is a separate draggable layer
4. Edit any element, change fonts, adjust colors — then export

### Using Canva Bulk Create CSV

1. Create a Canva template with named text fields matching slot names: `{Headline}`, `{Body}`, `{CTA}`
2. Download the CSV
3. In Canva: **Apps → Bulk Create** → upload the CSV
4. Canva generates all slides automatically with AI-written content

---

## How the consistency engine works

Before any slide is rendered, the system derives a **ThemeContract** — a locked style object covering:

- Background colors (cover, content, CTA slides each get their own)
- Accent color (derived from `canvaBrands.palette[2]`)
- Heading/body font (from `canvaBrands.fonts`)
- Font size tier (44–68px depending on design DNA if available)
- Padding, accent bar position, logo position, indicator format

All slides in a carousel share the same ThemeContract object. This guarantees structural consistency — same font size, same padding, same accent color on every slide — without any post-render comparison.

After content is generated, 7 consistency rules run:
1. Headline length — truncated if over `headlineMaxChars`
2. Headline uniqueness — flags duplicate headlines across content slides
3. Required slots — blocks render if any required slot is missing
4. Count integrity — if the cover says "5 tips" but 4 content slides exist, an LLM correction pass rewrites the headline
5. Slide count — verifies total slides match the format spec
6. Body length — truncated if over `bodyMaxChars`
7. List item count — trimmed to `listItemsMax`

---

## Training the system with design samples

The system can learn your preferred design style from uploaded images. After 20+ samples, it clusters the patterns and uses them as style guidance for every render.

### Step 1 — Open the Design Samples tab

Go to: **Agents → Canva → Design Samples**

### Step 2 — Set the brand

Type the brand name (`taskip` or `xgenious`) in the Brand field. Samples are always brand-scoped.

### Step 3 — Upload sample images

Click **Upload samples** and select 1–50 PNG/JPG files. Each image is:
1. Uploaded to Minio storage
2. Analyzed by GPT-4V which extracts a Design DNA JSON
3. Stored in the Knowledge Base as `entryType: design_sample` tagged to your brand

**What makes a good sample?**
- Export your best-performing LinkedIn posts as PNG
- Include cover slides, content slides, and CTA slides separately — the system learns per slide type
- Mix light and dark backgrounds
- 10–30 samples is enough to see pattern learning; 100+ gives better coverage

**Supported file types:** PNG, JPG, WEBP

### Step 4 — Review extracted DNA

After upload each sample shows a card with:
- Thumbnail
- Detected `slide_type` (cover / content / cta / quote / stat / list)
- Detected `platform_fit` (linkedin / instagram / twitter / facebook)
- Layout and mood keywords

If the detection looks wrong, delete that sample and re-upload a cleaner image.

### Step 5 — Learn patterns (requires 20+ samples)

Click **Learn patterns**. This runs a clustering pass:
1. All samples for this brand are fetched
2. An LLM summarises the dominant patterns into 3–5 reusable style rules
3. The rules are stored as `entryType: design_pattern` — an always-on KB context
4. Every subsequent render for this brand reads the patterns before generating content

Example learned pattern:
> "LinkedIn cover slides: dark #1e1b4b background, left-aligned bold headline at 68px, 6px indigo top accent bar, logo bottom-left at 22px, minimal whitespace, no decorative elements"

### Step 6 — Re-cluster after adding more samples

Add more samples at any time. Click **Learn patterns** again — it overwrites the previous pattern summary. The system gets smarter as more samples are added.

---

## API endpoints for design samples

```
POST /posts/design-samples/upload?brand=taskip
  Content-Type: multipart/form-data
  body: files[] (images)

GET  /posts/design-samples?brand=taskip&platform=linkedin&slideType=cover

POST /posts/design-samples/cluster
  body: { "brand": "taskip" }

GET  /posts/design-samples/patterns?brand=taskip

DELETE /posts/design-samples/:id
```

---

## Brand setup (required before first render)

The renderer reads brand identity from the `canvaBrands` table. Configure a brand via:

**Canva agent → Brands tab → Add brand**

Required fields:
- **Name** — slug used in prompts (`taskip`, `xgenious`)
- **Palette** — array of hex colors: `["#1e1b4b", "#3730a3", "#6366f1", "#c7d2fe", "#ffffff"]`
  - `palette[0]` → cover slide background
  - `palette[1]` → CTA slide background
  - `palette[2]` → accent bar / stripe color
- **Fonts** — Google Fonts family names: `["Inter", "Inter"]`
  - `fonts[0]` → heading font (bold)
  - `fonts[1]` → body font (regular)
- **Logo URL** — public URL to a PNG logo (Minio or any CDN). The renderer downloads and embeds it as base64.
- **Voice profile** — one paragraph describing brand tone, used by AI for content generation

Font loading: fonts are fetched from Google Fonts API at render time and cached in memory. If a font is unavailable, the renderer falls back to Inter automatically.

---

## Activity monitoring

Every render step logs to the Activity panel in real-time. Go to **Activity** to watch a render in progress:

```
INFO   Canva Agent   Post render: LinkedIn Tips Carousel for taskip
DEBUG  Canva Agent   Theme locked: Inter accent:#6366f1 bg:#1e1b4b
DEBUG  Canva Agent   Generating content: 18 slots across 6 slides
INFO   Canva Agent   Content ready: 6 slides filled
DEBUG  Canva Agent   Rendering slide 1/6: centered layout
INFO   Canva Agent   Render complete: 6 slides uploaded
```

Expand any log entry to see `render_id`, `slide_urls`, `duration_ms`, and full metadata.

---

## Troubleshooting

**"brand not found" error**
→ The brand name in your prompt doesn't match a `canvaBrands` record. Go to Brands tab and add it.

**Blank or missing slides**
→ Check the Activity log for `post_render_error`. Usually a Minio connectivity issue or font fetch failure.

**Content looks generic / not on-brand**
→ Add more design samples and run "Learn patterns". The AI uses these as style constraints.
→ Also update the voice profile in the brand settings to be more specific.

**PPTX import into Canva shows wrong fonts**
→ Canva substitutes fonts not in its library. Use a font that exists in both Google Fonts and Canva (Inter, Lato, Montserrat, Roboto, Poppins all work).

**Image backgrounds not generating**
→ Add an `openai_api_key` or `gemini_api_key` in Settings. Slides fall back to solid color if no image provider is configured.
