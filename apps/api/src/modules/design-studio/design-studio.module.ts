import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LlmModule } from '../llm/llm.module';
import { QUEUE_NAMES } from '../../common/queue/queue.constants';
import { DesignStudioService } from './design-studio.service';
import { DesignStudioController } from './design-studio.controller';
import { DesignStudioProcessor } from './design-studio.processor';

@Module({
  imports: [
    LlmModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.DESIGN_STUDIO }),
  ],
  controllers: [DesignStudioController],
  providers: [DesignStudioService, DesignStudioProcessor],
  exports: [DesignStudioProcessor],
})
export class DesignStudioModule {}
