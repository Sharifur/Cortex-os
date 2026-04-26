import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AgentsModule, AuthModule],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
