import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
