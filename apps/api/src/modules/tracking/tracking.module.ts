import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { DbModule } from '../../db/db.module';
import { DebugLogsModule } from '../debug-logs/debug-logs.module';

@Module({
  imports: [DbModule, DebugLogsModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
