import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, hrPayslipRuns } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { TelegramService } from '../../telegram/telegram.service';
import { SettingsService } from '../../settings/settings.service';
import { HrmApiService, HrmApiError, HrmEmployee } from './hrm-api.service';
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
  payslipDay: number;
  llm?: { provider?: string; model?: string };
}

interface HrSnapshot {
  mode: 'salary' | 'daily';
  month: string;
  config: HrConfig;
  // salary mode
  employees?: HrmEmployee[];
  totalNet?: number;
  // daily mode
  pendingLeaves?: any[];
  pendingWfh?: any[];
  onLeaveToday?: any[];
  onWfhToday?: any[];
  alerts?: any;
}

const DEFAULT_CONFIG: HrConfig = {
  companyName: 'Xgenious',
  currency: 'BDT',
  payslipDay: 25,
};

@Injectable()
export class HrAgent implements IAgent {
  readonly key = 'hr';
  readonly name = 'HR Manager Agent';
  private readonly logger = new Logger(HrAgent.name);

  constructor(
    private db: DbService,
    private telegram: TelegramService,
    private registry: AgentRegistryService,
    private settings: SettingsService,
    private hrm: HrmApiService,
  ) {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [
      { type: 'CRON', cron: '0 9 * * *' },
      { type: 'MANUAL' },
    ];
  }

  async buildContext(trigger: TriggerEvent, _run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const now = new Date();
    const today = now.getDate();
    const month = now.toISOString().slice(0, 7);
    const isSalaryDay = today === config.payslipDay;

    if (isSalaryDay) {
      let employees: HrmEmployee[] = [];
      let totalNet = 0;
      try {
        const result = await this.hrm.getEmployees({ active: 'true' });
        employees = result.data;
        totalNet = employees.reduce((sum, e) => sum + (e.salary ?? 0), 0);
      } catch (err) {
        this.logger.error(`getEmployees failed: ${err instanceof HrmApiError ? err.message : err}`);
      }

      return {
        source: trigger,
        snapshot: { mode: 'salary', month, config, employees, totalNet },
        followups: [],
      };
    }

    // Daily digest mode
    let pendingLeaves: any[] = [];
    let pendingWfh: any[] = [];
    let onLeaveToday: any[] = [];
    let onWfhToday: any[] = [];
    let alerts: any = {};

    try {
      const [lv, wfh, ol, ow, al] = await Promise.all([
        this.hrm.getPendingLeaves(),
        this.hrm.getPendingWfh(),
        this.hrm.getTodayOnLeave(),
        this.hrm.getTodayWfh(),
        this.hrm.getAlerts(7),
      ]);
      pendingLeaves = lv.data;
      pendingWfh = wfh.data;
      onLeaveToday = ol.data;
      onWfhToday = ow.data;
      alerts = al;
    } catch (err) {
      this.logger.error(`Daily digest fetch failed: ${err instanceof HrmApiError ? err.message : err}`);
    }

    return {
      source: trigger,
      snapshot: { mode: 'daily', month, config, pendingLeaves, pendingWfh, onLeaveToday, onWfhToday, alerts },
      followups: [],
    };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snap = ctx.snapshot as HrSnapshot;
    const actions: ProposedAction[] = [];

    if (snap.mode === 'salary') {
      const count = snap.employees?.length ?? 0;
      const total = snap.totalNet ?? 0;

      if (count === 0) {
        actions.push({ type: 'noop', summary: `No active employees found for ${snap.month}.`, payload: {}, riskLevel: 'low' });
        return actions;
      }

      actions.push({
        type: 'salary_run',
        summary: `Generate and approve ${snap.month} payroll — ${count} employee${count !== 1 ? 's' : ''}, total ${snap.config.currency} ${total.toLocaleString()}`,
        payload: {
          month: snap.month,
          currency: snap.config.currency,
          employeeCount: count,
          totalNet: total,
          employeeNames: snap.employees!.map((e) => e.name),
        },
        riskLevel: 'high',
      });
      return actions;
    }

    // Daily mode
    for (const leave of snap.pendingLeaves ?? []) {
      actions.push({
        type: 'leave_approval_request',
        summary: `Leave request — ${leave.employeeName}: ${leave.type} ${leave.fromDate} to ${leave.toDate}`,
        payload: { leaveId: leave.id, employeeName: leave.employeeName, type: leave.type, fromDate: leave.fromDate, toDate: leave.toDate },
        riskLevel: 'medium',
      });
    }

    for (const wfh of snap.pendingWfh ?? []) {
      actions.push({
        type: 'wfh_approval_request',
        summary: `WFH request — ${wfh.employeeName}: ${wfh.date}`,
        payload: { wfhId: wfh.id, employeeName: wfh.employeeName, date: wfh.date, reason: wfh.reason },
        riskLevel: 'low',
      });
    }

    actions.push({
      type: 'daily_digest',
      summary: 'Daily HR summary',
      payload: {
        onLeaveToday: snap.onLeaveToday ?? [],
        onWfhToday: snap.onWfhToday ?? [],
        alerts: snap.alerts ?? {},
        date: new Date().toDateString(),
      },
      riskLevel: 'low',
    });

    return actions;
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'salary_run' || action.type === 'leave_approval_request';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

    if (action.type === 'salary_run') {
      const { InlineKeyboard } = await import('grammy');

      // Generate payslips after Cortex approval
      let generated: Awaited<ReturnType<HrmApiService['generatePayslips']>>['data'] = [];
      try {
        const result = await this.hrm.generatePayslips(p.month);
        generated = result.data;
      } catch (err) {
        const msg = err instanceof HrmApiError ? err.message : String(err);
        this.logger.error(`generatePayslips failed: ${msg}`);
        return { success: false, error: msg };
      }

      if (generated.length === 0) {
        await this.telegram.sendMessage(`Payroll ${p.month}: no new payslips generated (all already exist or no attendance).`);
        return { success: true };
      }

      // Insert tracking rows then send each slip to Telegram for per-slip approval
      for (const slip of generated) {
        const [row] = await this.db.db
          .insert(hrPayslipRuns)
          .values({
            month: slip.month,
            xghrmId: slip.id,
            employeeId: slip.employeeId,
            employeeName: slip.employeeName,
            netSalary: Math.round(slip.netSalary),
          })
          .returning();

        const text =
          `Payslip — ${slip.employeeName}\n` +
          `Month: ${slip.month}\n` +
          `Base: ${slip.currency} ${Number(slip.baseSalary).toLocaleString()}\n` +
          (slip.bonus ? `Bonus: ${slip.currency} ${Number(slip.bonus).toLocaleString()}\n` : '') +
          (slip.deductions ? `Deductions: ${slip.currency} ${Number(slip.deductions).toLocaleString()}\n` : '') +
          `Net: ${slip.currency} ${Number(slip.netSalary).toLocaleString()}`;

        const kb = new InlineKeyboard()
          .text('Approve', `hr_slip_approve:${row.id}:${slip.id}`)
          .text('Edit', `hr_slip_edit:${row.id}:${slip.id}`)
          .text('Skip', `hr_slip_skip:${row.id}`);

        const msg = await this.telegram.sendMessageWithKeyboard(text, kb);
        if (msg?.message_id) {
          await this.db.db.update(hrPayslipRuns).set({ telegramMsgId: msg.message_id, status: 'tg_sent' }).where(eq(hrPayslipRuns.id, row.id));
        }
      }

      return { success: true };
    }

    if (action.type === 'daily_digest') {
      const lines: string[] = [`Daily HR Summary — ${p.date}`, ''];

      const onLeave: string = p.onLeaveToday.length
        ? p.onLeaveToday.map((e: any) => `${e.employeeName} (${e.leaveType})`).join(', ')
        : 'None';
      lines.push(`On leave today: ${onLeave}`);

      const onWfh: string = p.onWfhToday.length
        ? p.onWfhToday.map((e: any) => e.employeeName).join(', ')
        : 'None';
      lines.push(`WFH today: ${onWfh}`);

      const al = p.alerts as any;
      const alertLines: string[] = [];
      for (const e of al.probationEnding ?? []) alertLines.push(`Probation ending: ${e.employeeName} (${e.probationUntil})`);
      for (const e of al.birthdays ?? []) alertLines.push(`Birthday: ${e.employeeName}`);
      for (const e of al.workAnniversaries ?? []) alertLines.push(`Work anniversary: ${e.employeeName} — ${e.years} year${e.years !== 1 ? 's' : ''}`);

      if (alertLines.length) {
        lines.push('', 'Alerts:');
        alertLines.forEach((a) => lines.push(`- ${a}`));
      }

      await this.telegram.sendMessage(lines.join('\n'));
      return { success: true };
    }

    if (action.type === 'leave_approval_request') {
      const { InlineKeyboard } = await import('grammy');
      const kb = new InlineKeyboard()
        .text('Approve', `hr_leave_approve:${p.leaveId}`)
        .text('Reject', `hr_leave_reject:${p.leaveId}`);
      await this.telegram.sendMessageWithKeyboard(
        `Leave request\n${p.employeeName}: ${p.type}\nFrom: ${p.fromDate} To: ${p.toDate}`,
        kb,
      );
      return { success: true };
    }

    if (action.type === 'wfh_approval_request') {
      const { InlineKeyboard } = await import('grammy');
      const kb = new InlineKeyboard()
        .text('Approve', `hr_wfh_approve:${p.wfhId}`)
        .text('Reject', `hr_wfh_reject:${p.wfhId}`);
      await this.telegram.sendMessageWithKeyboard(
        `WFH request\n${p.employeeName}: ${p.date}${p.reason ? `\nReason: ${p.reason}` : ''}`,
        kb,
      );
      return { success: true };
    }

    return { success: true };
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_employees',
        description: 'List employees from XGHRM',
        inputSchema: { type: 'object', properties: { active: { type: 'string', enum: ['true', 'false', 'all'] } } },
        handler: async (input) => this.hrm.getEmployees({ active: (input as any).active }),
      },
      {
        name: 'get_employee',
        description: 'Get a single employee by ID from XGHRM',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        handler: async (input) => this.hrm.getEmployee((input as any).id),
      },
      {
        name: 'get_payslips',
        description: 'Get all payslips for a month from XGHRM',
        inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM format' } }, required: ['month'] },
        handler: async (input) => this.hrm.getPayslips((input as any).month),
      },
      {
        name: 'get_payslip',
        description: 'Get a specific employee payslip for a month',
        inputSchema: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            month: { type: 'string', description: 'YYYY-MM format' },
          },
          required: ['employeeId', 'month'],
        },
        handler: async (input) => this.hrm.getPayslip((input as any).employeeId, (input as any).month),
      },
      {
        name: 'get_pending_leaves',
        description: 'Get pending leave requests from XGHRM',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.hrm.getPendingLeaves(),
      },
      {
        name: 'get_leave_requests',
        description: 'Get leave requests with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            employeeId: { type: 'string' },
            month: { type: 'string' },
          },
        },
        handler: async (input) => this.hrm.getLeaveRequests(input as any),
      },
      {
        name: 'get_alerts',
        description: 'Get HR alerts — probation endings, birthdays, anniversaries',
        inputSchema: { type: 'object', properties: { withinDays: { type: 'number' } } },
        handler: async (input) => this.hrm.getAlerts((input as any).withinDays),
      },
      {
        name: 'get_today_on_leave',
        description: 'Get employees on leave today',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.hrm.getTodayOnLeave(),
      },
      {
        name: 'get_today_wfh',
        description: 'Get employees working from home today',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.hrm.getTodayWfh(),
      },
      {
        name: 'submit_leave_request',
        description: 'Submit a leave request for an employee',
        inputSchema: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            type: { type: 'string', enum: ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'] },
            fromDate: { type: 'string', description: 'YYYY-MM-DD' },
            toDate: { type: 'string', description: 'YYYY-MM-DD' },
            reason: { type: 'string' },
          },
          required: ['employeeId', 'type', 'fromDate', 'toDate'],
        },
        handler: async (input) => this.hrm.createLeaveRequest(input as any),
      },
      {
        name: 'submit_wfh_request',
        description: 'Submit a WFH request for an employee',
        inputSchema: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            reason: { type: 'string' },
          },
          required: ['employeeId', 'date'],
        },
        handler: async (input) => this.hrm.createWfhRequest(input as any),
      },
      {
        name: 'export_payslips_csv',
        description: 'Get the CSV export URL for all payslips for a month',
        inputSchema: {
          type: 'object',
          properties: { month: { type: 'string', description: 'YYYY-MM format' } },
          required: ['month'],
        },
        handler: async (input) => ({ url: await this.hrm.exportPayslipsCsvUrl((input as any).month) }),
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/hr/test-connection',
        requiresAuth: true,
        handler: async () => this.hrm.testConnection(),
      },
    ];
  }

  private async getConfig(): Promise<HrConfig> {
    const [row] = await this.db.db.select().from(agents).where(eq(agents.key, this.key));
    const agentConf = (row?.config as Partial<HrConfig> ?? {});

    const payslipDaySetting = await this.settings.getDecrypted('hrm_payslip_day');
    const payslipDay = payslipDaySetting ? parseInt(payslipDaySetting, 10) : DEFAULT_CONFIG.payslipDay;

    return {
      ...DEFAULT_CONFIG,
      ...agentConf,
      payslipDay: isNaN(payslipDay) ? DEFAULT_CONFIG.payslipDay : Math.max(1, Math.min(28, payslipDay)),
    };
  }
}
