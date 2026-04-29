import { Module } from '@nestjs/common';
import { KillSwitchService } from './kill-switch.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [KillSwitchService],
  exports: [KillSwitchService],
})
export class SafetyModule {}
