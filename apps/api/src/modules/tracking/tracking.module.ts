import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
