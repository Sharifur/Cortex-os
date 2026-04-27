import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SettingsModule } from '../settings/settings.module';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule, SettingsModule],
  controllers: [HealthController],
})
export class HealthModule {}
