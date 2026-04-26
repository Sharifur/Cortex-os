import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpServerService } from './mcp-server.service';
import { McpClientService } from './mcp-client.service';
import { McpServersService } from './mcp-servers.service';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [AgentsModule, AuthModule, MetricsModule],
  controllers: [McpController],
  providers: [McpServerService, McpClientService, McpServersService],
  exports: [McpServerService, McpClientService, McpServersService],
})
export class McpModule {}
