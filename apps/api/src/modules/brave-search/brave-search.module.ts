import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { BraveSearchService } from './brave-search.service';

@Module({
  imports: [SettingsModule],
  providers: [BraveSearchService],
  exports: [BraveSearchService],
})
export class BraveSearchModule {}
