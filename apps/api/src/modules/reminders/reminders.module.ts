import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RemindersService } from './reminders.service';

@Module({
  imports: [LlmModule],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
