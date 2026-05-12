import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, like } from 'drizzle-orm';
import { LlmRouterService } from '../llm/llm-router.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { StorageService } from '../storage/storage.service';
import { DbService } from '../../db/db.service';
import { knowledgeEntries } from '../knowledge-base/schema';
import type { DesignDNA } from './types';

const LOCAL_SAMPLES_DIR = path.join(os.homedir(), 'Designs', 'AI-Agent', 'DesignSamples');

const DNA_PROMPT = `You are a design analyst. Extract the design DNA from this image and return ONLY valid JSON.

JSON schema (respond with exactly this structure, no extra keys):
{
  "layout_type": "centered|left-aligned|split-panel|overlay|grid",
  "background_style": "solid-light|solid-dark|gradient-dark|gradient-light|textured",
  "primary_color": "#hexcode",
  "accent_color": "#hexcode",
  "font_weight_heading": "bold|black|semibold|regular",
  "font_size_heading": "large|xlarge|huge",
  "font_style": "modern-sans|classic-serif|geometric|rounded",
  "element_density": "minimal|moderate|rich",
  "visual_hierarchy": ["array", "of", "elements", "top-to-bottom"],
  "composition": "rule-of-thirds|center-weighted|edge-anchored|full-bleed",
  "text_alignment": "left|center|right",
  "accent_elements": ["top-bar", "circle", "underline", "badge", "none"],
  "whitespace": "generous|moderate|tight",
  "mood_keywords": ["professional", "bold", "friendly", "premium", "playful"],
  "platform_fit": ["linkedin", "instagram", "twitter", "facebook"],
  "slide_type": "cover|content|cta|quote|stat|list",
  "background_image_used": false
}`;

@Injectable()
export class DesignAnalysisService {
  private readonly logger = new Logger(DesignAnalysisService.name);

  constructor(
    private readonly llm: LlmRouterService,
    private readonly kb: KnowledgeBaseService,
    private readonly storage: StorageService,
    private readonly db: DbService,
  ) {}

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
      maxTokens: 600,
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
    const embeddingText = [
      dna.layout_type,
      ...dna.mood_keywords,
      dna.slide_type,
      ...dna.platform_fit,
      ...dna.visual_hierarchy,
      dna.font_style,
      dna.whitespace,
    ].join(' ');

    const content = [
      `Design Sample Analysis`,
      `Layout: ${dna.layout_type}`,
      `Background: ${dna.background_style}`,
      `Colors: primary ${dna.primary_color}, accent ${dna.accent_color}`,
      `Typography: ${dna.font_weight_heading} ${dna.font_size_heading} ${dna.font_style}`,
      `Hierarchy: ${dna.visual_hierarchy.join(' > ')}`,
      `Composition: ${dna.composition}, alignment: ${dna.text_alignment}`,
      `Whitespace: ${dna.whitespace}, density: ${dna.element_density}`,
      `Mood: ${dna.mood_keywords.join(', ')}`,
      `Platform: ${dna.platform_fit.join(', ')}`,
      `Slide type: ${dna.slide_type}`,
      `Accent elements: ${dna.accent_elements.join(', ')}`,
      ``,
      `DNA JSON: ${JSON.stringify(dna)}`,
    ].join('\n');

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
      .orderBy(knowledgeEntries.createdAt)
      .limit(200);
  }
}
