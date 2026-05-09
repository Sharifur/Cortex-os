import { Body, Controller, Delete, Get, Param, Post, UseGuards, HttpCode } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { emailSuppressions } from './ses-suppressions.schema';
import { SesService } from './ses.service';

@Controller('ses/suppressions')
@UseGuards(JwtAuthGuard)
export class SesSupressionsController {
  constructor(
    private readonly db: DbService,
    private readonly ses: SesService,
  ) {}

  @Get()
  async list() {
    return this.db.db
      .select()
      .from(emailSuppressions)
      .orderBy(desc(emailSuppressions.createdAt));
  }

  @Post()
  @HttpCode(201)
  async add(@Body() body: { email: string; reason?: string }) {
    const email = (body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Invalid email address' };
    }
    await this.ses.suppress(email, body.reason?.trim() || 'manual', 'manual');
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string) {
    await this.db.db
      .delete(emailSuppressions)
      .where(eq(emailSuppressions.id, id));
    return { ok: true };
  }
}
