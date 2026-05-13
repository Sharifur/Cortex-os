import { Controller, Post, Param, Req, Res, BadRequestException, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { StorageService } from '../../storage/storage.service';
import { CanvaBrandsService } from './canva-brands.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

interface MultipartFile {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
}

interface MultipartRequest {
  isMultipart?: () => boolean;
  file?: () => Promise<MultipartFile>;
}

@Controller('canva/brands')
export class CanvaBrandsController {
  constructor(
    private readonly brands: CanvaBrandsService,
    private readonly storage: StorageService,
  ) {}

  @Post(':name/logo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async uploadLogo(
    @Param('name') name: string,
    @Req() req: MultipartRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('multipart/form-data required');
    }
    if (!req.file) {
      throw new BadRequestException('no file provided');
    }

    const part = await req.file();
    if (!part.mimetype.startsWith('image/')) {
      throw new BadRequestException('only image files are allowed');
    }

    const buffer = await part.toBuffer();
    const stored = await this.storage.upload({
      body: buffer,
      originalFilename: part.filename,
      declaredMime: part.mimetype,
      module: 'canva/logos',
      refKey: name,
    });

    await this.brands.upsert({ name, displayName: name, logoUrl: stored.url });

    reply.send({ logoUrl: stored.url });
  }
}
