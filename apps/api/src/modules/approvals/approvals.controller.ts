import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApprovalService } from '../agents/runtime/approval.service';
import { FollowupDto } from './dto/followup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private approvals: ApprovalService) {}

  @Get()
  getPending() {
    return this.approvals.getPending();
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string) {
    return this.approvals.approve(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string) {
    return this.approvals.reject(id);
  }

  @Post(':id/followup')
  @HttpCode(200)
  followup(@Param('id') id: string, @Body() dto: FollowupDto) {
    return this.approvals.followup(id, dto.instruction);
  }
}
