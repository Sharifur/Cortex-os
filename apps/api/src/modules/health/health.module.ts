import { Module } from '@nestjs/common';
import { HealthController, RootController } from './health.controller';
import { DbModule } from '../../db/db.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DbModule, SettingsModule],
  controllers: [RootController, HealthController],
})
export class HealthModule {}
