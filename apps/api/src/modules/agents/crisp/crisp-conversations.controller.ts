import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CrispService } from './crisp.service';

@Controller('crisp/conversations')
@UseGuards(JwtAuthGuard)
export class CrispConversationsController {
  constructor(private crisp: CrispService) {}

  @Get()
  list(
    @Query('followUp') followUp?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crisp.listConversations({
      followUp: followUp === 'true' || followUp === '1' ? true : undefined,
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':sessionId')
  async get(@Param('sessionId') sessionId: string) {
    const row = await this.crisp.getConversationBySession(sessionId);
    if (!row) throw new NotFoundException(`Crisp conversation not found: ${sessionId}`);
    return row;
  }

  @Patch(':sessionId/follow-up')
  setFollowUp(
    @Param('sessionId') sessionId: string,
    @Body() body: { followUp: boolean; note?: string | null; dueAt?: string | null },
  ) {
    return this.crisp.setFollowUp(sessionId, body);
  }
}
