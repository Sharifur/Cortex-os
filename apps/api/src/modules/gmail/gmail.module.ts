import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
