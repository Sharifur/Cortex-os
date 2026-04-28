import { Module } from '@nestjs/common';
import { DebugLogsController } from './debug-logs.controller';
import { RequestLogService } from './request-log.service';
import { RequestLogExceptionFilter } from './request-log.filter';
import { DbModule } from '../../db/db.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [DebugLogsController],
  providers: [RequestLogService, RequestLogExceptionFilter],
  exports: [RequestLogService, RequestLogExceptionFilter],
})
export class DebugLogsModule {}
