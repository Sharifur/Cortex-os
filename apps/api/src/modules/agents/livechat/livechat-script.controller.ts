import { Controller, Get, Res, NotFoundException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';

@Controller()
export class LivechatScriptController {
  private cached: { body: string; mtimeMs: number } | null = null;

  @Get('livechat.js')
  async serve(@Res() res: FastifyReply) {
    const filePath = await this.resolveBundle();
    if (!filePath) throw new NotFoundException('livechat.js bundle is not built. Run: npm --workspace=apps/web run build:widget');

    let body: string;
    try {
      const stat = await fs.stat(filePath);
      if (this.cached && this.cached.mtimeMs === stat.mtimeMs) {
        body = this.cached.body;
      } else {
        body = await fs.readFile(filePath, 'utf8');
        this.cached = { body, mtimeMs: stat.mtimeMs };
      }
    } catch {
      throw new NotFoundException('livechat.js bundle not found');
    }

    res
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .header('Access-Control-Allow-Origin', '*')
      .send(body);
  }

  private async resolveBundle(): Promise<string | null> {
    const candidates = [
      process.env.LIVECHAT_BUNDLE_PATH,
      path.resolve(process.cwd(), 'public', 'livechat.js'),
      path.resolve(__dirname, '..', '..', '..', '..', 'public', 'livechat.js'),
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'public', 'livechat.js'),
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
      try {
        await fs.access(p);
        return p;
      } catch {
        continue;
      }
    }
    return null;
  }
}
