import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DesignStudioService } from './design-studio.service';
import { DesignStudioController } from './design-studio.controller';

@Module({
  imports: [LlmModule],
  controllers: [DesignStudioController],
  providers: [DesignStudioService],
})
export class DesignStudioModule {}
