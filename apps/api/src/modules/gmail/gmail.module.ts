import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';

@Module({
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
