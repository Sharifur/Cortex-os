import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { taskipInternalEmails } from '../../db/schema';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

interface OpenEvent {
  at: string;
  ip: string;
  ua: string;
}

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
    const ip = (req.ip ?? req.socket?.remoteAddress ?? '').toString();
    const ua = (req.headers?.['user-agent'] ?? '').toString().slice(0, 200);
    const at = new Date().toISOString();

    try {
      const [row] = await this.db.db
        .select({
          id: taskipInternalEmails.id,
          openCount: taskipInternalEmails.openCount,
          firstOpenAt: taskipInternalEmails.firstOpenAt,
          openEvents: taskipInternalEmails.openEvents,
        })
        .from(taskipInternalEmails)
        .where(eq(taskipInternalEmails.trackingToken, token))
        .limit(1);

      if (row) {
        const existingEvents = (row.openEvents as OpenEvent[] | null) ?? [];
        const updatedEvents: OpenEvent[] = [...existingEvents, { at, ip, ua }];

        await this.db.db
          .update(taskipInternalEmails)
          .set({
            openCount: sql`${taskipInternalEmails.openCount} + 1`,
            firstOpenAt: row.firstOpenAt ?? new Date(),
            lastOpenAt: new Date(),
            openEvents: updatedEvents,
          })
          .where(eq(taskipInternalEmails.trackingToken, token));
      }
    } catch {
      // open tracking must never error-out — silently continue
    }

    res.header('Content-Type', 'image/gif');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.header('Pragma', 'no-cache');
    res.send(TRANSPARENT_GIF);
  }
}
