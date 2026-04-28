import { Module } from '@nestjs/common';
import { HealthController, RootController } from './health.controller';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [RootController, HealthController],
})
export class HealthModule {}
