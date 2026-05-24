import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { RequestLogService } from '../debug-logs/request-log.service';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly db: DbService,
    private readonly requestLogs: RequestLogService,
  ) {}

  @Get('open/:token')
  async trackOpen(
    @Param('token') rawToken: string,
    @Req() req: { ip?: string; socket?: { remoteAddress?: string }; headers?: Record<string, string> },
    @Res() res: FastifyReply,
  ) {
    const token = rawToken.replace(/\.gif$/, '');
    const now = new Date();

    try {
      // Fetch sent_at to apply a 5-minute grace period.
      // Pixel fires within 5 min of send are Gmail pre-fetch or sender self-view — skip counting.
      const emailRow = await this.db.db.execute(sql`
        SELECT sent_at FROM taskip_internal_emails WHERE id = ${token} LIMIT 1
      `).then(r => (r as unknown[])[0] as { sent_at: string | Date } | undefined).catch(() => undefined);

      const sentAt = emailRow?.sent_at ? new Date(emailRow.sent_at) : null;
      const ageMs = sentAt ? now.getTime() - sentAt.getTime() : Infinity;
      const GRACE_MS = 5 * 60 * 1000; // 5 minutes

      if (ageMs < GRACE_MS) {
        this.logger.log(`tracking pixel for ${token} within grace period (${Math.round(ageMs / 1000)}s after send) — skipped`);
      } else {
        const result = await this.db.db.execute(sql`
          UPDATE taskip_internal_emails
          SET open_count    = COALESCE(open_count, 0) + 1,
              first_open_at = COALESCE(first_open_at, ${now.toISOString()}),
              last_open_at  = ${now.toISOString()}
          WHERE id = ${token}
        `);
        const rowCount = (result as unknown as { rowCount?: number }).rowCount ?? 0;
        if (rowCount === 0) {
          this.logger.warn(`tracking pixel fired but no email matched id ${token}`);
          void this.requestLogs.record({
            method: 'GET',
            path: `/track/open/${token}`,
            statusCode: 200,
            errorMessage: `tracking pixel fired but no email matched id ${token}`,
          });
        }
      }
    } catch (err) {
      const message = (err as Error).message;
      // open_count / first_open_at / last_open_at columns absent — fall back to metadata JSONB
      await this.db.db.execute(sql`
        UPDATE taskip_internal_emails
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                       || jsonb_build_object('pixelOpened', true, 'pixelOpenedAt', ${now.toISOString()})
        WHERE id = ${token}
      `).catch((err2: unknown) => {
        const fallbackMessage = (err2 as Error).message;
        this.logger.error(`tracking fallback also failed for id ${token}: ${fallbackMessage}`);
        void this.requestLogs.record({
          method: 'GET',
          path: `/track/open/${token}`,
          statusCode: 500,
          errorMessage: `primary: ${message} | fallback: ${fallbackMessage}`,
        });
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
