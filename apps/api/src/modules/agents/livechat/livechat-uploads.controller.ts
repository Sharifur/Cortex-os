import {
  Controller,
  Post,
  Req,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LivechatService } from './livechat.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { LivechatRateLimitService } from './livechat-rate-limit.service';

interface CollectedUpload {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  fields: Record<string, string>;
}

async function collectUpload(req: FastifyRequest): Promise<CollectedUpload> {
  // @fastify/multipart augments FastifyRequest at runtime; types resolve to the
  // package's Multipart union but our access pattern is duck-typed and safe.
  const r = req as unknown as {
    isMultipart?: () => boolean;
    parts: () => AsyncIterableIterator<Record<string, unknown>>;
  };
  if (!r.isMultipart || !r.isMultipart()) throw new BadRequestException('multipart/form-data required');

  let buffer: Buffer | null = null;
  let filename = '';
  let mimetype = '';
  const fields: Record<string, string> = {};

  for await (const partRaw of r.parts()) {
    const part = partRaw as {
      type?: 'file' | 'field';
      fieldname?: string;
      filename?: string;
      mimetype?: string;
      value?: unknown;
      toBuffer?: () => Promise<Buffer>;
    };
    if (part.type === 'file' && typeof part.toBuffer === 'function') {
      buffer = await part.toBuffer();
      filename = part.filename ?? 'file';
      mimetype = part.mimetype ?? 'application/octet-stream';
    } else if (part.type === 'field' && part.fieldname) {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }

  if (!buffer) throw new BadRequestException('file is required');
  return { buffer, filename, mimetype, fields };
}

@Controller()
export class LivechatUploadsController {
  constructor(
    private livechat: LivechatService,
    private attachments: LivechatAttachmentsService,
    private rateLimit: LivechatRateLimitService,
  ) {}

  /** Visitor upload — origin-gated, rate-limited, must reference an existing session. */
  @Post('livechat/upload')
  async visitorUpload(@Req() req: FastifyRequest) {
    const upload = await collectUpload(req);
    const { siteKey, visitorId, sessionId } = upload.fields;
    if (!siteKey || !visitorId || !sessionId) throw new BadRequestException('siteKey, visitorId and sessionId fields are required');

    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(siteKey, origin ?? null);
    await this.rateLimit.check('upload', `${site.key}:${visitorId}`, 10);

    const session = await this.livechat.getSession(sessionId);
    if (!session || session.siteId !== site.id || session.visitorId !== visitorId) {
      throw new ForbiddenException('Session does not belong to this visitor');
    }

    return this.attachments.upload({
      siteKey: site.key,
      sessionId,
      uploaderRole: 'visitor',
      uploaderId: visitorId,
      body: upload.buffer,
      mimeType: upload.mimetype,
      originalFilename: upload.filename,
    });
  }

  /** Operator upload — JWT-gated, must reference an existing session. */
  @Post('agents/livechat/sessions/:id/upload')
  @UseGuards(JwtAuthGuard)
  async operatorUpload(@Req() req: FastifyRequest, @Param('id') sessionId: string) {
    const upload = await collectUpload(req);
    const session = await this.livechat.getSession(sessionId);
    if (!session) throw new BadRequestException('session not found');
    const site = await this.livechat.getSiteById(session.siteId);
    const userId = (req as FastifyRequest & { user?: { sub?: string } }).user?.sub ?? null;

    return this.attachments.upload({
      siteKey: site.key,
      sessionId,
      uploaderRole: 'operator',
      uploaderId: userId,
      body: upload.buffer,
      mimeType: upload.mimetype,
      originalFilename: upload.filename,
    });
  }
}
