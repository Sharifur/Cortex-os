import { Controller, Post, Get, Req, Res, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DesignAnalysisService } from './design-analysis.service';

interface MultipartFile {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}

interface MultipartRequest {
  isMultipart?: () => boolean;
  file?: () => Promise<MultipartFile>;
  files?: () => AsyncIterableIterator<MultipartFile>;
  [key: string]: unknown;
}

@Controller('posts/design-samples')
export class DesignSampleController {
  constructor(private readonly analysis: DesignAnalysisService) {}

  @Post('upload-carousel')
  @HttpCode(HttpStatus.OK)
  async uploadCarousel(
    @Req() req: MultipartRequest,
    @Res() reply: FastifyReply,
    @Query('brand') brand = 'default',
  ) {
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('multipart/form-data required');
    }

    const slides: Array<{ buffer: Buffer; filename: string }> = [];

    if (req.files) {
      for await (const part of req.files()) {
        if (!part.mimetype.startsWith('image/')) continue;
        slides.push({ buffer: await part.toBuffer(), filename: part.filename });
      }
    }

    if (slides.length < 2) {
      throw new BadRequestException('A carousel requires at least 2 slide images');
    }

    const result = await this.analysis.analyzeAndStoreCarousel(slides, { brand });
    reply.send({ uploaded: slides.length, ...result });
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  async upload(
    @Req() req: MultipartRequest,
    @Res() reply: FastifyReply,
    @Query('brand') brand = 'default',
  ) {
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('multipart/form-data required');
    }

    const results: Array<{ filename: string; dna: unknown; kbEntryId: string; storageUrl: string }> = [];

    if (req.files) {
      for await (const part of req.files()) {
        if (!part.mimetype.startsWith('image/')) continue;
        const buffer = await part.toBuffer();
        const { dna, kbEntryId, storageUrl } = await this.analysis.analyzeAndStore(buffer, {
          brand,
          filename: part.filename,
        });
        results.push({ filename: part.filename, dna, kbEntryId, storageUrl });
      }
    } else if (req.file) {
      const part = await req.file();
      if (!part.mimetype.startsWith('image/')) {
        throw new BadRequestException('only image files are allowed');
      }
      const buffer = await part.toBuffer();
      const { dna, kbEntryId, storageUrl } = await this.analysis.analyzeAndStore(buffer, {
        brand,
        filename: part.filename,
      });
      results.push({ filename: part.filename, dna, kbEntryId, storageUrl });
    } else {
      throw new BadRequestException('no files provided');
    }

    reply.send({ uploaded: results.length, results });
  }
}
