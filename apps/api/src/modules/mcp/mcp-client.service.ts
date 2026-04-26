import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MetricsService } from '../metrics/metrics.service';

interface McpConnection {
  client: Client;
  tools: Array<{ name: string; description?: string; inputSchema: object }>;
}

@Injectable()
export class McpClientService implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  // url → established connection
  private readonly pool = new Map<string, McpConnection>();

  constructor(private metrics: MetricsService) {}

  async connect(url: string): Promise<McpConnection> {
    const existing = this.pool.get(url);
    if (existing) return existing;

    const transport = new SSEClientTransport(new URL(url));
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

    this.pool.set(url, conn);
    this.logger.log(`Connected to external MCP server: ${url} (${tools.length} tools)`);
    return conn;
  }

  async listTools(url: string) {
    const conn = await this.connect(url);
    return conn.tools;
  }

  async callTool(
    agentKey: string,
    url: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const conn = await this.connect(url);
    this.metrics.mcpCallsTotal.inc({
      agent: agentKey,
      tool: toolName,
      direction: 'outbound',
    });
    const result = await conn.client.callTool({ name: toolName, arguments: args });
    return result;
  }

  disconnect(url: string) {
    const conn = this.pool.get(url);
    if (conn) {
      conn.client.close().catch(() => {});
      this.pool.delete(url);
    }
  }

  async onModuleDestroy() {
    for (const [url, conn] of this.pool) {
      try {
        await conn.client.close();
      } catch {
        // ignore on shutdown
      }
      this.pool.delete(url);
    }
  }
}
