import { Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { McpServerService } from './mcp-server.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('mcp')
export class McpController {
  constructor(
    private mcpServer: McpServerService,
    private jwt: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listTools() {
    return {
      agents: this.mcpServer.listAgentTools(),
      activeConnections: this.mcpServer.activeConnectionCount(),
    };
  }

  // SSE endpoint — token in query param since EventSource can't set headers
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

    // Let the MCP SDK own the raw response
    await this.mcpServer.handleSse(agentKey, req.raw, reply.raw);
  }

  // Message endpoint — receives POST from MCP client
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
}
