import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpClientService } from '../../mcp/mcp-client.service';
import { SettingsService } from '../../settings/settings.service';

// Required Canva MCP tools — server must expose all of them
const REQUIRED_TOOLS = [
  'generate-design', 'generate-design-structured', 'create-design-from-candidate',
  'start-editing-transaction', 'perform-editing-operations', 'commit-editing-transaction', 'cancel-editing-transaction',
  'get-design', 'get-design-content', 'get-design-pages', 'get-design-thumbnail', 'get-presenter-notes',
  'export-design', 'get-export-formats',
  'resize-design', 'merge-designs',
  'import-design-from-url', 'upload-asset-from-url', 'get-assets',
  'list-brand-kits',
  'search-designs', 'search-folders', 'list-folder-items', 'create-folder', 'move-item-to-folder',
  'comment-on-design', 'list-comments', 'reply-to-comment', 'list-replies', 'request-outline-review',
  'resolve-shortlink', 'help',
];

const CANVA_SERVER_NAME = 'canva';

export interface CanvaVerifyResult {
  ok: boolean;
  endpoint: string;
  toolsFound: number;
  toolsExpected: number;
  missingTools: string[];
  latencyMs: number;
  error?: string;
}

export interface BrandKit {
  id: string;
  name: string;
}

@Injectable()
export class CanvaMcpService implements OnModuleInit {
  private readonly logger = new Logger(CanvaMcpService.name);
  // brand kits cached per workspace (session-level cache, cleared on new session)
  private brandKitCache: BrandKit[] | null = null;
  private brandKitCachedAt = 0;
  private readonly BRAND_KIT_TTL_MS = 30 * 60 * 1000; // 30 min

  constructor(
    private readonly mcp: McpClientService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    const enabled = await this.settings.getDecrypted('canva_mcp_enabled');
    if (enabled === 'true') {
      this.verify().then((r) => {
        if (r.ok) {
          this.logger.log(`Canva MCP ready — ${r.toolsFound}/${r.toolsExpected} tools, ${r.latencyMs}ms`);
        } else {
          this.logger.warn(`Canva MCP verification failed: ${r.error ?? 'missing tools'}`);
        }
      }).catch(() => {});
    }
  }

  async verify(): Promise<CanvaVerifyResult> {
    const t0 = Date.now();
    try {
      const tools = await this.mcp.listToolsByName(CANVA_SERVER_NAME);
      const latencyMs = Date.now() - t0;
      const foundNames = new Set(tools.map((t) => t.name));
      const missingTools = REQUIRED_TOOLS.filter((r) => !foundNames.has(r));
      return {
        ok: missingTools.length === 0,
        endpoint: 'canva MCP (via server config)',
        toolsFound: foundNames.size,
        toolsExpected: REQUIRED_TOOLS.length,
        missingTools,
        latencyMs,
      };
    } catch (err) {
      return {
        ok: false,
        endpoint: 'canva MCP (via server config)',
        toolsFound: 0,
        toolsExpected: REQUIRED_TOOLS.length,
        missingTools: REQUIRED_TOOLS,
        latencyMs: Date.now() - t0,
        error: (err as Error).message,
      };
    }
  }

  private async call<T = unknown>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.mcp.callToolByName('canva', CANVA_SERVER_NAME, tool, args);
    return (result as any)?.content?.[0]?.text
      ? JSON.parse((result as any).content[0].text)
      : (result as T);
  }

  async listBrandKits(): Promise<BrandKit[]> {
    const now = Date.now();
    if (this.brandKitCache && now - this.brandKitCachedAt < this.BRAND_KIT_TTL_MS) {
      return this.brandKitCache;
    }
    const res = await this.call<{ brandKits?: BrandKit[] }>('list-brand-kits');
    const kits = res.brandKits ?? [];
    this.brandKitCache = kits;
    this.brandKitCachedAt = now;
    return kits;
  }

  async generateDesignStructured(brief: Record<string, unknown>, brandKitId?: string): Promise<{ designId: string }> {
    return this.call('generate-design-structured', { brief, ...(brandKitId ? { brandKitId } : {}) });
  }

  async startEditingTransaction(designId: string): Promise<{ transactionId: string }> {
    return this.call('start-editing-transaction', { designId });
  }

  async performEditingOperations(transactionId: string, operations: unknown[]): Promise<void> {
    await this.call('perform-editing-operations', { transactionId, operations });
  }

  async commitEditingTransaction(transactionId: string): Promise<void> {
    await this.call('commit-editing-transaction', { transactionId });
  }

  async cancelEditingTransaction(transactionId: string): Promise<void> {
    try {
      await this.call('cancel-editing-transaction', { transactionId });
    } catch {
      // cancel must not throw — log and continue
      this.logger.warn(`cancel-editing-transaction(${transactionId}) failed`);
    }
  }

  async getExportFormats(designId: string): Promise<string[]> {
    const res = await this.call<{ formats?: string[] }>('get-export-formats', { designId });
    return res.formats ?? ['png'];
  }

  async exportDesign(designId: string, format = 'png'): Promise<{ url: string }> {
    return this.call('export-design', { designId, format });
  }

  async getDesignThumbnail(designId: string): Promise<{ url: string }> {
    return this.call('get-design-thumbnail', { designId });
  }

  async uploadAssetFromUrl(url: string, name?: string): Promise<{ assetId: string }> {
    return this.call('upload-asset-from-url', { url, ...(name ? { name } : {}) });
  }

  async resolveShortlink(shortlink: string): Promise<{ url: string }> {
    return this.call('resolve-shortlink', { shortlink });
  }

  async importDesignFromUrl(url: string): Promise<{ designId: string }> {
    return this.call('import-design-from-url', { url });
  }

  async getDesign(designId: string): Promise<Record<string, unknown>> {
    return this.call('get-design', { designId });
  }

  invalidateBrandKitCache() {
    this.brandKitCache = null;
  }
}
