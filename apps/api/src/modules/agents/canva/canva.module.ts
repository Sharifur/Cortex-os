import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents.module';
import { LlmModule } from '../../llm/llm.module';
import { TelegramModule } from '../../telegram/telegram.module';
import { McpModule } from '../../mcp/mcp.module';
import { SettingsModule } from '../../settings/settings.module';
import { CanvaAgent } from './agent';
import { CanvaMcpService } from './canva-mcp.service';
import { CanvaBrandsService } from './canva-brands.service';
import { CanvaDebugService } from './canva-debug.service';
import { ConceptParserService } from './concept-parser.service';
import { PlannerService } from './planner.service';
import { SkillLoaderService } from './skill-loader.service';
import { ApprovalFolderService } from './approval-folder.service';
import { AuditLogService } from './audit-log.service';
import { ApprovalManagerService } from './approval-manager.service';
import { CandidateAggregatorService } from './candidate-aggregator.service';
import { CanvaAdapter } from './adapters/canva.adapter';
import { AIImageAdapter } from './adapters/ai-image.adapter';
import { LocalRenderAdapter } from './adapters/local-render.adapter';

@Module({
  imports: [AgentsModule, LlmModule, TelegramModule, McpModule, SettingsModule],
  providers: [
    CanvaAgent,
    CanvaMcpService,
    CanvaBrandsService,
    CanvaDebugService,
    ConceptParserService,
    PlannerService,
    SkillLoaderService,
    ApprovalFolderService,
    AuditLogService,
    ApprovalManagerService,
    CandidateAggregatorService,
    CanvaAdapter,
    AIImageAdapter,
    LocalRenderAdapter,
  ],
  exports: [CanvaAgent, CanvaBrandsService],
})
export class CanvaModule {}
