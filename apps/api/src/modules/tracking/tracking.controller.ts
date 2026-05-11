import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('track')
export class TrackingController {
  constructor(private readonly db: DbService) {}

  @Get('open/:token')
  async trackOpen(
    @Param('token') rawToken: string,
    @Req() req: { ip?: string; socket?: { remoteAddress?: string }; headers?: Record<string, string> },
    @Res() res: FastifyReply,
  ) {
    const token = rawToken.replace(/\.gif$/, '');
    const now = new Date();

    try {
      // Try dedicated columns (migration 0063+)
      await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET open_count    = COALESCE(open_count, 0) + 1,
            first_open_at = COALESCE(first_open_at, ${now}),
            last_open_at  = ${now}
        WHERE tracking_token = ${token}
      `);
    } catch {
      // migration 0063 not yet applied — fall back to metadata JSONB
      await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                       || jsonb_build_object('pixelOpened', true, 'pixelOpenedAt', ${now.toISOString()})
        WHERE tracking_token = ${token}
      `).catch(() => {});
    }

    res.header('Content-Type', 'image/gif');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.header('Pragma', 'no-cache');
    res.send(TRANSPARENT_GIF);
  }
}
