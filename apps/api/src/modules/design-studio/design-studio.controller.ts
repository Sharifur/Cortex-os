import {
  Controller, Post, Get, Delete, Body, Param, Res, HttpCode, HttpStatus, HttpException, Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DesignStudioService } from './design-studio.service';

interface BatchImportItem {
  name: string;
  imageBase64: string;
  mimeType?: string;
}

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
  async importBatch(@Body() body: { items: BatchImportItem[] }) {
    try {
      return await this.service.importBatch(body.items ?? []);
    } catch (err) {
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  @Get('jobs')
  async listJobs() {
    return this.service.listJobs();
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  @Get('templates')
  async listTemplates() {
    return this.service.listTemplates();
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string) {
    await this.service.deleteTemplate(id);
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
}
