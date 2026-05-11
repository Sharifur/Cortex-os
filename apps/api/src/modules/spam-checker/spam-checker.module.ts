import { Module } from '@nestjs/common';
import { SpamCheckerService } from './spam-checker.service';
import { SpamCheckerController } from './spam-checker.controller';

@Module({
  controllers: [SpamCheckerController],
  providers: [SpamCheckerService],
  exports: [SpamCheckerService],
})
export class SpamCheckerModule {}
