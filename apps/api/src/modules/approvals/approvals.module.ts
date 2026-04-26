import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
