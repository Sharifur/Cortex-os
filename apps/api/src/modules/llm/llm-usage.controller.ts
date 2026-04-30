import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LlmUsageService } from './llm-usage.service';
import { listKnownModels } from './pricing';

@Controller('llm-usage')
@UseGuards(JwtAuthGuard)
export class LlmUsageController {
  constructor(private readonly usage: LlmUsageService) {}

  @Get('summary')
  async summary(@Query('hours') hours?: string) {
    const sinceHours = hours ? parseInt(hours, 10) : undefined;
    const [totals, byModel, byAgent, daily] = await Promise.all([
      this.usage.totals({ sinceHours }),
      this.usage.byModel({ sinceHours }),
      this.usage.byAgent({ sinceHours }),
      this.usage.daily({ days: 30 }),
    ]);
    return { totals, byModel, byAgent, daily };
  }

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.usage.recent(limit ? parseInt(limit, 10) : 100);
  }

  @Get('pricing')
  pricing() {
    return listKnownModels();
  }
}
