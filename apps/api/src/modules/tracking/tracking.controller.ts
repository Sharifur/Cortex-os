import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

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
      const result = await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET open_count    = COALESCE(open_count, 0) + 1,
            first_open_at = COALESCE(first_open_at, ${now}),
            last_open_at  = ${now}
        WHERE tracking_token = ${token}
      `);
      const rowCount = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      if (rowCount === 0) {
        this.logger.warn(`tracking pixel fired but no email matched token ${token}`);
      } else {
        this.logger.log(`open recorded for token ${token}`);
      }
    } catch {
      // migration 0063 columns absent — fall back to metadata JSONB
      await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                       || jsonb_build_object('pixelOpened', true, 'pixelOpenedAt', ${now.toISOString()})
        WHERE tracking_token = ${token}
      `).catch((err: unknown) => {
        this.logger.error(`tracking fallback also failed for token ${token}: ${(err as Error).message}`);
      });
    }

    // Allow any origin — email client proxies (Gmail, Apple, Outlook) load pixels
    // as server-to-server requests with varying or absent Origin headers.
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'image/gif');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.header('Pragma', 'no-cache');
    res.send(TRANSPARENT_GIF);
  }
}
