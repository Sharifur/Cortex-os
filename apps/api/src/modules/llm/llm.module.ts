import { Module } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';
import { LlmUsageService } from './llm-usage.service';
import { LlmUsageController } from './llm-usage.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [LlmUsageController],
  providers: [LlmRouterService, LlmUsageService],
  exports: [LlmRouterService, LlmUsageService],
})
export class LlmModule {}
