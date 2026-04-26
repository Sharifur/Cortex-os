import { Injectable } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AgentRegistryService } from '../agents/runtime/agent-registry.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class McpServerService {
  // sessionId → active transport
  private readonly transports = new Map<string, SSEServerTransport>();

  constructor(
    private registry: AgentRegistryService,
    private metrics: MetricsService,
  ) {}

  listAgentTools() {
    return this.registry.getAll().map((agent) => ({
      agentKey: agent.key,
      agentName: agent.name,
      tools: agent.mcpTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));
  }

  activeConnectionCount(): number {
    return this.transports.size;
  }

  async handleSse(agentKey: string, req: IncomingMessage, res: ServerResponse) {
    const agent = this.registry.get(agentKey);
    if (!agent) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `Agent not found: ${agentKey}` }));
      return;
    }

    const postPath = `/mcp/${agentKey}/messages`;
    const transport = new SSEServerTransport(postPath, res);

    const server = new Server(
      { name: `cortex-os/${agentKey}`, version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: agent.mcpTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = agent.mcpTools().find((t) => t.name === request.params.name);
      if (!tool) {
        throw new Error(`Tool not found: ${request.params.name}`);
      }

      this.metrics.mcpCallsTotal.inc({
        agent: agentKey,
        tool: request.params.name,
        direction: 'inbound',
      });

      const result = await tool.handler(request.params.arguments ?? {});
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    });

    this.transports.set(transport.sessionId, transport);

    res.on('close', () => {
      this.transports.delete(transport.sessionId);
      server.close().catch(() => {});
    });

    await server.connect(transport);
  }

  async handleMessage(sessionId: string, req: IncomingMessage, res: ServerResponse) {
    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Session not found' }));
      return;
    }
    await transport.handlePostMessage(req, res);
  }
}
