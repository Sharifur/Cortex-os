import { Injectable } from '@nestjs/common';
import { SESClient, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import { Client as MinioClient } from 'minio';
import { SettingsService } from '../settings/settings.service';
import { CrispService } from '../agents/crisp/crisp.service';
import { StorageService } from '../storage/storage.service';
import { GmailService } from '../gmail/gmail.service';

export interface TestResult {
  ok: boolean;
  message: string;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly settings: SettingsService,
    private readonly crispService: CrispService,
    private readonly storageService: StorageService,
    private readonly gmailService: GmailService,
  ) {}

  async test(key: string): Promise<TestResult> {
    switch (key) {
      case 'whatsapp': return this.testWhatsApp();
      case 'linkedin':  return this.testLinkedIn();
      case 'reddit':    return this.testReddit();
      case 'crisp':     return this.testCrisp();
      case 'telegram':  return this.testTelegram();
      case 'ses':       return this.testSes();
      case 'gmail':     return this.testGmail();
      case 'license':   return this.testLicense();
      case 'storage':   return this.testStorage();
      default:          return { ok: false, message: `Unknown integration: ${key}` };
    }
  }

  private async testWhatsApp(): Promise<TestResult> {
    const [token, phoneId] = await Promise.all([
      this.settings.getDecrypted('whatsapp_api_token'),
      this.settings.getDecrypted('whatsapp_phone_number_id'),
    ]);
    if (!token || !phoneId) return { ok: false, message: 'Credentials not configured' };

    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${phoneId}?fields=display_phone_number,verified_name&access_token=${token}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const data = await res.json() as any;
      if (!res.ok) return { ok: false, message: data?.error?.message ?? `HTTP ${res.status}` };
      return { ok: true, message: `${data.verified_name ?? ''} (${data.display_phone_number ?? phoneId})`.trim() };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testLinkedIn(): Promise<TestResult> {
    const [unipileKey, unipileDsn, linkedinToken] = await Promise.all([
      this.settings.getDecrypted('unipile_api_key'),
      this.settings.getDecrypted('unipile_dsn'),
      this.settings.getDecrypted('linkedin_access_token'),
    ]);

    if (!unipileKey && !linkedinToken) return { ok: false, message: 'Credentials not configured' };

    try {
      if (unipileKey && unipileDsn) {
        const res = await fetch(`https://${unipileDsn}/api/v1/me`, {
          headers: { 'X-API-KEY': unipileKey },
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json() as any;
        if (!res.ok) return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
        const name = data.name ?? data.full_name ?? data.email ?? 'account';
        return { ok: true, message: `Connected via Unipile — ${name}` };
      }

      const res = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${linkedinToken}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as any;
      if (!res.ok) return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
      const name = `${data.localizedFirstName ?? ''} ${data.localizedLastName ?? ''}`.trim();
      return { ok: true, message: `Connected — ${name || 'LinkedIn account'}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testReddit(): Promise<TestResult> {
    const [clientId, clientSecret, username, password] = await Promise.all([
      this.settings.getDecrypted('reddit_client_id'),
      this.settings.getDecrypted('reddit_client_secret'),
      this.settings.getDecrypted('reddit_username'),
      this.settings.getDecrypted('reddit_password'),
    ]);
    if (!clientId || !clientSecret || !username || !password) {
      return { ok: false, message: 'Credentials not configured' };
    }

    try {
      const userAgent = `cortex-os/1.0 by ${username}`;
      const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'password', username, password }),
        signal: AbortSignal.timeout(8000),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok || tokenData.error) {
        return { ok: false, message: tokenData.message ?? tokenData.error ?? `HTTP ${tokenRes.status}` };
      }

      const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': userAgent },
        signal: AbortSignal.timeout(8000),
      });
      const me = await meRes.json() as any;
      if (!meRes.ok) return { ok: false, message: `HTTP ${meRes.status}` };
      return { ok: true, message: `Connected as u/${me.name ?? username}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testCrisp(): Promise<TestResult> {
    const sites = await this.crispService.listWebsites();
    if (!sites.length) return { ok: false, message: 'No websites configured' };
    const enabled = sites.filter((s) => s.enabled);
    if (!enabled.length) return { ok: false, message: 'No websites enabled' };
    const results = await Promise.all(enabled.map((s) => this.crispService.testWebsite(s.id)));
    const failed = results.filter((r) => !r.ok);
    if (!failed.length) return { ok: true, message: results.map((r) => r.message).join(' | ') };
    return { ok: false, message: failed.map((r) => r.message).join(' | ') };
  }

  private async testTelegram(): Promise<TestResult> {
    const [token, chatId] = await Promise.all([
      this.settings.getDecrypted('telegram_bot_token'),
      this.settings.getDecrypted('telegram_owner_chat_id'),
    ]);
    if (!token) return { ok: false, message: 'Bot token not configured' };

    try {
      const getMeRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const getMeData = await getMeRes.json() as any;
      if (!getMeRes.ok || !getMeData.ok) {
        return { ok: false, message: getMeData.description ?? `HTTP ${getMeRes.status}` };
      }
      const botName = getMeData.result?.username ? `@${getMeData.result.username}` : (getMeData.result?.first_name ?? 'bot');

      if (!chatId) {
        return { ok: true, message: `${botName} — owner chat ID not set` };
      }

      // Verify the chat ID is reachable by calling getChat
      const getChatRes = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const getChatData = await getChatRes.json() as any;
      if (!getChatRes.ok || !getChatData.ok) {
        return {
          ok: false,
          message: `Bot token ok (${botName}) but chat ID ${chatId} not reachable — send /start to the bot first`,
        };
      }

      return { ok: true, message: `${botName} — chat verified` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testSes(): Promise<TestResult> {
    const [accessKeyId, secretAccessKey, region] = await Promise.all([
      this.settings.getDecrypted('aws_access_key_id'),
      this.settings.getDecrypted('aws_secret_access_key'),
      this.settings.getDecrypted('aws_region'),
    ]);
    if (!accessKeyId || !secretAccessKey) return { ok: false, message: 'AWS credentials not configured' };

    try {
      const client = new SESClient({
        region: region ?? 'ap-south-1',
        credentials: { accessKeyId, secretAccessKey },
        requestHandler: { requestTimeout: 8000 } as any,
      });
      const quota = await client.send(new GetSendQuotaCommand({}));
      const sent = quota.SentLast24Hours ?? 0;
      const max = quota.Max24HourSend ?? 0;
      return { ok: true, message: `Quota: ${sent}/${max} emails in last 24h` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testLicense(): Promise<TestResult> {
    const [serverUrl, signature] = await Promise.all([
      this.settings.getDecrypted('license_server_url'),
      this.settings.getDecrypted('license_server_signature'),
    ]);
    if (!serverUrl || !signature) return { ok: false, message: 'License server URL and signature not configured' };

    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/public-api/envato/verify-purchase-code`, {
        method: 'POST',
        headers: {
          'X-Signature': signature,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ purchase_code: 'test-connection-probe' }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as any;

      if (res.status === 401) return { ok: false, message: `Auth failed: ${data?.error_code ?? 'INVALID_SIGNATURE'}` };
      if (res.status === 403) return { ok: false, message: `Forbidden: ${data?.error_code ?? 'check scope/IP/expiry'}` };
      if (res.status === 422 || res.status === 404 || res.status === 200) {
        return { ok: true, message: `License server reachable — signature valid` };
      }
      return { ok: false, message: `Unexpected HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async testStorage(): Promise<TestResult> {
    return this.storageService.testConnection();
  }

  private async testGmail(): Promise<TestResult> {
    const accounts = await this.gmailService.listAccounts();
    if (!accounts.length) {
      return { ok: false, message: 'No Gmail accounts configured' };
    }
    const def = accounts.find((a) => a.isDefault) ?? accounts[0];
    const r = await this.gmailService.testAccount(def.id);
    return { ok: r.ok, message: r.ok ? `${r.message} (default: ${def.label})` : r.message };
  }
}
