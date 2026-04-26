import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { McpServerService } from './mcp-server.service';
import { McpClientService } from './mcp-client.service';
import { McpServersService } from './mcp-servers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('mcp')
export class McpController {
  constructor(
    private mcpServer: McpServerService,
    private mcpClient: McpClientService,
    private mcpServers: McpServersService,
    private jwt: JwtService,
  ) {}

  // ── Inbound: what we expose to external clients ───────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get()
  overview() {
    return {
      agents: this.mcpServer.listAgentTools(),
      activeConnections: this.mcpServer.activeConnectionCount(),
    };
  }

  @Get(':agentKey/sse')
  async sse(
    @Param('agentKey') agentKey: string,
    @Query('token') token: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    try {
      this.jwt.verify(token, { secret: process.env.JWT_SECRET });
    } catch {
      reply.status(401).send({ message: 'Unauthorized' });
      return;
    }
    await this.mcpServer.handleSse(agentKey, req.raw, reply.raw);
  }

  @Post(':agentKey/messages')
  async messages(
    @Param('agentKey') agentKey: string,
    @Query('sessionId') sessionId: string,
    @Query('token') token: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    try {
      this.jwt.verify(token, { secret: process.env.JWT_SECRET });
    } catch {
      reply.status(401).send({ message: 'Unauthorized' });
      return;
    }
    await this.mcpServer.handleMessage(sessionId, req.raw, reply.raw);
  }

  // ── Outbound: external MCP servers we connect to ──────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('servers')
  listServers() {
    return this.mcpServers.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('servers')
  createServer(@Body() body: { name: string; url: string }) {
    return this.mcpServers.create(body.name, body.url);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('servers/:id')
  updateServer(
    @Param('id') id: string,
    @Body() body: { url?: string; enabled?: boolean },
  ) {
    return this.mcpServers.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('servers/:id')
  @HttpCode(204)
  async deleteServer(@Param('id') id: string) {
    await this.mcpServers.delete(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('servers/:id/tools')
  async getServerTools(@Param('id') id: string) {
    const server = await this.mcpServers.findById(id);
    try {
      const tools = await this.mcpClient.listTools(server.url);
      return { connected: true, tools };
    } catch (err) {
      return { connected: false, tools: [], error: (err as Error).message };
    }
  }
}
