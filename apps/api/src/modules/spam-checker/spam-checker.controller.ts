import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SpamCheckerService, SpamCheckInput } from './spam-checker.service';

@Controller('spam-checker')
@UseGuards(JwtAuthGuard)
export class SpamCheckerController {
  constructor(private readonly spamChecker: SpamCheckerService) {}

  /**
   * POST /spam-checker/score
   * Full pre-send scoring: content + DNS auth + reputation + hygiene + compliance.
   */
  @Post('score')
  async score(@Body() body: SpamCheckInput) {
    return this.spamChecker.score(body);
  }

  /**
   * GET /spam-checker/audit/domain?domain=trytaskip.com
   * Domain-only audit: SPF, DKIM, DMARC, blocklist status.
   */
  @Get('audit/domain')
  async auditDomain(@Query('domain') domain: string) {
    if (!domain?.trim()) return { error: 'domain query parameter is required' };
    return this.spamChecker.auditDomain(domain.trim().toLowerCase());
  }
}
