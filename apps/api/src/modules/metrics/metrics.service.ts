import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly agentRunsTotal = new Counter({
    name: 'agent_runs_total',
    help: 'Total agent runs by agent and status',
    labelNames: ['agent', 'status'] as const,
    registers: [this.registry],
  });

  readonly agentRunDuration = new Histogram({
    name: 'agent_run_duration_seconds',
    help: 'Agent run duration in seconds',
    labelNames: ['agent'] as const,
    buckets: [0.5, 1, 5, 10, 30, 60, 120, 300],
    registers: [this.registry],
  });

  readonly llmTokensTotal = new Counter({
    name: 'llm_tokens_total',
    help: 'Total LLM tokens by provider, model and direction',
    labelNames: ['provider', 'model', 'direction'] as const,
    registers: [this.registry],
  });

  readonly llmCostUsdTotal = new Counter({
    name: 'llm_cost_usd_total',
    help: 'Total estimated LLM cost in USD',
    labelNames: ['provider', 'model'] as const,
    registers: [this.registry],
  });

  readonly approvalsPending = new Gauge({
    name: 'approvals_pending',
    help: 'Number of pending approvals',
    registers: [this.registry],
  });

  readonly approvalsFollowupActive = new Gauge({
    name: 'approvals_followup_active',
    help: 'Number of approvals in followup state',
    registers: [this.registry],
  });

  readonly queueDepth = new Gauge({
    name: 'queue_depth',
    help: 'Current queue depth by queue name',
    labelNames: ['queue'] as const,
    registers: [this.registry],
  });

  readonly mcpCallsTotal = new Counter({
    name: 'mcp_calls_total',
    help: 'Total MCP calls by agent, tool and direction',
    labelNames: ['agent', 'tool', 'direction'] as const,
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics() {
    return this.registry.metrics();
  }

  contentType() {
    return this.registry.contentType;
  }
}
