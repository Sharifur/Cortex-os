import { Module } from '@nestjs/common';
import IORedis from 'ioredis';
import { GmailService } from './gmail.service';
import { GmailOAuthService } from './gmail-oauth.service';
import { GmailController } from './gmail.controller';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [GmailController],
  providers: [
    GmailService,
    GmailOAuthService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new IORedis(process.env.REDIS_URL!),
    },
  ],
  exports: [GmailService],
})
export class GmailModule {}
