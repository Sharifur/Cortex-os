import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { SpamCheckerModule } from '../spam-checker/spam-checker.module';
import { PostRendererService } from './post-renderer.service';
import { PostContentService } from './post-content.service';
import { PostBrandService } from './post-brand.service';
import { ThemeContractService } from './theme-contract.service';
import { ConsistencyValidator } from './consistency-validator';
import { ImageGenService } from './image-gen.service';
import { DesignAnalysisService } from './design-analysis.service';
import { DesignPatternService } from './design-pattern.service';
import { PostRenderController } from './post-render.controller';
import { DesignSampleController } from './design-sample.controller';

@Module({
  imports: [AgentsModule, LlmModule, SettingsModule, KnowledgeBaseModule, SpamCheckerModule],
  controllers: [PostRenderController, DesignSampleController],
  providers: [
    PostRendererService,
    PostContentService,
    PostBrandService,
    ThemeContractService,
    ConsistencyValidator,
    ImageGenService,
    DesignAnalysisService,
    DesignPatternService,
  ],
  exports: [PostRendererService, ImageGenService, DesignAnalysisService],
})
export class PostRenderModule {}
