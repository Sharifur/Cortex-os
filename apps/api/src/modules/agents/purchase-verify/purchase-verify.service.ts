import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

export type RecommendedAction =
  | 'grant_support'
  | 'offer_support_renewal'
  | 'support_extension_unavailable'
  | 'reject_buyer_mismatch'
  | 'reject_invalid_code';

export interface PurchaseVerifyResult {
  action: RecommendedAction | string;
  summary: string;
  supportIsActive: boolean;
  supportDaysRemaining: number;
  canExtend: boolean;
  buyerUsername: string | null;
  licenseKey: string | null;
}

@Injectable()
export class PurchaseVerifyService {
  private readonly logger = new Logger(PurchaseVerifyService.name);

  constructor(private readonly settings: SettingsService) {}

  async verify(purchaseCode: string, expectedBuyer?: string): Promise<PurchaseVerifyResult | null> {
    const [serverUrl, signature, accountType] = await Promise.all([
      this.settings.getDecrypted('license_server_url'),
      this.settings.getDecrypted('license_server_signature'),
      this.settings.getDecrypted('license_account_type'),
    ]);

    if (!serverUrl || !signature) {
      this.logger.warn('License server not configured — skipping purchase verification');
      return null;
    }

    const endpoint = `${serverUrl.replace(/\/$/, '')}/api/public-api/envato/verify-purchase-code`;
    const body: Record<string, string> = { purchase_code: purchaseCode };
    if (expectedBuyer) body.expected_buyer = expectedBuyer;
    if (accountType) body.account_type = accountType;

    return this.callWithRetry(endpoint, signature, body);
  }

  private async callWithRetry(
    endpoint: string,
    signature: string,
    body: Record<string, string>,
    attempt = 0,
  ): Promise<PurchaseVerifyResult | null> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Signature': signature,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json() as any;

      if (res.status === 401 || res.status === 403) {
        this.logger.error(`License server auth error ${res.status}: ${data?.error_code} — ${data?.message}`);
        return null;
      }

      if (res.status === 429) {
        this.logger.warn('License server rate limit exceeded');
        return null;
      }

      if (res.status >= 500) {
        const delays = [1000, 4000, 16000];
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          return this.callWithRetry(endpoint, signature, body, attempt + 1);
        }
        this.logger.error(`License server 5xx after ${attempt + 1} tries — giving up`);
        return null;
      }

      // 200 (valid/expired) and 404 (invalid code) both carry data.recommended_action
      const d = data?.data ?? {};
      return {
        action: d.recommended_action ?? data?.error_code ?? 'unknown',
        summary: d.summary ?? data?.message ?? '',
        supportIsActive: d.support?.is_active ?? false,
        supportDaysRemaining: d.support?.days_remaining ?? 0,
        canExtend: d.support?.can_extend ?? false,
        buyerUsername: d.buyer?.username ?? null,
        licenseKey: d.local_record?.license_key ?? null,
      };
    } catch (err) {
      this.logger.warn(`License server request failed: ${err}`);
      return null;
    }
  }

  static extractPurchaseCodes(text: string): string[] {
    const matches = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
    return matches ? [...new Set(matches)] : [];
  }

  static hasSupportIntent(text: string): boolean {
    const lower = text.toLowerCase();
    return ['bug', 'issue', 'error', 'problem', 'not working', 'broken', 'crash', 'fail', 'fix', 'help'].some(
      (kw) => lower.includes(kw),
    );
  }

  static buildVerifyPromptBlock(result: PurchaseVerifyResult): string {
    const lines: string[] = ['\n\n--- Purchase Verification ---'];
    lines.push(`Status: ${result.action}`);
    lines.push(`Summary: ${result.summary}`);
    if (result.buyerUsername) lines.push(`Buyer: ${result.buyerUsername}`);
    if (result.licenseKey) lines.push(`License Key: ${result.licenseKey}`);

    const instructions: Record<string, string> = {
      grant_support:
        'Support is active. Answer the customer normally.',
      offer_support_renewal:
        'Support expired but renewal is still possible. Explain politely and direct them to the Envato extension page. Do not give deep technical help until they renew.',
      support_extension_unavailable:
        'Support cannot be renewed — a new purchase is required. You may answer general usage or documentation questions.',
      reject_buyer_mismatch:
        'Code is valid but the claimed buyer identity does not match. Do not trust the claim. Ask for further verification.',
      reject_invalid_code:
        'Purchase code is invalid. Tell the customer the code did not validate and ask them to recheck their Envato purchase email.',
    };
    const instruction = instructions[result.action];
    if (instruction) lines.push(`\nInstruction: ${instruction}`);
    lines.push('--- End Verification ---');

    return lines.join('\n');
  }
}
