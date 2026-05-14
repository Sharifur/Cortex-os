import {
  Controller, Post, Get, Delete, Body, Param, Res, HttpCode, HttpStatus, HttpException, Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DesignStudioService } from './design-studio.service';

interface ImportBody {
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

  @Post('templates/import')
  @HttpCode(HttpStatus.OK)
  async importTemplate(@Body() body: ImportBody) {
    try {
      return await this.service.importFromImage(body.name, body.imageBase64, body.mimeType);
    } catch (err) {
      throw new HttpException({ error: (err as Error).message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates')
  async listTemplates() {
    return this.service.list();
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string) {
    await this.service.delete(id);
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
