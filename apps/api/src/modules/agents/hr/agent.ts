import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, and, lte } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { employees, leaveRequests, salarySheets } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';

interface HrConfig {
  companyName: string;
  currency: string;
  workingDaysPerMonth: number;
  llm: { provider: string; model: string };
}

interface HrSnapshot {
  mode: 'salary' | 'alerts' | 'leave_request';
  pendingLeaves: any[];
  activeEmployees: any[];
  alerts: string[];
  config: HrConfig;
}

const DEFAULT_CONFIG: HrConfig = {
  companyName: 'Xgenious',
  currency: 'BDT',
  workingDaysPerMonth: 26,
  llm: { provider: 'auto', model: 'gpt-4o-mini' },
};

@Injectable()
export class HrAgent implements IAgent, OnModuleInit {
  readonly key = 'hr';
  readonly name = 'HR Manager Agent';
  private readonly logger = new Logger(HrAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 9 25 * *' },    // salary sheet on 25th
      { type: 'CRON', cron: '0 9 * * *' },       // daily alerts
      { type: 'WEBHOOK', webhookPath: '/hr/leave-request' },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const now = new Date();
    const day = now.getDate();

    const activeEmployees = await this.db.db
      .select()
      .from(employees)
      .where(eq(employees.active, 'true'));

    const pendingLeaves = await this.db.db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.status, 'pending'));

    const alerts: string[] = [];

    // Check probation endings (within 7 days)
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    for (const emp of activeEmployees) {
      if (emp.probationUntil && new Date(emp.probationUntil) <= inSevenDays && new Date(emp.probationUntil) >= now) {
        alerts.push(`Probation ending for ${emp.name} on ${emp.probationUntil}`);
      }
      if (emp.contractEndsAt && new Date(emp.contractEndsAt) <= inSevenDays && new Date(emp.contractEndsAt) >= now) {
        alerts.push(`Contract expiring for ${emp.name} on ${emp.contractEndsAt}`);
      }
    }

    const mode = trigger.type === 'WEBHOOK'
      ? 'leave_request'
      : day === 25
        ? 'salary'
        : 'alerts';

    return {
      source: trigger,
      snapshot: { mode, pendingLeaves, activeEmployees, alerts, config },
      followups: [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const { mode, pendingLeaves, activeEmployees, alerts, config } = ctx.snapshot as HrSnapshot;
    const actions: ProposedAction[] = [];

    if (mode === 'salary') {
      const month = new Date().toISOString().slice(0, 7);
      const existing = await this.db.db
        .select()
        .from(salarySheets)
        .where(eq(salarySheets.month, month))
        .limit(1);

      if (!existing.length) {
        const lineItems = activeEmployees.map((emp) => ({
          employeeId: emp.id,
          name: emp.name,
          role: emp.role,
          baseSalary: emp.salary,
          deductions: 0,
          bonus: 0,
          net: emp.salary,
        }));
        const total = lineItems.reduce((s, i) => s + i.net, 0);

        actions.push({
          type: 'generate_salary_sheet',
          summary: `Generate ${month} salary sheet — ${activeEmployees.length} employees, total ${config.currency} ${total.toLocaleString()}`,
          payload: { month, lineItems, total, currency: config.currency },
          riskLevel: 'high',
        });
      }
    }

    if (mode === 'alerts' || mode === 'salary') {
      for (const alert of alerts) {
        actions.push({
          type: 'notify_owner',
          summary: alert,
          payload: { message: `🔔 HR Alert: ${alert}` },
          riskLevel: 'low',
        });
      }

      for (const leave of pendingLeaves) {
        try {
          const [emp] = await this.db.db
            .select()
            .from(employees)
            .where(eq(employees.id, leave.employeeId));

          const response = await this.llm.complete({
            messages: [
              {
                role: 'system',
                content: `You are an HR manager. Evaluate leave requests fairly. Employee has ${emp?.leaveBalance ?? 0} days balance. Reply with JSON: { "decision": "approved" | "rejected", "reason": "..." }`,
              },
              {
                role: 'user',
                content: `Employee: ${emp?.name ?? leave.employeeId}\nType: ${leave.type}\nFrom: ${leave.fromDate} To: ${leave.toDate}\nReason: ${leave.reason ?? 'Not provided'}`,
              },
            ],
            provider: config.llm.provider as any,
            model: config.llm.model,
            maxTokens: 150,
          });

          let parsed: { decision: string; reason: string };
          try {
            parsed = JSON.parse(response.content.trim());
          } catch {
            parsed = { decision: 'pending', reason: response.content.trim() };
          }

          actions.push({
            type: 'respond_to_leave_request',
            summary: `Leave ${parsed.decision}: ${emp?.name ?? leave.employeeId} (${leave.type} ${leave.fromDate}–${leave.toDate})`,
            payload: { leaveId: leave.id, employeeId: leave.employeeId, employeeName: emp?.name, decision: parsed.decision, reason: parsed.reason },
            riskLevel: 'medium',
          });
        } catch (err) {
          this.logger.warn(`Failed to draft leave decision: ${err}`);
        }
      }
    }

    if (mode === 'leave_request' && (ctx.source as any).payload) {
      const req = (ctx.source as any).payload as any;
      actions.push({
        type: 'respond_to_leave_request',
        summary: `New leave request from ${req.employeeName ?? req.employeeId}: ${req.type} ${req.fromDate}–${req.toDate}`,
        payload: req,
        riskLevel: 'medium',
      });
    }

    return actions.length
      ? actions
      : [{ type: 'noop', summary: 'No HR actions today.', payload: {}, riskLevel: 'low' }];
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'generate_salary_sheet' || action.type === 'respond_to_leave_request';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'notify_owner') {
      await this.telegram.sendMessage(p.message);
      return { success: true };
    }

    if (action.type === 'generate_salary_sheet') {
      await this.db.db
        .insert(salarySheets)
        .values({
          month: p.month,
          lineItems: JSON.stringify(p.lineItems),
          totals: JSON.stringify({ total: p.total, currency: p.currency }),
        })
        .onConflictDoNothing();
      await this.telegram.sendMessage(
        `✅ Salary sheet for ${p.month} generated — ${p.lineItems.length} employees, ${p.currency} ${p.total.toLocaleString()}`,
      );
      return { success: true, data: { month: p.month } };
    }

    if (action.type === 'respond_to_leave_request') {
      if (p.leaveId) {
        await this.db.db
          .update(leaveRequests)
          .set({ status: p.decision, decisionReason: p.reason, decidedAt: new Date() })
          .where(eq(leaveRequests.id, p.leaveId));
      }
      await this.telegram.sendMessage(
        `✅ Leave request ${p.decision}: ${p.employeeName ?? p.employeeId}\nReason: ${p.reason}`,
      );
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_employees',
        description: 'List all active employees',
        inputSchema: { type: 'object', properties: {} },
        handler: async () =>
          this.db.db.select().from(employees).where(eq(employees.active, 'true')),
      },
      {
        name: 'get_employee',
        description: 'Get employee by ID',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        handler: async (input) => {
          const [emp] = await this.db.db
            .select()
            .from(employees)
            .where(eq(employees.id, (input as any).id));
          return emp ?? null;
        },
      },
      {
        name: 'compute_salary',
        description: 'Compute salary with deductions/bonuses for an employee',
        inputSchema: {
          type: 'object',
          properties: { employeeId: { type: 'string' }, deductions: { type: 'number' }, bonus: { type: 'number' } },
          required: ['employeeId'],
        },
        handler: async (input) => {
          const { employeeId, deductions = 0, bonus = 0 } = input as any;
          const [emp] = await this.db.db.select().from(employees).where(eq(employees.id, employeeId));
          if (!emp) return null;
          return { employeeId, name: emp.name, base: emp.salary, deductions, bonus, net: emp.salary - deductions + bonus };
        },
      },
      {
        name: 'decide_leave',
        description: 'LLM-draft a leave decision',
        inputSchema: {
          type: 'object',
          properties: { leaveId: { type: 'string' } },
          required: ['leaveId'],
        },
        handler: async (input) => {
          const [leave] = await this.db.db.select().from(leaveRequests).where(eq(leaveRequests.id, (input as any).leaveId));
          return leave ?? null;
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'POST',
        path: '/hr/leave-request',
        requiresAuth: true,
        handler: async (body) => {
          const { employeeId, type, fromDate, toDate, reason } = body as any;
          const [row] = await this.db.db
            .insert(leaveRequests)
            .values({ employeeId, type, fromDate, toDate, reason: reason ?? null })
            .returning();
          return row;
        },
      },
      {
        method: 'GET',
        path: '/hr/salary-sheet/:month',
        requiresAuth: true,
        handler: async (body) => {
          const month = (body as any).month;
          const [sheet] = await this.db.db
            .select()
            .from(salarySheets)
            .where(eq(salarySheets.month, month));
          return sheet ?? null;
        },
      },
      {
        method: 'GET',
        path: '/hr/alerts/today',
        requiresAuth: true,
        handler: async () => {
          const now = new Date();
          const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const allEmployees = await this.db.db.select().from(employees).where(eq(employees.active, 'true'));
          const alerts: string[] = [];
          for (const emp of allEmployees) {
            if (emp.probationUntil && new Date(emp.probationUntil) <= inSevenDays && new Date(emp.probationUntil) >= now) {
              alerts.push(`Probation ending: ${emp.name} (${emp.probationUntil})`);
            }
            if (emp.contractEndsAt && new Date(emp.contractEndsAt) <= inSevenDays && new Date(emp.contractEndsAt) >= now) {
              alerts.push(`Contract expiring: ${emp.name} (${emp.contractEndsAt})`);
            }
          }
          return { alerts, count: alerts.length };
        },
      },
    ];
  }

  private async getConfig(): Promise<HrConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    return { ...DEFAULT_CONFIG, ...(row?.config as Partial<HrConfig> ?? {}) };
  }
}
