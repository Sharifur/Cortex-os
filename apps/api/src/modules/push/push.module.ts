import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Global()
@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
