import { Module } from '@nestjs/common';
import IORedis from 'ioredis';
import { DbModule } from '../../db/db.module';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseIngestionService } from './knowledge-base-ingestion.service';
import { KnowledgeBaseCacheService } from './knowledge-base-cache.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { SelfImprovementService } from './self-improvement.service';

@Module({
  imports: [DbModule, LlmModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new IORedis(process.env.REDIS_URL!),
    },
    KnowledgeBaseCacheService,
    KnowledgeBaseService,
    KnowledgeBaseIngestionService,
    SelfImprovementService,
  ],
  controllers: [KnowledgeBaseController],
  exports: [KnowledgeBaseService, KnowledgeBaseCacheService, SelfImprovementService],
})
export class KnowledgeBaseModule {}
