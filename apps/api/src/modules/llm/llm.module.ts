import { Module } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [LlmRouterService],
  exports: [LlmRouterService],
})
export class LlmModule {}
