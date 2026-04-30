import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import IORedis from 'ioredis';
import { AgentsModule } from '../agents.module';
import { AuthModule } from '../../auth/auth.module';
import { ContactsModule } from '../../contacts/contacts.module';
import { LlmModule } from '../../llm/llm.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { LivechatService } from './livechat.service';
import { LivechatAgent } from './agent';
import { LivechatSitesController } from './livechat-sites.controller';
import { LivechatPublicController } from './livechat-public.controller';
import { LivechatConversationsController } from './livechat-conversations.controller';
import { LivechatScriptController } from './livechat-script.controller';
import { LivechatOriginCache } from './livechat-origin.cache';
import { LivechatGateway } from './livechat.gateway';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatRateLimitService } from './livechat-rate-limit.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { LivechatUploadsController } from './livechat-uploads.controller';
import { LivechatTranscriptService } from './livechat-transcript.service';
import { LivechatInboundService } from './livechat-inbound.service';
import { LivechatInboundController } from './livechat-inbound.controller';
import { SesModule } from '../../ses/ses.module';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [AgentsModule, AuthModule, ContactsModule, LlmModule, KnowledgeBaseModule, SesModule, SettingsModule, JwtModule.register({})],
  controllers: [LivechatSitesController, LivechatPublicController, LivechatConversationsController, LivechatScriptController, LivechatUploadsController, LivechatInboundController],
  providers: [
    {
      provide: 'LIVECHAT_REDIS',
      useFactory: () => new IORedis(process.env.REDIS_URL!),
    },
    LivechatService,
    LivechatAgent,
    LivechatOriginCache,
    LivechatGateway,
    LivechatStreamService,
    LivechatRateLimitService,
    LivechatAttachmentsService,
    LivechatTranscriptService,
    LivechatInboundService,
  ],
  exports: [LivechatService, LivechatAgent, LivechatOriginCache, LivechatStreamService],
})
export class LivechatModule {}
