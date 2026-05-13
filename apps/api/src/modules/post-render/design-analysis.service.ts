import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, like, sql } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';
import { designReanalysisState } from './schema';
import type { DesignDNA } from './types';
import { DesignPatternService } from './design-pattern.service';

const LOCAL_SAMPLES_DIR = path.join(os.homedir(), 'Designs', 'AI-Agent', 'DesignSamples');

const DNA_PROMPT = `You are an expert design analyst. Study every pixel of this image and extract a complete design DNA. Return ONLY valid JSON — no markdown fences, no explanation.

Use exactly this JSON structure (choose the closest enum value where applicable):

{
  "layout_type": "centered|left-aligned|split-panel|overlay|grid|diagonal|asymmetric",
  "composition": "rule-of-thirds|center-weighted|edge-anchored|full-bleed|diagonal|Z-pattern",
  "text_alignment": "left|center|right|mixed",
  "whitespace": "generous|moderate|tight",
  "element_density": "minimal|moderate|rich",
  "visual_hierarchy": ["list every visual zone top-to-bottom, e.g. logo, eyebrow-label, headline, subtext, icon-row, cta-button, brand-bar"],
  "text_layers_count": "single|two|three-plus",

  "primary_color": "#hexcode — dominant background or fill color",
  "accent_color": "#hexcode — strongest contrast or call-to-action color",
  "secondary_colors": ["#hex — every other distinct color visible, empty array if none"],
  "color_count": "monochrome|duotone|tricolor|full-palette",
  "background_style": "solid-light|solid-dark|gradient-dark|gradient-light|textured|photo|illustrated",
  "background_image_used": true or false,
  "background_texture": "none|grain|noise|grid|dots|lines|organic|geometric-pattern",

  "font_weight_heading": "thin|regular|medium|semibold|bold|black|extrabold",
  "font_size_heading": "small|medium|large|xlarge|huge|display",
  "font_style": "modern-sans|classic-serif|geometric|rounded|slab-serif|monospace|display",
  "body_font_style": "modern-sans|classic-serif|geometric|rounded",
  "number_stat_style": "none|large-display-number|badge|inline-text",

  "icon_style": "none|flat-filled|flat-outlined|duotone|gradient|hand-drawn|emoji|custom-illustration",
  "icon_count": "none|single|few-2-4|many-5-plus",
  "icon_size": "none|small-inline|medium-decorative|large-hero",

  "illustration_style": "none|vector-flat|vector-3d|hand-drawn|isometric|abstract-shape|pattern-based|character",
  "photography_style": "none|lifestyle|product|abstract|corporate|conceptual|mockup",

  "decoration_elements": ["list every decorative shape/element visible: circles, geometric-shapes, gradient-blobs, confetti, lines, dots-grid, wave, divider-bar, noise-texture — use 'none' if absent"],
  "accent_elements": ["visible structural accents: top-bar, bottom-bar, left-stripe, right-stripe, underline, badge, quote-mark, number-label, corner-shape — use 'none' if absent"],
  "border_radius_style": "sharp|slightly-rounded|rounded|pill",
  "shadow_usage": "none|subtle-text|card-shadow|dramatic",
  "divider_style": "none|line|gradient-line|space-only",

  "logo_placement": "none|top-left|top-right|bottom-left|bottom-right|center",
  "brand_bar": "none|top|bottom|left|right",
  "cta_style": "none|pill-button|flat-button|outlined-button|text-link|arrow-link",

  "slide_type": "cover|content|cta|quote|stat|list|testimonial",
  "content_tone": "formal|casual|punchy|educational|inspirational|promotional",
  "mood_keywords": ["3–6 single words describing the visual feel, e.g. bold, premium, clean, energetic"],
  "platform_fit": ["linkedin", "instagram", "twitter", "facebook"],

  "shape_elements": [
    {
      "shape_type": "circle|ellipse|rectangle|rounded-rect|polygon|diagonal-cut|wave|blob|ring|arc|radial-glow|custom-path",
      "fill_type": "solid|linear-gradient|radial-gradient|none",
      "fill_colors": ["#hex"],
      "gradient_angle": 135,
      "stroke_color": "#hex or omit",
      "stroke_width": 2,
      "opacity": 0.15,
      "x": 60, "y": 0, "w": 40, "h": 40,
      "border_radius": 50,
      "clipped_at_edge": false,
      "visible_arc": "top-left|top-right|bottom-left|bottom-right|full|top-half|bottom-half",
      "svg_hint": "Large semi-transparent circle at top-right, accent color, decorative only"
    }
  ],

  "decorative_illustrations": [
    {
      "subject": "paper-plane|geometric-arrow|curved-arrow|motion-lines|dollar-sign|dollar-sign-circle|shopping-cart|person-character|star|star-burst|lightbulb|leaf|flower|checkmark|checkmark-circle|quote-marks|confetti|lightning|heart|sparkle|hand|eye|megaphone|target|clock|growth-chart|bar-chart|pie-chart|envelope|phone|lock|globe|trophy|crown|rocket|coin|badge|tag|speech-bubble|custom",
      "subject_description": "Outline paper airplane pointing upper-right, line-art only with no fill",
      "render_style": "outline-stroke|filled-flat|filled-gradient|duotone|hand-drawn|emoji|silhouette|mixed",
      "stroke_color": "#ffffff",
      "fill_color": "none",
      "stroke_width_style": "hairline|thin|medium|thick",
      "opacity": 1.0,
      "semantic_role": "decorative|bullet-point|cta-indicator|brand-element|section-divider|scene-prop|scene-character|motion-indicator",
      "scene_group": "main-scene|scattered|standalone",
      "instances": [
        { "x": 62, "y": 2, "w": 22, "h": 18, "rotation_deg": 0, "size_relative": "large", "z_index": 3, "interacts_with": [] }
      ]
    }
  ],

  "scene_composition": {
    "type": "unified-scene|scattered-icons|single-character|none",
    "theme": "business-growth|ecommerce|communication|finance|education|health|technology|lifestyle|custom",
    "narrative": "One sentence describing what story or concept the illustration conveys — e.g. 'Person riding a shopping cart surrounded by dollar signs and an upward arrow, symbolising business revenue growth'",
    "characters_present": ["person-character", "cartoon-animal"],
    "props_present": ["shopping-cart", "dollar-sign-circle", "geometric-arrow", "motion-lines"],
    "element_relationships": [
      {
        "element_a": "person-character",
        "relationship": "inside|riding|holding|pointing-at|standing-next-to|overlapping|emerging-from|connected-to",
        "element_b": "shopping-cart",
        "notes": "Cartoon person sits inside the shopping cart with arm raised"
      }
    ],
    "scene_region": { "x": 5, "y": 3, "w": 90, "h": 52 }
  },

  "photo_subjects": [
    {
      "subject_type": "person-portrait|person-halfbody|person-fullbody|person-group|product|object|hands|face-closeup",
      "treatment": "cutout|full-frame|circle-mask|shape-mask|blurred-bg",
      "position_alignment": "right-anchored|left-anchored|center|bottom-anchored|top-anchored|corner-bottom-right|corner-bottom-left",
      "body_framing": "head-only|head-shoulders|waist-up|full-body",
      "x": 45, "y": 15, "w": 55, "h": 85,
      "z_index": 8,
      "z_layer": "foreground",
      "overlaps_with": ["headline-text", "body-text"],
      "description": "Professional man in dark suit, cutout with background removed, right-anchored, extends below canvas bottom edge"
    }
  ],

  "grid_columns": 1,
  "content_zone": { "x": 5, "y": 10, "w": 90, "h": 80 },

  "layer_stack": ["canvas-background", "decoration-blob", "stat-number-display", "headline-line-1", "eyebrow-pill", "logo", "cta-button"],

  "element_positions": [
    {
      "name": "logo",
      "type": "logo|text|image|shape|icon|cta-button|brand-bar|divider",
      "x": 5, "y": 5, "w": 20, "h": 8,
      "align": "left|center|right",
      "rotation_deg": 0,
      "z_index": 5,
      "z_layer": "foreground",
      "overlaps_with": []
    }
  ],

  "text_elements": [
    {
      "role": "eyebrow|headline|subheadline|body|caption|stat-number|stat-label|list-item|cta-label|attribution|slide-number|tag|watermark",
      "content_preview": "First few words or '[stat]' placeholder",
      "x": 5, "y": 20, "w": 90, "h": 12,
      "align": "left|center|right",
      "rotation_deg": 0,
      "font_weight": "thin|regular|medium|semibold|bold|black|extrabold",
      "font_style": "normal|italic|oblique",
      "font_family_style": "modern-sans|classic-serif|geometric|rounded|slab-serif|monospace|display|script",
      "estimated_size_px": 52,
      "color_hex": "#ffffff",
      "background_hex": "none or #hex if the entire text block has a background fill (e.g. pill, badge, colored label)",
      "background_shape": "none|rectangle|rounded-rect|pill|squircle",
      "background_rotation_deg": 0,
      "letter_spacing": "tight|normal|wide|very-wide",
      "line_height": "tight|normal|relaxed",
      "case_style": "uppercase|title-case|sentence-case|lowercase|mixed",
      "decoration": "none|underline|strikethrough|highlight-bg|outline-stroke",
      "is_multiline": false,
      "line_count": 1,
      "opacity": 1.0,
      "z_index": 3,
      "z_layer": "foreground",
      "overlaps_with": [],
      "word_highlights": [
        {
          "word_or_phrase": "PERSONAL",
          "background_hex": "#F5A623",
          "background_shape": "rectangle|rounded-rect|pill|underline-bar",
          "rotation_deg": -3,
          "padding_h_px": 8,
          "padding_v_px": 4,
          "spans_line_width": true
        }
      ]
    }
  ],

  "composite_effects": [
    {
      "type": "number-as-background|word-highlight-shape|layered-eyebrow|inline-badge|text-overlap|shape-behind-text|photo-behind-text",
      "description": "Giant coral-red '3' fills left 55% of canvas as a mid-layer element; headline text renders on its right portion — classic display-number-as-background composition",
      "elements_involved": ["stat-number-display", "headline-text"],
      "bottom_element": "stat-number-display",
      "top_element": "headline-text",
      "overlap_region": { "x": 45, "y": 30, "w": 15, "h": 45 }
    }
  ],

  "typography": {
    "heading_case": "uppercase|title-case|sentence-case|mixed",
    "heading_letter_spacing": "tight|normal|wide|very-wide",
    "heading_line_height": "tight|normal|relaxed",
    "heading_word_count_typical": "1-3|4-6|7-10|10+",
    "uses_eyebrow_label": true or false,
    "eyebrow_style": "none|uppercase-small-caps|colored-label|outlined-tag",
    "body_present": true or false,
    "body_line_count_typical": "1|2-3|4-6|block",
    "font_mix": "single-font|two-fonts|three-plus-fonts",
    "heading_estimated_size_px": 72,
    "body_estimated_size_px": 18,
    "uses_highlight_text": true or false,
    "highlight_style": "none|colored-word|underline|background-highlight|bold-word"
  },

  "spacing": {
    "outer_padding_style": "tight-5|medium-8|comfortable-10|generous-12-plus",
    "headline_to_body_gap": "tight|medium|large",
    "element_vertical_rhythm": "tight|even|spacious",
    "cta_margin_top": "tight|medium|large",
    "logo_margin": "flush|small|medium|large"
  },

  "color_usage": {
    "background_hex": "#hex — exact background color",
    "headline_text_hex": "#hex — exact headline text color",
    "body_text_hex": "#hex — body text color, omit if same as headline",
    "cta_background_hex": "#hex — CTA button fill, omit if no CTA",
    "cta_text_hex": "#hex — CTA text color, omit if no CTA",
    "accent_bar_hex": "#hex — color of any accent stripe/bar, omit if none",
    "icon_color_hex": "#hex — icon color, omit if no icons"
  },

  "text_content_pattern": {
    "headline_starts_with": "number|question|verb|noun|adjective|proper-noun",
    "uses_brand_name_in_headline": true or false,
    "has_social_handle": true or false,
    "has_url": true or false,
    "has_tagline": true or false,
    "has_copyright": true or false
  },

  "pattern_notes": "Two to three concise sentences describing any unique or notable design details not captured by the fields above — pay special attention to spacing rhythms, color combinations, and typography choices. Empty string if nothing notable."
}

Rules for shape_elements:
- List every distinct decorative or structural shape: background blobs, corner circles, diagonal cuts, waves, stripes, rings, radial glows, etc.
- Ignore pure text elements and recognisable illustration objects (those go in decorative_illustrations).
- fill_colors: for gradients list [start_color, end_color]; for solid list [color].
- clipped_at_edge: true when the shape extends beyond the canvas boundary and only a portion is visible (e.g. a large circle where only the bottom-right arc is visible in the top-left corner). Set visible_arc to describe which portion is showing.
- For partial circles used as corner decorations (common in brand designs), use shape_type "ring" if hollow, "circle" if filled. Set clipped_at_edge: true and describe the visible portion in visible_arc and svg_hint.
- For white/light soft glow blobs (radial light effect), use shape_type "radial-glow", fill_type "radial-gradient", fill_colors ["#ffffff", "transparent"] or similar, with appropriate low opacity.
- svg_hint: write enough to reconstruct the shape programmatically — position, size relative to canvas, colors, opacity, whether clipped, which quadrant is visible.
- Empty array if there are no decorative shapes.

Rules for photo_subjects:
- List every photo of a person, product, or object used as a design element (not as a background texture).
- treatment: "cutout" = background removed, only the subject outline remains (most common for person photos); "full-frame" = photo with its own background filling a region; "circle-mask" = photo clipped to circle; "shape-mask" = clipped to another shape; "blurred-bg" = background intentionally blurred.
- position_alignment: how the photo is anchored — right-anchored means the person is placed on the right half; corner-bottom-right means positioned starting from bottom-right. Many person cutouts are right-anchored and extend below the canvas bottom edge.
- body_framing: how much of the body is visible — "head-only", "head-shoulders", "waist-up", "full-body".
- z_index: person cutout photos are almost always the highest z_index element (rendered on top of everything including text in many designs).
- overlaps_with: list every element whose bounding box the photo covers.
- description: plain-English description including clothing color, general appearance, and any notable styling choices.
- Empty array if the design has no photo subjects.

Rules for decorative_illustrations:
- Capture every non-geometric illustrative or icon element in the design: paper planes, arrows, stars, lightbulbs, leaves, flowers, sparkles, quote marks, confetti, hands, eyes, charts, etc.
- Do NOT use this for simple geometric shapes (circles, rectangles, blobs) — those go in shape_elements. Use this ONLY for recognisable objects or icons.
- subject: pick the closest value from the enum list or use "custom" with a detailed subject_description.
- subject_description: always fill this — describe what the illustration depicts in plain English, including its visual style (e.g. "Outline paper airplane pointing upper-right, line-art only with no fill, white stroke on green background").
- render_style: "outline-stroke" = line art with no fill; "filled-flat" = solid color fill; "filled-gradient" = gradient fill; "duotone" = two-color; "hand-drawn" = sketchy/brushy edges; "silhouette" = solid black/dark shape.
- instances: list EVERY individual occurrence as a separate entry with its own x/y/w/h and rotation_deg. If the same paper plane appears twice (top-right large, bottom-right smaller), create TWO instances — each with its own coordinates and rotation.
- size_relative: "small" = less than 10% canvas width, "medium" = 10–25%, "large" = 25%+.
- semantic_role: "decorative" = purely visual; "bullet-point" = marks a list item; "cta-indicator" = points toward a CTA; "brand-element" = part of brand identity; "section-divider" = visually separates content areas.
- Empty array [] only if the design has zero illustrative/icon elements.

Rules for layer_stack:
- List ALL element names in painting order — first item = drawn first (bottom-most), last item = drawn last (on top).
- Every name must match an entry in element_positions or text_elements.
- This is critical for reconstructing overlap compositions: if a giant stat number sits behind headline text, the stat number appears earlier in the list.
- Example: ["canvas-bg", "stat-number-3", "headline-text", "logo", "cta-button"]

Rules for element_positions:
- List EVERY distinct visual element you can see: logo, eyebrow-label, headline-line-1, headline-line-2 (if separate visual blocks), subheadline, body-text, icon (one per grouping), cta-button, brand-bar, left-stripe, top-bar, background-shape, decoration-circle, photo, illustration, stat-number-display, stat-label, list-item-group, quote-text, attribution-text, slide-number, divider.
- x, y, w, h: ALL percentages of canvas dimensions (0–100). Be precise — the difference between a 50% and 55% width matters for reconstruction.
- z_index: assign integer values starting from 1 (bottom). Each element must have a unique z_index. Higher = rendered on top.
- overlaps_with: list the names of any elements whose bounding boxes visually intersect this element. Empty array if no overlap.
- z_layer: background = behind all content, mid = decorative but behind text, foreground = top-most.
- rotation_deg: 0 for upright; positive = clockwise tilt; negative = counter-clockwise.

Rules for decorative_illustrations:
- Capture every non-geometric illustrative or icon element in the design: paper planes, arrows, stars, lightbulbs, leaves, flowers, sparkles, quote marks, confetti, hands, eyes, charts, etc.
- Do NOT use this for simple geometric shapes (circles, rectangles, blobs) — those go in shape_elements. Use this ONLY for recognisable objects or icons.
- subject: pick the closest value from the enum list or use "custom" with a detailed subject_description.
- subject_description: always fill this — describe what the illustration depicts in plain English, including its visual style (e.g. "Outline paper airplane pointing upper-right, line-art only with no fill, white stroke on green background").
- render_style: "outline-stroke" = line art with no fill; "filled-flat" = solid color fill; "filled-gradient" = gradient fill; "duotone" = two-color; "hand-drawn" = sketchy/brushy edges; "silhouette" = solid black/dark shape.
- instances: list EVERY individual occurrence as a separate entry with its own x/y/w/h and rotation_deg. If the same paper plane appears twice (top-right large, bottom-right smaller), create TWO instances — each with its own coordinates and rotation.
- size_relative: "small" = less than 10% canvas width, "medium" = 10–25%, "large" = 25%+.
- semantic_role: "decorative" = purely visual; "bullet-point" = marks a list item; "cta-indicator" = points toward a CTA; "brand-element" = part of brand identity; "section-divider" = visually separates content areas.
- Empty array [] only if the design has zero illustrative/icon elements.

Rules for text_elements:
- List EVERY distinct text layer as a separate entry — never merge separate visual text blocks into one.
- If a headline is split across multiple visual lines with different sizes, colors, or background treatments (e.g. "GROW" on line 1, "YOUR" on line 2, "PERSONAL" on line 3 with a yellow highlight behind it), create a SEPARATE entry for each line.
- font_style: "normal" for upright text, "italic" for slanted/italic, "oblique" for artificially slanted. This is per text block — if "Are" is italic and "You Stuck?" is normal within a single headline, they are TWO entries.
- font_family_style: the apparent typeface category for THIS block specifically — important when a design mixes italic script for one word and extrabold sans-serif for another.
- z_index: must match the corresponding element in element_positions. Higher = on top.
- overlaps_with: list names of elements whose bounding box overlaps this text. A stat-number display element that text renders on top of must appear here. An eyebrow pill overlapping the start of a headline must be listed.
- background_hex + background_shape: use these when the ENTIRE text block has a fill (e.g. a teal pill for "transformational", a pink button for a URL, an amber badge for "traits:"). background_rotation_deg: if the background shape is tilted (like a slightly rotated highlight rectangle), specify the angle.
- word_highlights: use this array ONLY for cases where individual words WITHIN a text block have their own background shape — like a single word in a headline that has a colored rectangle painted behind just that word. Each entry: the word(s) affected, the background color, shape type, rotation, and padding. Leave as empty array [] if no per-word highlights.
- rotation_deg: actual clockwise angle for any rotated/angled text element. Most = 0.
- estimated_size_px: font size in pixels assuming 1080px canvas height. ~10% canvas height = ~108px.
- content_preview: first 4–6 visible words, or placeholder like [stat], [url], [date].
- Do not skip small text: captions, slide numbers, watermarks, handles, URLs, copyright — all get separate entries.

Rules for scene_composition:
- Use this section whenever the design has a meaningful illustration or character scene (not just scattered decorative icons).
- type: "unified-scene" = multiple elements forming one coherent visual story; "scattered-icons" = independent icons placed around the layout; "single-character" = one character dominates; "none" = no scene.
- narrative: one sentence describing what story or concept the illustration communicates.
- characters_present: list animate subjects (people, animals, cartoon characters) by their subject type name.
- props_present: list every recognisable object or icon in the scene by subject type name.
- element_relationships: describe every meaningful interaction — relationship values: "inside" (A is physically inside B), "riding" (character on a vehicle), "holding" (character grips object), "pointing-at" (arrow points to element), "overlapping", "emerging-from", "connected-to", "standing-next-to".
- scene_region: bounding box as % of canvas containing the entire scene.

Rules for decorative_illustrations:
- Capture every non-geometric illustrative or icon element in the design.
- subject enum is extensive — use the most specific match available: prefer "dollar-sign-circle" for a $ in a circle, "geometric-arrow" for a bold straight arrow, "curved-arrow" for a hand-drawn curling arrow, "motion-lines" for parallel speed/motion lines, "person-character" for cartoon people (NOT real photos — those go in photo_subjects), "shopping-cart" for a cart, etc. Use "custom" only when nothing fits.
- For elements that are part of a unified scene, set scene_group: "main-scene". For independently scattered icons set "scattered". For a single standalone element set "standalone".
- subject_description: always fill — describe the element's visual appearance, color, style, and context in plain English.
- render_style: "outline-stroke" = line art only; "filled-flat" = solid fill; "mixed" = some outline, some filled (common for cartoon characters with outlined body but filled clothing or hair).
- instances[].interacts_with: list subject names of other elements this instance directly touches or interacts with in the scene (e.g. person-character instance interacts_with shopping-cart).
- size_relative: "small" < 10% canvas width; "medium" 10–25%; "large" > 25%.
- semantic_role: "scene-prop" = object within an illustration scene; "scene-character" = animate character in a scene; "motion-indicator" = speed lines or directional cues.
- Empty array [] only if the design has zero illustrative/icon elements.

Rules for composite_effects:
- Describe every significant overlap or layering relationship where elements interact visually.
- Type values: "number-as-background", "word-highlight-shape", "layered-eyebrow", "inline-badge", "text-overlap", "shape-behind-text", "photo-behind-text", "illustration-behind-text" (scene illustration extends behind text area), "illustration-over-text" (illustration rendered on top of text).
- Be specific: mention colors, approximate positions, and what the visual effect achieves.
- overlap_region: bounding box (as %) where the two elements actually intersect.
- Empty array if there are no significant overlapping relationships.`;

type FailedItem = { id: string; reason: string };
type ReanalysisStatus = { done: number; total: number; errors: number; running: boolean; cancelled: boolean; failedIds: string[]; failedDetails: FailedItem[] };

@Injectable()
export class DesignAnalysisService {
  private readonly logger = new Logger(DesignAnalysisService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly db: DbService,
    private readonly designPattern: DesignPatternService,
  ) {}

  private async getDnaMaxTokens(): Promise<number> {
    const raw = await this.settings.getDecrypted('canva_dna_max_tokens');
    const parsed = parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
  }

  async analyzeAndStore(
    imageBuffer: Buffer,
    opts: { brand: string; filename: string },
  ): Promise<{ dna: DesignDNA; kbEntryId: string; storageUrl: string }> {
    // Upload sample image to storage, fall back to local disk when R2 is not configured
    let storageResult: { url: string };
    const isConfigured = await this.storage.isConfigured();
    if (isConfigured) {
      storageResult = await this.storage.upload({
        module: 'post-render/design-samples',
        refKey: opts.brand,
        body: imageBuffer,
        declaredMime: 'image/png',
        originalFilename: opts.filename,
      });
    } else {
      const dir = path.join(LOCAL_SAMPLES_DIR, opts.brand);
      await fs.mkdir(dir, { recursive: true });
      const ext = path.extname(opts.filename) || '.png';
      const localFile = path.join(dir, `${createId()}${ext}`);
      await fs.writeFile(localFile, imageBuffer);
      storageResult = { url: `local://${localFile}` };
      this.logger.warn(`Storage not configured — saved design sample locally: ${localFile}`);
    }

    // Extract DNA via vision LLM
    const imageBase64 = imageBuffer.toString('base64');
    const res = await this.llm.complete({
      messages: [
        { role: 'user', content: DNA_PROMPT },
      ],
      imageBase64,
      imageMimeType: 'image/png',
      maxTokens: await this.getDnaMaxTokens(),
      temperature: 0.1,
      agentKey: 'canva',
    });

    let dna: DesignDNA;
    try {
      const jsonMatch = res.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? res.content.match(/(\{[\s\S]+\})/);
      dna = JSON.parse(jsonMatch?.[1] ?? res.content);
    } catch {
      throw new Error(`Vision LLM returned invalid JSON for design DNA`);
    }

    // Build KB entry content
    const embeddingText = this.buildEmbeddingText(dna);
    const content = this.buildKbContent(dna);

    const kbRow = await this.kb.createEntry({
      title: `Design Sample — ${dna.slide_type} — ${dna.platform_fit[0] ?? 'any'} — ${Date.now()}`,
      content,
      entryType: 'design_sample',
      agentKeys: 'canva',
      siteKeys: opts.brand,
      category: 'design',
      sourceType: 'image_upload',
      sourceUrl: storageResult.url,
    });
    const kbEntryId = kbRow.id;

    this.logger.log(`Design DNA extracted: ${dna.layout_type} ${dna.mood_keywords.join(',')} → kb:${kbEntryId}`);

    return { dna, kbEntryId, storageUrl: storageResult.url };
  }

  async listSamples(opts: { brand?: string; platform?: string; slideType?: string } = {}) {
    const conditions = [
      eq(knowledgeEntries.entryType, 'design_sample'),
      eq(knowledgeEntries.agentKeys, 'canva'),
    ];
    if (opts.brand) conditions.push(eq(knowledgeEntries.siteKeys, opts.brand));
    if (opts.platform) conditions.push(like(knowledgeEntries.content, `%${opts.platform}%`));
    if (opts.slideType) conditions.push(like(knowledgeEntries.content, `%${opts.slideType}%`));

    return this.db.db
      .select({
        id: knowledgeEntries.id,
        title: knowledgeEntries.title,
        content: knowledgeEntries.content,
        category: knowledgeEntries.category,
        sourceUrl: knowledgeEntries.sourceUrl,
        siteKeys: knowledgeEntries.siteKeys,
        createdAt: knowledgeEntries.createdAt,
      })
      .from(knowledgeEntries)
      .where(and(...conditions))
      .orderBy(knowledgeEntries.createdAt);
  }

  async countSamples(brand: string): Promise<number> {
    const rows = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, brand),
      ));
    return rows.length;
  }

  private reanalysisProgress = new Map<string, ReanalysisStatus>();
  private cancelledBrands = new Set<string>();

  async getReanalysisStatus(brand: string): Promise<ReanalysisStatus> {
    const mem = this.reanalysisProgress.get(brand);
    if (mem) return mem;
    const [row] = await this.db.db
      .select()
      .from(designReanalysisState)
      .where(eq(designReanalysisState.brand, brand))
      .limit(1)
      .catch(() => []);
    if (!row) return { done: 0, total: 0, errors: 0, running: false, cancelled: false, failedIds: [], failedDetails: [] };
    const stored = (row.failedIds as unknown) as FailedItem[] | string[] | null;
    const failedDetails: FailedItem[] = Array.isArray(stored) && stored.length > 0 && typeof stored[0] === 'object'
      ? (stored as FailedItem[])
      : [];
    const failedIds = failedDetails.map(f => f.id);
    return { done: row.done, total: row.total, errors: row.errors, running: false, cancelled: row.cancelled, failedIds, failedDetails };
  }

  cancelReanalysis(brand: string): void {
    this.cancelledBrands.add(brand);
    const status = this.reanalysisProgress.get(brand);
    if (status) status.running = false;
  }

  private persistStatus(brand: string, status: ReanalysisStatus): void {
    this.db.db
      .insert(designReanalysisState)
      .values({ brand, ...status, failedIds: status.failedDetails, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: designReanalysisState.brand,
        set: { done: status.done, total: status.total, errors: status.errors, running: status.running, cancelled: status.cancelled, failedIds: status.failedDetails, updatedAt: new Date() },
      })
      .catch((err: unknown) => this.logger.warn(`persist reanalysis state failed: ${(err as Error).message}`));
  }

  buildPatternRules(dna: DesignDNA): string[] {
    const cu = (dna as any).color_usage as Record<string, string> | undefined;
    const typo = (dna as any).typography as Record<string, unknown> | undefined;
    const spacing = (dna as any).spacing as Record<string, string> | undefined;
    const rules: string[] = [];

    // Layout
    if (dna.layout_type) rules.push(`[LAYOUT] ${dna.layout_type} layout`);
    if (dna.composition) rules.push(`[COMPOSITION] ${dna.composition} composition`);
    if (dna.text_alignment) rules.push(`[LAYOUT] text alignment: ${dna.text_alignment}`);
    if (dna.whitespace) rules.push(`[SPACING] whitespace: ${dna.whitespace}`);
    if (dna.element_density) rules.push(`[LAYOUT] element density: ${dna.element_density}`);
    if (dna.grid_columns) rules.push(`[GRID] ${dna.grid_columns} column${dna.grid_columns > 1 ? 's' : ''}`);
    if (spacing?.outer_padding_style) rules.push(`[SPACING] outer padding: ${spacing.outer_padding_style}`);
    if (spacing?.element_vertical_rhythm) rules.push(`[SPACING] vertical rhythm: ${spacing.element_vertical_rhythm}`);

    // Color
    const bgStyle = dna.background_style ?? '';
    const primaryHex = cu?.background_hex || dna.primary_color || '';
    if (bgStyle) rules.push(`[BACKGROUND] ${bgStyle}${primaryHex ? ` (${primaryHex})` : ''}`);
    if (dna.accent_color) rules.push(`[COLOR] accent color: ${dna.accent_color}`);
    if (dna.color_count) rules.push(`[COLOR] ${dna.color_count} palette`);
    if (cu?.headline_text_hex) rules.push(`[COLOR] headline text: ${cu.headline_text_hex}`);
    if (cu?.cta_background_hex) rules.push(`[COLOR] CTA button fill: ${cu.cta_background_hex}`);
    if (cu?.accent_bar_hex) rules.push(`[COLOR] accent bar: ${cu.accent_bar_hex}`);
    if (dna.background_texture && dna.background_texture !== 'none') rules.push(`[BACKGROUND] texture: ${dna.background_texture}`);

    // Typography
    if (dna.font_weight_heading && dna.font_style) {
      const caseStr = typo?.heading_case ? ` ${typo.heading_case}` : '';
      const spacing = typo?.heading_letter_spacing ? ` ${typo.heading_letter_spacing} spacing` : '';
      rules.push(`[TYPOGRAPHY] ${dna.font_weight_heading} ${dna.font_style} heading${caseStr}${spacing}`);
    }
    if (dna.font_size_heading) rules.push(`[TYPOGRAPHY] heading size: ${dna.font_size_heading}`);
    if (typo?.uses_eyebrow_label) rules.push(`[TYPOGRAPHY] eyebrow label style: ${typo.eyebrow_style ?? 'present'}`);
    if (typo?.uses_highlight_text) rules.push(`[TYPOGRAPHY] inline word highlight: ${typo.highlight_style ?? 'present'}`);
    if (typo?.body_present) rules.push(`[TYPOGRAPHY] body text: ${typo.body_line_count_typical ?? 'present'} lines`);
    if (dna.number_stat_style && dna.number_stat_style !== 'none') rules.push(`[TYPOGRAPHY] stat number style: ${dna.number_stat_style}`);

    // Icons / illustration / photography
    if (dna.icon_style && dna.icon_style !== 'none') rules.push(`[ICONS] ${dna.icon_style} icons, count: ${dna.icon_count}, size: ${dna.icon_size}`);
    if (dna.illustration_style && dna.illustration_style !== 'none') rules.push(`[ILLUSTRATION] ${dna.illustration_style}`);
    if (dna.photography_style && dna.photography_style !== 'none') rules.push(`[PHOTOGRAPHY] ${dna.photography_style}`);

    // Decoration & accents
    for (const d of (dna.decoration_elements ?? []).filter(x => x && x !== 'none')) {
      rules.push(`[DECORATION] ${d}`);
    }
    for (const a of (dna.accent_elements ?? []).filter(x => x && x !== 'none')) {
      rules.push(`[ACCENT] ${a}`);
    }

    // Shape elements (top 3 most useful)
    for (const s of (dna.shape_elements ?? []).slice(0, 3)) {
      if (s.svg_hint && s.svg_hint.length > 10) rules.push(`[SHAPE] ${s.svg_hint}`);
    }

    // Branding & CTA
    if (dna.brand_bar && dna.brand_bar !== 'none') rules.push(`[BRANDING] brand bar: ${dna.brand_bar}`);
    if (dna.logo_placement && dna.logo_placement !== 'none') rules.push(`[BRANDING] logo placement: ${dna.logo_placement}`);
    if (dna.cta_style && dna.cta_style !== 'none') {
      const ctaColor = cu?.cta_background_hex ? ` (${cu.cta_background_hex})` : '';
      rules.push(`[CTA] ${dna.cta_style}${ctaColor}`);
    }
    if (dna.border_radius_style) rules.push(`[STYLE] border radius: ${dna.border_radius_style}`);
    if (dna.shadow_usage && dna.shadow_usage !== 'none') rules.push(`[STYLE] shadow: ${dna.shadow_usage}`);
    if (dna.divider_style && dna.divider_style !== 'none') rules.push(`[STYLE] divider: ${dna.divider_style}`);

    // Slide type & tone
    if (dna.slide_type) rules.push(`[SLIDE] type: ${dna.slide_type}`);
    if (dna.content_tone) rules.push(`[TONE] ${dna.content_tone}`);
    for (const m of (dna.mood_keywords ?? [])) rules.push(`[MOOD] ${m}`);

    return rules.filter(Boolean);
  }

  private buildKbContent(dna: DesignDNA): string {
    return [
      `Design Sample Analysis`,
      ``,
      `-- Layout & Composition --`,
      `Layout: ${dna.layout_type}`,
      `Composition: ${dna.composition}`,
      `Text alignment: ${dna.text_alignment}`,
      `Whitespace: ${dna.whitespace}`,
      `Element density: ${dna.element_density}`,
      `Text layers: ${dna.text_layers_count}`,
      `Visual hierarchy (top to bottom): ${dna.visual_hierarchy.join(' > ')}`,
      ``,
      `-- Color --`,
      `Background: ${dna.background_style}${dna.background_image_used ? ' (photo/image used)' : ''}`,
      `Background texture: ${dna.background_texture}`,
      `Primary color: ${dna.primary_color}`,
      `Accent color: ${dna.accent_color}`,
      `Secondary colors: ${(dna.secondary_colors ?? []).join(', ') || 'none'}`,
      `Color palette: ${dna.color_count}`,
      ``,
      `-- Typography --`,
      `Heading: ${dna.font_weight_heading} weight, ${dna.font_size_heading} size, ${dna.font_style} style`,
      `Body: ${dna.body_font_style} style`,
      `Stat/number display: ${dna.number_stat_style}`,
      ``,
      `-- Icons --`,
      `Icon style: ${dna.icon_style}`,
      `Icon count: ${dna.icon_count}`,
      `Icon size: ${dna.icon_size}`,
      ``,
      `-- Illustrations & Photography --`,
      `Illustration style: ${dna.illustration_style}`,
      `Photography style: ${dna.photography_style}`,
      ``,
      `-- Decoration & Visual Details --`,
      `Decoration elements: ${(dna.decoration_elements ?? []).join(', ')}`,
      `Accent elements: ${(dna.accent_elements ?? []).join(', ')}`,
      `Border radius: ${dna.border_radius_style}`,
      `Shadows: ${dna.shadow_usage}`,
      `Divider: ${dna.divider_style}`,
      ``,
      `-- Branding & Structure --`,
      `Logo placement: ${dna.logo_placement}`,
      `Brand bar: ${dna.brand_bar}`,
      `CTA style: ${dna.cta_style}`,
      ``,
      `-- Content & Tone --`,
      `Slide type: ${dna.slide_type}`,
      `Content tone: ${dna.content_tone}`,
      `Mood: ${dna.mood_keywords.join(', ')}`,
      `Platform fit: ${dna.platform_fit.join(', ')}`,
      ``,
      `-- Spatial Layout --`,
      `Grid columns: ${dna.grid_columns ?? 1}`,
      `Content zone: x=${dna.content_zone?.x}% y=${dna.content_zone?.y}% w=${dna.content_zone?.w}% h=${dna.content_zone?.h}%`,
      `Layer stack (back->front): ${(dna.layer_stack ?? []).join(' > ')}`,
      `Elements (${(dna.element_positions ?? []).length}):`,
      ...(dna.element_positions ?? []).map(e =>
        `  ${e.name}[${e.type}] x=${e.x}% y=${e.y}% w=${e.w}% h=${e.h}% | align:${e.align} rot:${e.rotation_deg ?? 0}deg | z:${e.z_index ?? '?'} ${e.z_layer}${(e.overlaps_with ?? []).length ? ` | overlaps:${e.overlaps_with!.join(',')}` : ''}`
      ),
      ``,
      `-- Text Elements (${(dna.text_elements ?? []).length}) --`,
      ...(dna.text_elements ?? []).flatMap(t => {
        const bgPart = t.background_hex && t.background_hex !== 'none'
          ? ` bg:${t.background_hex}[${t.background_shape ?? 'rect'}${(t as any).background_rotation_deg ? ` rot:${(t as any).background_rotation_deg}deg` : ''}]`
          : '';
        const overlapPart = (t.overlaps_with ?? []).length ? ` | overlaps:${t.overlaps_with!.join(',')}` : '';
        const lines = [
          `[${t.role}] "${t.content_preview}" | pos: x=${t.x}% y=${t.y}% w=${t.w}% h=${t.h}% | z:${t.z_index ?? '?'} ${t.z_layer}${overlapPart}`,
          `  rotation:${t.rotation_deg ?? 0}deg | ${t.font_weight} ${t.estimated_size_px}px ${t.case_style} spacing:${t.letter_spacing} lh:${t.line_height}`,
          `  color:${t.color_hex}${bgPart} | lines:${t.line_count ?? 1}${t.decoration && t.decoration !== 'none' ? ` decoration:${t.decoration}` : ''} | opacity:${t.opacity ?? 1.0}`,
        ];
        if (t.word_highlights && t.word_highlights.length) {
          t.word_highlights.forEach(wh => {
            lines.push(`  word-highlight: "${wh.word_or_phrase}" bg:${wh.background_hex} shape:${wh.background_shape} rot:${wh.rotation_deg ?? 0}deg pad:${wh.padding_h_px ?? 0}h/${wh.padding_v_px ?? 0}v fullWidth:${wh.spans_line_width ?? false}`);
          });
        }
        return lines;
      }),
      ``,
      `-- Composite Effects (${(dna.composite_effects ?? []).length}) --`,
      ...(dna.composite_effects ?? []).map(ce =>
        `[${ce.type}] ${ce.description} | bottom:${ce.bottom_element} top:${ce.top_element} | overlap:x=${ce.overlap_region?.x}% y=${ce.overlap_region?.y}% w=${ce.overlap_region?.w}% h=${ce.overlap_region?.h}%`
      ),
      ``,
      `-- Scene Composition --`,
      ...(dna.scene_composition && dna.scene_composition.type !== 'none' ? [
        `Type: ${dna.scene_composition.type} | Theme: ${dna.scene_composition.theme}`,
        `Narrative: ${dna.scene_composition.narrative}`,
        `Characters: ${(dna.scene_composition.characters_present ?? []).join(', ') || 'none'}`,
        `Props: ${(dna.scene_composition.props_present ?? []).join(', ') || 'none'}`,
        `Region: x=${dna.scene_composition.scene_region?.x}% y=${dna.scene_composition.scene_region?.y}% w=${dna.scene_composition.scene_region?.w}% h=${dna.scene_composition.scene_region?.h}%`,
        ...(dna.scene_composition.element_relationships ?? []).map(r =>
          `  relation: ${r.element_a} [${r.relationship}] ${r.element_b}${r.notes ? ` -- ${r.notes}` : ''}`
        ),
      ] : [`Type: none`]),
      ``,
      `-- Decorative Illustrations (${(dna.decorative_illustrations ?? []).length}) --`,
      ...(dna.decorative_illustrations ?? []).flatMap(ill => [
        `[${ill.subject}] ${ill.subject_description}`,
        `  render:${ill.render_style} stroke:${ill.stroke_color ?? 'none'} fill:${ill.fill_color ?? 'none'} stroke-weight:${ill.stroke_width_style} opacity:${ill.opacity} role:${(ill as any).semantic_role} group:${(ill as any).scene_group ?? 'standalone'}`,
        ...ill.instances.map((inst, i) =>
          `  instance[${i + 1}/${ill.instances.length}] x=${inst.x}% y=${inst.y}% w=${inst.w}% h=${inst.h}% rot:${inst.rotation_deg ?? 0}deg size:${inst.size_relative}${(inst as any).interacts_with?.length ? ` interacts:${(inst as any).interacts_with.join(',')}` : ''}`
        ),
      ]),
      ``,
      `-- Photo Subjects (${(dna.photo_subjects ?? []).length}) --`,
      ...(dna.photo_subjects ?? []).map(ph =>
        `[${ph.subject_type}] treatment:${ph.treatment} | pos: x=${ph.x}% y=${ph.y}% w=${ph.w}% h=${ph.h}% | z:${ph.z_index ?? '?'} ${ph.z_layer}${(ph.overlaps_with ?? []).length ? ` | overlaps:${ph.overlaps_with!.join(',')}` : ''} | anchor:${ph.position_alignment}${ph.body_framing ? ` framing:${ph.body_framing}` : ''}${ph.description ? ` -- ${ph.description}` : ''}`
      ),
      ``,
      `-- Shape Elements (${(dna.shape_elements ?? []).length}) --`,
      ...(dna.shape_elements ?? []).map(s =>
        `${s.shape_type}${(s as any).clipped_at_edge ? '[clipped]' : ''} fill:${s.fill_type}(${s.fill_colors.join('->')}) opacity:${s.opacity} x:${s.x}% y:${s.y}% w:${s.w}% h:${s.h}%${s.gradient_angle != null ? ` angle:${s.gradient_angle}deg` : ''}${s.border_radius != null ? ` r:${s.border_radius}%` : ''} -- ${s.svg_hint}`
      ),
      ...(dna.pattern_notes ? [``, `Notes: ${dna.pattern_notes}`] : []),
      ``,
      `-- Design Patterns --`,
      ...this.buildPatternRules(dna).map((r, i) => `${i + 1}. ${r}`),
      ``,
      `DNA JSON: ${JSON.stringify(dna)}`,
    ].join('\n');
  }

  private buildEmbeddingText(dna: DesignDNA): string {
    return [
      dna.layout_type,
      dna.composition,
      dna.font_style,
      dna.icon_style,
      dna.illustration_style,
      dna.photography_style,
      dna.content_tone,
      ...dna.mood_keywords,
      dna.slide_type,
      ...dna.platform_fit,
      ...dna.visual_hierarchy,
      dna.whitespace,
      dna.background_style,
      dna.cta_style,
      dna.border_radius_style,
      ...(dna.decoration_elements ?? []),
      ...(dna.accent_elements ?? []),
    ].filter(Boolean).join(' ');
  }

  async reanalyzeSamples(brand: string, autoCluster = false): Promise<{ reanalyzed: number; failed: number }> {
    const rows = await this.db.db
      .select({
        id: knowledgeEntries.id,
        sourceUrl: knowledgeEntries.sourceUrl,
        siteKeys: knowledgeEntries.siteKeys,
      })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, brand),
      ));

    this.cancelledBrands.delete(brand);
    const status: ReanalysisStatus = { done: 0, total: rows.length, errors: 0, running: true, cancelled: false, failedIds: [], failedDetails: [] };
    this.reanalysisProgress.set(brand, status);
    this.persistStatus(brand, status);

    let reanalyzed = 0;
    let failed = 0;

    for (const row of rows) {
      if (this.cancelledBrands.has(brand)) {
        status.running = false;
        status.cancelled = true;
        this.persistStatus(brand, status);
        this.logger.log(`Reanalysis cancelled at ${reanalyzed + failed}/${rows.length} for brand=${brand}`);
        return { reanalyzed, failed };
      }
      const url = row.sourceUrl;
      if (!url) {
        failed++;
        status.errors = failed;
        status.done = reanalyzed + failed;
        status.failedIds.push(row.id);
        status.failedDetails.push({ id: row.id, reason: 'no sourceUrl' });
        this.logger.warn(`Skipping sample ${row.id}: no sourceUrl`);
        if (status.done % 10 === 0) this.persistStatus(brand, status);
        continue;
      }
      try {
        let buffer: Buffer;
        if (url.startsWith('local://')) {
          const localPath = url.slice('local://'.length);
          buffer = await fs.readFile(localPath);
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        }

        const imageBase64 = buffer.toString('base64');
        const llmRes = await this.llm.complete({
          messages: [{ role: 'user', content: DNA_PROMPT }],
          imageBase64,
          imageMimeType: 'image/png',
          maxTokens: await this.getDnaMaxTokens(),
          temperature: 0.1,
          agentKey: 'canva',
        });

        let dna: DesignDNA;
        try {
          const jsonMatch = llmRes.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? llmRes.content.match(/(\{[\s\S]+\})/);
          dna = JSON.parse(jsonMatch?.[1] ?? llmRes.content);
        } catch {
          const reason = 'LLM returned invalid JSON for design DNA';
          failed++;
          status.errors = failed;
          status.done = reanalyzed + failed;
          status.failedIds.push(row.id);
          status.failedDetails.push({ id: row.id, reason });
          this.logger.warn(`Failed to reanalyze sample ${row.id}: ${reason}`);
          if (status.done % 10 === 0) this.persistStatus(brand, status);
          continue;
        }

        const content = this.buildKbContent(dna);
        const title = `Design Sample — ${dna.slide_type} — ${dna.platform_fit[0] ?? 'any'} — ${row.id}`;

        await this.db.db.execute(sql`
          UPDATE knowledge_entries
          SET content = ${content}, title = ${title}, updated_at = NOW()
          WHERE id = ${row.id}
        `);

        void this.kb.embedEntry(row.id, this.buildEmbeddingText(dna));

        reanalyzed++;
        status.done = reanalyzed + failed;
        status.errors = failed;
        this.logger.log(`Reanalyzed ${reanalyzed}/${rows.length} — ${row.id}: ${dna.layout_type}`);
        if (status.done % 10 === 0) this.persistStatus(brand, status);
      } catch (err) {
        const reason = (err as Error).message;
        failed++;
        status.errors = failed;
        status.done = reanalyzed + failed;
        status.failedIds.push(row.id);
        status.failedDetails.push({ id: row.id, reason });
        this.logger.warn(`Failed to reanalyze sample ${row.id}: ${reason}`);
        if (status.done % 10 === 0) this.persistStatus(brand, status);
      }
    }

    status.running = false;
    status.cancelled = false;
    this.persistStatus(brand, status);
    this.logger.log(`Reanalysis complete: ${reanalyzed} reanalyzed, ${failed} failed for brand=${brand}`);

    if (autoCluster && reanalyzed > 0) {
      this.logger.log(`Auto-clustering patterns for brand=${brand}`);
      void this.designPattern.cluster(brand).catch(e =>
        this.logger.warn(`Auto-cluster failed: ${(e as Error).message}`),
      );
    }

    return { reanalyzed, failed };
  }

  async retryFailed(brand: string, autoCluster = false): Promise<{ queued: number }> {
    const [row] = await this.db.db
      .select({ failedIds: designReanalysisState.failedIds })
      .from(designReanalysisState)
      .where(eq(designReanalysisState.brand, brand))
      .limit(1)
      .catch(() => []);
    const stored = (row?.failedIds as FailedItem[] | string[] | null) ?? [];
    const ids: string[] = stored.length > 0 && typeof stored[0] === 'object'
      ? (stored as FailedItem[]).map(f => f.id)
      : (stored as string[]);
    if (!ids.length) return { queued: 0 };

    const rows = await this.db.db
      .select({ id: knowledgeEntries.id, sourceUrl: knowledgeEntries.sourceUrl })
      .from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.entryType, 'design_sample'),
        eq(knowledgeEntries.agentKeys, 'canva'),
        eq(knowledgeEntries.siteKeys, brand),
        sql`id = ANY(${ids}::text[])`,
      ));

    this.cancelledBrands.delete(brand);
    const status: ReanalysisStatus = { done: 0, total: rows.length, errors: 0, running: true, cancelled: false, failedIds: [], failedDetails: [] };
    this.reanalysisProgress.set(brand, status);
    this.persistStatus(brand, status);

    void (async () => {
      let reanalyzed = 0;
      let failed = 0;
      for (const row of rows) {
        if (this.cancelledBrands.has(brand)) {
          status.running = false; status.cancelled = true;
          this.persistStatus(brand, status);
          break;
        }
        try {
          let buffer: Buffer;
          if (!row.sourceUrl) throw new Error('no sourceUrl');
          if (row.sourceUrl.startsWith('local://')) {
            buffer = await fs.readFile(row.sourceUrl.slice('local://'.length));
          } else {
            const res = await fetch(row.sourceUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buffer = Buffer.from(await res.arrayBuffer());
          }
          const imageBase64 = buffer.toString('base64');
          const llmRes = await this.llm.complete({ messages: [{ role: 'user', content: DNA_PROMPT }], imageBase64, imageMimeType: 'image/png', maxTokens: await this.getDnaMaxTokens(), temperature: 0.1, agentKey: 'canva' });
          const jsonMatch = llmRes.content.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? llmRes.content.match(/(\{[\s\S]+\})/);
          const dna: DesignDNA = JSON.parse(jsonMatch?.[1] ?? llmRes.content);
          const content = this.buildKbContent(dna);
          const title = `Design Sample — ${dna.slide_type} — ${dna.platform_fit[0] ?? 'any'} — ${row.id}`;
          await this.db.db.execute(sql`UPDATE knowledge_entries SET content = ${content}, title = ${title}, updated_at = NOW() WHERE id = ${row.id}`);
          void this.kb.embedEntry(row.id, this.buildEmbeddingText(dna));
          reanalyzed++;
        } catch (err) {
          const reason = (err as Error).message;
          failed++;
          status.failedIds.push(row.id);
          status.failedDetails.push({ id: row.id, reason });
          this.logger.warn(`Retry failed for ${row.id}: ${reason}`);
        }
        status.done = reanalyzed + failed;
        status.errors = failed;
        if (status.done % 10 === 0) this.persistStatus(brand, status);
      }
      status.running = false;
      status.cancelled = false;
      this.persistStatus(brand, status);
      this.logger.log(`Retry complete: ${reanalyzed} reanalyzed, ${failed} still failed for brand=${brand}`);
      if (autoCluster && reanalyzed > 0) void this.designPattern.cluster(brand).catch(() => {});
    })();

    return { queued: rows.length };
  }
}
