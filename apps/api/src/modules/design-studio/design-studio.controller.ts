import {
  Controller, Post, Get, Delete, Body, Param, Req, Res, HttpCode, HttpStatus, HttpException, Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DesignStudioService } from './design-studio.service';

interface GenerateBody {
  prompt: string;
}

@Controller('design-studio')
export class DesignStudioController {
  private readonly logger = new Logger(DesignStudioController.name);

  constructor(private readonly service: DesignStudioService) {}

  // ─── Import ──────────────────────────────────────────────────────────────────

  @Post('import-batch')
  @HttpCode(HttpStatus.OK)
  async importBatch(@Req() req: FastifyRequest) {
    try {
      const items: { name: string; imageBase64: string; mimeType: string }[] = [];
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          const buf = await part.toBuffer();
          items.push({
            name: part.fieldname,
            imageBase64: buf.toString('base64'),
            mimeType: part.mimetype,
          });
        }
      }
      return await this.service.importBatch(items);
    } catch (err) {
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  @Get('jobs')
  async listJobs() {
    try {
      return await this.service.listJobs();
    } catch (err) {
      this.logger.error(`listJobs failed: ${(err as Error).message}`);
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  @Get('templates')
  async listTemplates() {
    try {
      return await this.service.listTemplates();
    } catch (err) {
      this.logger.error(`listTemplates failed: ${(err as Error).message}`);
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    try {
      return await this.service.getTemplate(id);
    } catch (err) {
      this.logger.error(`getTemplate(${id}) failed: ${(err as Error).message}`);
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string) {
    try {
      await this.service.deleteTemplate(id);
    } catch (err) {
      this.logger.error(`deleteTemplate(${id}) failed: ${(err as Error).message}`);
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  async previewTemplate(@Param('id') id: string, @Res() reply: FastifyReply) {
    try {
      const t = await this.service.getTemplate(id);
      const previewData: string = (t as any).previewData ?? '';
      if (!previewData) {
        throw new HttpException({ error: 'No preview available' }, HttpStatus.NOT_FOUND);
      }
      if (previewData.startsWith('http://') || previewData.startsWith('https://')) {
        // Proxy through API instead of redirecting — avoids browser CORS/access issues
        // with private R2 buckets or expired signed URLs
        const r2Res = await fetch(previewData);
        if (!r2Res.ok) {
          throw new HttpException({ error: 'Preview not accessible' }, HttpStatus.NOT_FOUND);
        }
        const bytes = Buffer.from(await r2Res.arrayBuffer());
        const ct = r2Res.headers.get('content-type') ?? 'image/png';
        void reply.header('Content-Type', ct).header('Cache-Control', 'public, max-age=86400').send(bytes);
        return;
      }
      if (!previewData.startsWith('data:')) {
        throw new HttpException({ error: 'No preview available' }, HttpStatus.NOT_FOUND);
      }
      const [header, b64] = previewData.split(',');
      const mimeMatch = header.match(/data:([^;]+);base64/);
      const mime = mimeMatch?.[1] ?? 'image/png';
      const buf = Buffer.from(b64, 'base64');
      void reply.header('Content-Type', mime).header('Cache-Control', 'public, max-age=86400').send(buf);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('templates/:id/generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Param('id') id: string,
    @Body() body: GenerateBody,
    @Res() reply: FastifyReply,
  ) {
    try {
      const png = await this.service.generate(id, body.prompt);
      void reply.header('Content-Type', 'image/png').send(png);
    } catch (err) {
      this.logger.error(`generate failed: ${(err as Error).message}`);
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('renders/:id')
  @HttpCode(HttpStatus.OK)
  async getRender(@Param('id') id: string, @Res() reply: FastifyReply) {
    try {
      const png = await this.service.getRender(id);
      void reply.header('Content-Type', 'image/png').header('Cache-Control', 'public, max-age=3600').send(png);
    } catch {
      throw new HttpException({ error: 'Render not found' }, HttpStatus.NOT_FOUND);
    }
  }
}
