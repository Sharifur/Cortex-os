import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { HrmApiService } from './hrm-api.service';

@Module({
  imports: [SettingsModule],
  providers: [HrmApiService],
  exports: [HrmApiService],
})
export class HrmApiModule {}
