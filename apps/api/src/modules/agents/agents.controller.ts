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
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { TriggerAgentDto } from './dto/trigger-agent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private agents: AgentsService) {}

  @Get()
  findAll() {
    return this.agents.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.agents.findByKey(key);
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() dto: UpdateAgentDto) {
    return this.agents.update(key, dto);
  }

  @Post(':key/trigger')
  trigger(@Param('key') key: string, @Body() dto: TriggerAgentDto) {
    return this.agents.trigger(key, dto);
  }

  @Get(':key/runs')
  getRuns(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.agents.getRuns(key, limit ? parseInt(limit) : 20);
  }

  @Get(':key/conversations')
  listConversations(@Param('key') key: string) {
    return this.agents.listConversations(key);
  }

  @Get(':key/conversations/:convId')
  getConversation(@Param('key') key: string, @Param('convId') convId: string) {
    return this.agents.getConversation(key, convId);
  }

  @Delete(':key')
  deleteAgent(@Param('key') key: string) {
    return this.agents.delete(key);
  }

  @Post(':key/feedback')
  @HttpCode(201)
  submitFeedback(
    @Param('key') key: string,
    @Body() body: { agentName: string; rating: 'up' | 'down'; agentMessage: string; userQuery?: string },
  ) {
    return this.agents.submitFeedback({ agentKey: key, ...body });
  }

  @Post(':key/conversations/message')
  @HttpCode(201)
  saveMessage(
    @Param('key') key: string,
    @Body() body: { conversationId: string; role: string; content: string; runId?: string; requiresApproval?: boolean },
  ) {
    return this.agents.saveConversationMessage({ agentKey: key, ...body });
  }
}
