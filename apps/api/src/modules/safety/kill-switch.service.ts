import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export type KillSwitchAction = 'extend_trial' | 'mark_refund' | 'send_email' | 'insight_submit_marketing_suggestion';

@Injectable()
export class KillSwitchService {
  constructor(private readonly settings: SettingsService) {}

  async isBlocked(action: KillSwitchAction): Promise<boolean> {
    const key = action === 'insight_submit_marketing_suggestion' ? 'kill_marketing_suggestion' : `kill_${action}`;
    const v = await this.settings.getDecrypted(key);
    return v === 'true';
  }

  async assertAllowed(action: KillSwitchAction): Promise<void> {
    if (await this.isBlocked(action)) {
      throw new Error(`Action "${action}" is currently disabled by the safety kill switch (Settings → Safety).`);
    }
  }
}
