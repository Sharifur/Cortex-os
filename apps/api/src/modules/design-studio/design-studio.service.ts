import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { DbService } from '../../db/db.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { designStudioTemplates, DesignSpec, TemplateParameter, SpecElement } from './schema';

@Injectable()
export class DesignStudioService {
  private readonly logger = new Logger(DesignStudioService.name);

  constructor(
    private readonly db: DbService,
    private readonly llm: LlmRouterService,
  ) {}

  // ─── Import ──────────────────────────────────────────────────────────────────

  async importFromImage(name: string, imageBase64: string, mimeType = 'image/png') {
    const systemPrompt = `You are a design analysis AI. Analyze the provided image and extract it as a structured Satori-compatible design spec.

Output ONLY valid JSON with this exact structure:
{
  "parameters": [
    { "key": "string", "type": "text|color|number|lines", "description": "what this field represents", "example": <value> }
  ],
  "spec": {
    "width": <number>,
    "height": <number>,
    "root": <SpecElement>
  }
}

SpecElement schema:
{
  "type": "div" | "span" | "img",
  "style": { <CSS property in camelCase>: <value> },
  "text": "static text or {{paramKey}} for dynamic",
  "src": "for img elements only",
  "children": [ <SpecElement>... ]
}

Rules:
- Use display:flex for ALL layout (no grid, no block, no inline)
- All sizes in px numbers (not strings)
- Colors as hex strings
- Dynamic text/color values use {{paramKey}} syntax matching a parameter key
- The root element must fill 100% width and height: style.width="100%" style.height="100%"
- Estimate px sizes from the visual proportions
- Identify every piece of text and color that would change per-generation as a parameter
- Fixed decorative colors can be hardcoded directly in style
- Only output JSON — no markdown, no explanation`;

    const userPrompt = `Analyze this design image and extract the complete design spec. Identify all dynamic text fields and colors as parameters.`;

    const res = await this.llm.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      imageBase64,
      imageMimeType: mimeType,
      maxTokens: 4000,
      agentKey: 'design-studio',
    });

    let extracted: { parameters: TemplateParameter[]; spec: DesignSpec };
    try {
      const raw = res.content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      extracted = JSON.parse(raw) as { parameters: TemplateParameter[]; spec: DesignSpec };
    } catch {
      this.logger.error(`Failed to parse LLM spec output: ${res.content.slice(0, 500)}`);
      throw new Error('AI could not extract a valid spec from the image. Try a cleaner screenshot.');
    }

    const [row] = await this.db.db
      .insert(designStudioTemplates)
      .values({
        id: createId(),
        name,
        previewData: `data:${mimeType};base64,${imageBase64}`,
        parameters: extracted.parameters,
        spec: extracted.spec,
      })
      .returning();

    return row;
  }

  // ─── Generate ────────────────────────────────────────────────────────────────

  async generate(id: string, prompt: string): Promise<Buffer> {
    const [template] = await this.db.db
      .select()
      .from(designStudioTemplates)
      .where(eq(designStudioTemplates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${id} not found`);

    // Step 1: fill parameter values from user prompt
    const paramSchema = JSON.stringify(template.parameters, null, 2);
    const fillRes = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: `You fill design template parameters from a user's chat request.
Given the parameter schema below, return a JSON object mapping each parameter key to its value.
Only return valid JSON — no markdown, no explanation.

Parameter schema:
${paramSchema}`,
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      agentKey: 'design-studio',
    });

    let values: Record<string, unknown>;
    try {
      const raw = fillRes.content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      values = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('AI could not extract parameter values from your prompt. Be more specific.');
    }

    // Step 2: resolve spec → Satori element tree
    const resolved = this.resolveSpec(template.spec.root, values);

    // Step 3: render
    return this.renderElement(resolved, template.spec.width, template.spec.height);
  }

  // ─── Spec resolver ───────────────────────────────────────────────────────────

  private resolveValue(val: unknown, params: Record<string, unknown>): unknown {
    if (typeof val !== 'string') return val;
    if (val.startsWith('{{') && val.endsWith('}}')) {
      const key = val.slice(2, -2).trim();
      return params[key] ?? val;
    }
    return val;
  }

  private resolveStyle(
    style: Record<string, string | number> | undefined,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!style) return {};
    return Object.fromEntries(
      Object.entries(style).map(([k, v]) => [k, this.resolveValue(v, params)]),
    );
  }

  private resolveSpec(node: SpecElement, params: Record<string, unknown>): object {
    const style = this.resolveStyle(node.style, params);

    if (node.type === 'img') {
      return {
        type: 'img',
        props: {
          src: this.resolveValue(node.src, params) ?? '',
          style,
        },
      };
    }

    const children: unknown = node.text !== undefined
      ? this.resolveValue(node.text, params)
      : node.children?.map(c => this.resolveSpec(c, params));

    return {
      type: node.type,
      props: { style, children },
    };
  }

  // ─── Satori render ───────────────────────────────────────────────────────────

  private async renderElement(tree: object, width: number, height: number): Promise<Buffer> {
    const satori = (await import('satori')).default;
    const { Resvg } = await import('@resvg/resvg-js');
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const fontPaths = [
      join(process.cwd(), 'fonts', 'Inter-Regular.ttf'),
      join(process.cwd(), 'fonts', 'Inter-Bold.ttf'),
      join(__dirname, '../../../../fonts/Inter-Regular.ttf'),
      join(__dirname, '../../../../fonts/Inter-Bold.ttf'),
    ];

    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }> = [];
    const regularPath = fontPaths.find(p => existsSync(p) && p.includes('Regular'));
    const boldPath = fontPaths.find(p => existsSync(p) && p.includes('Bold'));

    if (regularPath) fonts.push({ name: 'Inter', data: readFileSync(regularPath).buffer, weight: 400, style: 'normal' });
    if (boldPath) fonts.push({ name: 'Inter', data: readFileSync(boldPath).buffer, weight: 700, style: 'normal' });

    if (fonts.length === 0) {
      this.logger.warn('No Inter fonts found — Satori will use fallback');
    }

    const svg = await satori(tree as Parameters<typeof satori>[0], { width, height, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
    return Buffer.from(resvg.render().asPng());
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async list() {
    return this.db.db
      .select({
        id: designStudioTemplates.id,
        name: designStudioTemplates.name,
        previewData: designStudioTemplates.previewData,
        parameters: designStudioTemplates.parameters,
        createdAt: designStudioTemplates.createdAt,
      })
      .from(designStudioTemplates)
      .orderBy(sql`created_at DESC`);
  }

  async getOne(id: string) {
    const [row] = await this.db.db
      .select()
      .from(designStudioTemplates)
      .where(eq(designStudioTemplates.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`Template ${id} not found`);
    return row;
  }

  async delete(id: string) {
    await this.db.db.delete(designStudioTemplates).where(eq(designStudioTemplates.id, id));
  }
}
