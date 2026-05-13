import { Controller, Post, Get, Body, Param, Query, Delete, Res, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { FastifyReply } from 'fastify';
import { PostRendererService } from './post-renderer.service';
import { DesignAnalysisService } from './design-analysis.service';
import { DesignPatternService } from './design-pattern.service';
import { listFormats, getFormat } from './post-format.registry';
import type { RenderRequest } from './types';

@Controller('posts')
export class PostRenderController {
  private readonly logger = new Logger(PostRenderController.name);

  constructor(
    private readonly renderer: PostRendererService,
    private readonly designAnalysis: DesignAnalysisService,
    private readonly designPattern: DesignPatternService,
  ) {}

  // ─── Render ──────────────────────────────────────────────────────────────────

  @Post('render')
  @HttpCode(HttpStatus.OK)
  async render(@Body() body: RenderRequest) {
    return this.renderer.render(body);
  }

  @Get('renders')
  async listRenders(
    @Query('brand') brand?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      return await this.renderer.list({ brand, status, limit: limit ? parseInt(limit, 10) : undefined });
    } catch (err) {
      this.logger.error(`GET /posts/renders failed — brand=${brand ?? '-'} status=${status ?? '-'} limit=${limit ?? '-'}: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }

  @Get('renders/:id')
  async getRender(@Param('id') id: string) {
    const render = await this.renderer.getById(id);
    if (!render) return { error: 'not found' };
    return render;
  }

  @Post('renders/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string) {
    await this.renderer.updateStatus(id, 'approved');
    return { ok: true };
  }

  @Post('renders/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string) {
    await this.renderer.updateStatus(id, 'rejected');
    return { ok: true };
  }

  // ─── Local slide PNG (no R2 configured) ──────────────────────────────────────

  @Get('renders/:id/slides/:n/png')
  async serveLocalSlidePng(
    @Param('id') id: string,
    @Param('n') n: string,
    @Res() reply: FastifyReply,
  ) {
    const localFile = path.join(os.homedir(), 'Designs', 'AI-Agent', 'Renders', id, `slide-${n}.png`);
    try {
      const bytes = await fs.readFile(localFile);
      reply.header('Content-Type', 'image/png').send(bytes);
    } catch {
      reply.code(404).send({ error: 'slide not found locally' });
    }
  }

  // ─── Export: SVG (single slide) ───────────────────────────────────────────────

  @Get('renders/:id/slides/:n/svg')
  async exportSvg(
    @Param('id') id: string,
    @Param('n') n: string,
    @Res() reply: FastifyReply,
  ) {
    reply.header('Content-Type', 'image/svg+xml');
    reply.header('Content-Disposition', `attachment; filename="slide-${n}.svg"`);
    reply.send(`<!-- SVG export for render ${id} slide ${n} -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><text>Slide ${n}</text></svg>`);
  }

  // ─── Export: PPTX (full carousel) ────────────────────────────────────────────

  @Get('renders/:id/pptx')
  async exportPptx(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const render = await this.renderer.getById(id);
    if (!render) { reply.code(404).send({ error: 'not found' }); return; }

    const format = getFormat(render.formatId);
    if (!format) { reply.code(404).send({ error: 'format not found' }); return; }

    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();

    // Square layout (1080px → 10in at 108dpi)
    const isSquare = format.dimensions.width === format.dimensions.height;
    const isWide = format.dimensions.width > format.dimensions.height;
    const isStory = format.dimensions.height > format.dimensions.width;
    const layoutName = isSquare ? 'SQUARE' : isWide ? 'WIDE' : 'STORY';
    const w = 10;
    const h = isSquare ? 10 : isWide ? 10 * (format.dimensions.height / format.dimensions.width) : 10 * (format.dimensions.height / format.dimensions.width);
    pptx.defineLayout({ name: layoutName, width: w, height: h });
    pptx.layout = layoutName;

    const filledContent = render.filledContent as Record<string, Record<string, string | string[]>>;

    for (let i = 0; i < format.slides.length; i++) {
      const schema = format.slides[i];
      const slots = filledContent[`slide_${i}`] ?? {};
      const slide = pptx.addSlide();

      // Background
      const bgColor = schema.styleRules.backgroundVariant === 'dark' ? '111111' :
        schema.styleRules.backgroundVariant === 'white' ? 'ffffff' : '1e1b4b';
      slide.background = { fill: bgColor };

      // Headline
      const headline = slots['headline'] as string | undefined;
      if (headline) {
        slide.addText(headline, {
          x: 0.5, y: h * 0.3, w: w - 1, h: h * 0.25,
          fontSize: 28, bold: true,
          color: bgColor === '111111' ? 'ffffff' : '111111',
          align: 'left', fontFace: 'Arial',
        });
      }

      // Body
      const body = slots['body'] as string | undefined;
      if (body) {
        slide.addText(body, {
          x: 0.5, y: h * 0.55, w: w - 1, h: h * 0.25,
          fontSize: 14, color: bgColor === '111111' ? 'cccccc' : '444444',
          align: 'left', fontFace: 'Arial',
        });
      }

      // CTA
      const cta = slots['cta'] as string | undefined;
      if (cta) {
        slide.addText(cta, {
          x: 0.5, y: h * 0.82, w: w - 1, h: 0.5,
          fontSize: 14, bold: true, color: '6366f1',
          align: 'left', fontFace: 'Arial',
        });
      }

      // Stat number
      const statNumber = slots['stat_number'] as string | undefined;
      if (statNumber) {
        slide.addText(statNumber, {
          x: 0.5, y: h * 0.2, w: w * 0.4, h: h * 0.3,
          fontSize: 48, bold: true, color: 'ffffff', align: 'center', fontFace: 'Arial',
        });
      }

      // List items
      const listItems = slots['list_items'];
      if (listItems) {
        const items = Array.isArray(listItems) ? listItems : String(listItems).split('\n');
        items.forEach((item, j) => {
          slide.addText(`${j + 1}. ${item}`, {
            x: 0.5, y: h * 0.4 + j * 0.6, w: w - 1, h: 0.55,
            fontSize: 13, color: bgColor === '111111' ? 'dddddd' : '333333',
            align: 'left', fontFace: 'Arial',
          });
        });
      }
    }

    const buf = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    reply.header('Content-Disposition', `attachment; filename="render-${id}.pptx"`);
    reply.send(buf);
  }

  // ─── Export: Canva Bulk Create CSV ───────────────────────────────────────────

  @Get('renders/:id/canva-csv')
  async exportCanvaCsv(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const render = await this.renderer.getById(id);
    if (!render) { reply.code(404).send({ error: 'not found' }); return; }

    const format = getFormat(render.formatId);
    if (!format) { reply.code(404).send({ error: 'format not found' }); return; }

    const filledContent = render.filledContent as Record<string, Record<string, string | string[]>>;
    const headers = ['Slide', 'Role', 'Headline', 'Body', 'CTA', 'StatNumber', 'StatLabel', 'Quote'];
    const rows: string[][] = [headers];

    for (let i = 0; i < format.slides.length; i++) {
      const schema = format.slides[i];
      const slots = filledContent[`slide_${i}`] ?? {};
      const listItems = slots['list_items'];
      const listStr = Array.isArray(listItems) ? listItems.join(' | ') : (listItems as string | undefined) ?? '';
      rows.push([
        String(i + 1),
        schema.role,
        (slots['headline'] as string | undefined) ?? '',
        ((slots['body'] as string | undefined) ?? '') + (listStr ? ` [${listStr}]` : ''),
        (slots['cta'] as string | undefined) ?? '',
        (slots['stat_number'] as string | undefined) ?? '',
        (slots['stat_label'] as string | undefined) ?? '',
        (slots['quote'] as string | undefined) ?? '',
      ]);
    }

    const csvContent = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="render-${id}-canva.csv"`);
    reply.send(csvContent);
  }

  // ─── Export: Plain text ───────────────────────────────────────────────────────

  @Get('renders/:id/text-export')
  async exportText(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const render = await this.renderer.getById(id);
    if (!render) { reply.code(404).send({ error: 'not found' }); return; }

    const format = getFormat(render.formatId);
    if (!format) { reply.code(404).send({ error: 'format not found' }); return; }

    const filledContent = render.filledContent as Record<string, Record<string, string | string[]>>;
    const lines: string[] = [];

    for (let i = 0; i < format.slides.length; i++) {
      const schema = format.slides[i];
      const slots = filledContent[`slide_${i}`] ?? {};
      lines.push(`=== Slide ${i + 1} (${schema.role}) ===`);
      for (const [key, val] of Object.entries(slots)) {
        if (Array.isArray(val)) {
          lines.push(`${key}: ${val.join(' | ')}`);
        } else if (val) {
          lines.push(`${key}: ${val}`);
        }
      }
      lines.push('');
    }

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="render-${id}-text.txt"`);
    reply.send(lines.join('\n'));
  }

  // ─── Formats ─────────────────────────────────────────────────────────────────

  @Get('formats')
  listFormats() {
    return listFormats().map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      platform: f.platform,
      category: f.category,
      dimensions: f.dimensions,
      slideCount: f.slides.length,
    }));
  }

  @Get('formats/:id')
  getFormat(@Param('id') id: string) {
    const format = getFormat(id);
    if (!format) return { error: 'not found' };
    return format;
  }

  // ─── Design Samples ───────────────────────────────────────────────────────────

  @Get('design-samples')
  async listDesignSamples(
    @Query('brand') brand?: string,
    @Query('platform') platform?: string,
    @Query('slideType') slideType?: string,
  ) {
    return this.designAnalysis.listSamples({ brand, platform, slideType });
  }

  @Post('design-samples/cluster')
  @HttpCode(HttpStatus.OK)
  async clusterPatterns(@Body() body: { brand: string }) {
    void this.designPattern.cluster(body.brand ?? 'default').catch(e =>
      this.logger.error(`cluster failed: ${(e as Error).message}`),
    );
    return { ok: true, queued: true };
  }

  @Get('design-samples/cluster/status')
  getClusteringStatus(@Query('brand') brand?: string) {
    return this.designPattern.getClusteringStatus(brand ?? 'default');
  }

  @Get('design-samples/patterns')
  async getPatterns(@Query('brand') brand: string) {
    return this.designPattern.getPatterns(brand);
  }

  @Get('design-samples/banner-brief')
  async getBannerBrief(@Query('brand') brand: string) {
    return { bannerBrief: await this.designPattern.getBannerBrief(brand) };
  }

  @Post('design-samples/reanalyze')
  @HttpCode(HttpStatus.OK)
  async reanalyzeDesignSamples(@Body() body: { brand?: string; autoCluster?: boolean }) {
    const brand = body.brand ?? 'default';
    const total = await this.designAnalysis.countSamples(brand);
    void this.designAnalysis.reanalyzeSamples(brand, body.autoCluster ?? true).catch(e =>
      this.logger.error(`reanalyzeSamples failed: ${(e as Error).message}`),
    );
    return { ok: true, queued: total };
  }

  @Get('design-samples/reanalyze/status')
  getReanalysisStatus(@Query('brand') brand?: string) {
    return this.designAnalysis.getReanalysisStatus(brand ?? 'default');
  }


  @Post('design-samples/reanalyze/cancel')
  @HttpCode(HttpStatus.OK)
  cancelReanalysis(@Body() body: { brand?: string }) {
    this.designAnalysis.cancelReanalysis(body.brand ?? 'default');
    return { ok: true };
  }

  @Post('design-samples/reanalyze/retry')
  @HttpCode(HttpStatus.OK)
  async retryFailed(@Body() body: { brand?: string; autoCluster?: boolean }) {
    return this.designAnalysis.retryFailed(body.brand ?? 'default', body.autoCluster ?? true);
  }

  @Get('design-samples/:id')
  async getDesignSample(@Param('id') id: string) {
    const sample = await this.designAnalysis.getSampleById(id);
    if (!sample) throw new Error(`Sample ${id} not found`);
    return sample;
  }

  @Post('design-samples/:id/reanalyze')
  @HttpCode(HttpStatus.OK)
  async reanalyzeSingleSample(@Param('id') id: string) {
    return this.designAnalysis.reanalyzeSingleById(id);
  }

  @Delete('design-samples/patterns/all')
  @HttpCode(HttpStatus.OK)
  async clearAllPatterns(@Query('brand') brand?: string) {
    return this.designPattern.clearPatterns(brand ?? 'default');
  }

  @Post('design-samples/patterns/remove')
  @HttpCode(HttpStatus.OK)
  async removePatternItem(@Body() body: { pattern: string; brand?: string }) {
    if (!body.pattern) throw new Error('pattern is required');
    return this.designPattern.removePatternItem(body.pattern, body.brand ?? 'default');
  }

  @Delete('design-samples/:id')
  async deleteDesignSample(@Param('id') id: string) {
    return { ok: true, message: 'Delete via KB entries DELETE endpoint' };
  }
}
