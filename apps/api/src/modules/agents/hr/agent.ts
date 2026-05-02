import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents } from '../../../db/schema';
import { hrPayslipRuns } from './schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { TelegramService } from '../../telegram/telegram.service';
import { SettingsService } from '../../settings/settings.service';
import { HrmApiService, HrmApiError } from './hrm-api.service';
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
  pendingLeaves?: any[];
  pendingWfh?: any[];
  onLeaveToday?: any[];
  onWfhToday?: any[];
  alerts?: any;
  generatedSlips?: any[];
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
      let generatedSlips: any[] = [];
      try {
        const result = await this.hrm.generatePayslips(month);
        generatedSlips = result.data;

        // Write pending_tg rows for any slip not yet tracked
        for (const slip of generatedSlips) {
          await this.db.db
            .insert(hrPayslipRuns)
            .values({
              month,
              xghrmId: slip.id,
              employeeId: slip.employeeId,
              employeeName: slip.employeeName,
              netSalary: Math.round(slip.netSalary),
              status: 'pending_tg',
            })
            .onConflictDoNothing();
        }
      } catch (err) {
        this.logger.error(`generatePayslips failed: ${err instanceof HrmApiError ? err.message : err}`);
      }

      return {
        source: trigger,
        snapshot: { mode: 'salary', month, config, generatedSlips },
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
      const pending = await this.db.db
        .select()
        .from(hrPayslipRuns)
        .where(and(eq(hrPayslipRuns.month, snap.month), eq(hrPayslipRuns.status, 'pending_tg')));

      for (const row of pending) {
        const slip = snap.generatedSlips?.find((s: any) => s.id === row.xghrmId);
        actions.push({
          type: 'payslip_approval_request',
          summary: `Payslip — ${row.employeeName} | ${snap.month} | Net: ${snap.config.currency} ${row.netSalary.toLocaleString()}`,
          payload: {
            runId: row.id,
            xghrmId: row.xghrmId,
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            month: snap.month,
            baseSalary: slip?.baseSalary ?? 0,
            bonus: slip?.bonus ?? 0,
            deductions: slip?.deductions ?? 0,
            netSalary: row.netSalary,
            currency: snap.config.currency,
          },
          riskLevel: 'high',
        });
      }

      if (!actions.length) {
        actions.push({ type: 'noop', summary: `No pending payslips for ${snap.month}.`, payload: {}, riskLevel: 'low' });
      }
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
    return action.type === 'payslip_approval_request' || action.type === 'leave_approval_request';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    if (action.type === 'noop') return { success: true };
    const p = action.payload as any;

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
      const kb = new InlineKeyboard()
        .text('Approve', `hr_wfh_approve:${p.wfhId}`)
        .text('Reject', `hr_wfh_reject:${p.wfhId}`);
      await this.telegram.sendMessageWithKeyboard(
        `WFH request\n${p.employeeName}: ${p.date}${p.reason ? `\nReason: ${p.reason}` : ''}`,
        kb,
      );
      return { success: true };
    }

    if (action.type === 'payslip_approval_request') {
      const kb = new InlineKeyboard()
        .text('Approve', `hr_slip_approve:${p.runId}:${p.xghrmId}`)
        .text('Edit', `hr_slip_edit:${p.runId}:${p.xghrmId}`)
        .text('Skip', `hr_slip_skip:${p.runId}`);
      await this.telegram.sendMessageWithKeyboard(
        `Payslip — ${p.employeeName}\nMonth: ${p.month}\nBase: ${p.currency} ${Number(p.baseSalary).toLocaleString()}\nBonus: ${p.currency} ${Number(p.bonus).toLocaleString()}\nDeductions: ${p.currency} ${Number(p.deductions).toLocaleString()}\nNet: ${p.currency} ${Number(p.netSalary).toLocaleString()}`,
        kb,
      );
      await this.db.db
        .update(hrPayslipRuns)
        .set({ status: 'tg_sent' })
        .where(eq(hrPayslipRuns.id, p.runId));
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
        description: 'Get payslips for a month from XGHRM',
        inputSchema: { type: 'object', properties: { month: { type: 'string' } }, required: ['month'] },
        handler: async (input) => this.hrm.getPayslips((input as any).month),
      },
      {
        name: 'get_pending_leaves',
        description: 'Get pending leave requests from XGHRM',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => this.hrm.getPendingLeaves(),
      },
      {
        name: 'get_alerts',
        description: 'Get HR alerts (probation endings, birthdays, anniversaries) from XGHRM',
        inputSchema: { type: 'object', properties: { withinDays: { type: 'number' } } },
        handler: async (input) => this.hrm.getAlerts((input as any).withinDays),
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
