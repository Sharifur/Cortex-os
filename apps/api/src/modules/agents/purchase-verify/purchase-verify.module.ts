import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { PurchaseVerifyService } from './purchase-verify.service';

@Module({
  imports: [SettingsModule],
  providers: [PurchaseVerifyService],
  exports: [PurchaseVerifyService],
})
export class PurchaseVerifyModule {}
