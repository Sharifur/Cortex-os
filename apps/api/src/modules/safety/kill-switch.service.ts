import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export type KillSwitchAction = 'extend_trial' | 'mark_refund' | 'send_email' | 'insight_submit_marketing_suggestion' | 'insight_submit_message';

@Injectable()
export class KillSwitchService {
  constructor(private readonly settings: SettingsService) {}

  async isBlocked(action: KillSwitchAction): Promise<boolean> {
    const keyMap: Record<KillSwitchAction, string> = {
      extend_trial: 'kill_extend_trial',
      mark_refund: 'kill_mark_refund',
      send_email: 'kill_send_email',
      insight_submit_marketing_suggestion: 'kill_marketing_suggestion',
      insight_submit_message: 'kill_lifecycle_message',
    };
    const v = await this.settings.getDecrypted(keyMap[action]);
    return v === 'true';
  }

  async assertAllowed(action: KillSwitchAction): Promise<void> {
    if (await this.isBlocked(action)) {
      throw new Error(`Action "${action}" is currently disabled by the safety kill switch (Settings → Safety).`);
    }
  }
}
