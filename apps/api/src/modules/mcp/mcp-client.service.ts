import { Injectable, OnModuleDestroy, Logger, NotFoundException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MetricsService } from '../metrics/metrics.service';
import { McpServersService } from './mcp-servers.service';
import { OAuthIntegrationsService } from '../integrations/oauth-integrations.service';

interface McpConnection {
  client: Client;
  tools: Array<{ name: string; description?: string; inputSchema: object }>;
}

@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private readonly pool = new Map<string, McpConnection>();

  constructor(
    private metrics: MetricsService,
    private mcpServersService: McpServersService,
    private oauthIntegrations: OAuthIntegrationsService,
  ) {}

  async connect(url: string, accessToken?: string): Promise<McpConnection> {
    const poolKey = accessToken ? `${url}::oauth` : url;
    const existing = this.pool.get(poolKey);
    if (existing) return existing;

    const opts = accessToken
      ? {
          requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
          eventSourceInit: { headers: { Authorization: `Bearer ${accessToken}` } } as Record<string, unknown>,
        }
      : {};

    const transport = new SSEClientTransport(new URL(url), opts);
    const client = new Client(
      { name: 'cortex-os', version: '1.0.0' },
      { capabilities: {} },
    );

    await client.connect(transport);

    const { tools } = await client.listTools();
    const conn: McpConnection = {
      client,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: (t.inputSchema as object) ?? {},
      })),
    };

    this.pool.set(poolKey, conn);
    this.logger.log(`Connected to MCP server: ${url} (${tools.length} tools)`);
    return conn;
  }

  async listTools(url: string) {
    const conn = await this.connect(url);
    return conn.tools;
  }

  async callTool(agentKey: string, url: string, toolName: string, args: Record<string, unknown>, accessToken?: string) {
    const conn = await this.connect(url, accessToken);
    this.metrics.mcpCallsTotal.inc({ agent: agentKey, tool: toolName, direction: 'outbound' });
    return conn.client.callTool({ name: toolName, arguments: args });
  }

  async callToolByName(
    agentKey: string,
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const server = await this.mcpServersService.findByName(serverName);
    if (!server) throw new NotFoundException(`External MCP server not configured: ${serverName}`);
    if (!server.enabled) throw new Error(`External MCP server is disabled: ${serverName}`);

    let accessToken: string | undefined;
    if (server.oauthIntegrationId) {
      const integration = await this.oauthIntegrations.findById(server.oauthIntegrationId);
      if (integration?.provider) {
        const token = await this.oauthIntegrations.getValidToken(integration.provider);
        if (token) accessToken = token;
      }
    }

    return this.callTool(agentKey, server.url, toolName, args, accessToken);
  }

  async listToolsByName(serverName: string) {
    const server = await this.mcpServersService.findByName(serverName);
    if (!server) throw new NotFoundException(`External MCP server not configured: ${serverName}`);
    return this.listTools(server.url);
  }

  disconnect(url: string) {
    for (const key of this.pool.keys()) {
      if (key === url || key.startsWith(`${url}::`)) {
        const conn = this.pool.get(key);
        conn?.client.close().catch(() => {});
        this.pool.delete(key);
      }
    }
  }

  async onModuleDestroy() {
    for (const [, conn] of this.pool) {
      try { await conn.client.close(); } catch { /* ignore on shutdown */ }
    }
    this.pool.clear();
  }
}
