import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

export interface HrmEmployee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  salary: number;
  currency: string;
  joinedAt: string;
  probationUntil: string | null;
  contractEndsAt: string | null;
  leaveBalance: number | null;
  bankAccount: string | null;
  active: boolean;
  photoUrl: string | null;
}

export interface HrmLeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface HrmWfhRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface HrmPayslip {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  currency: string;
  workingDays: number | null;
  presentDays: number | null;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface HrmAlerts {
  probationEnding: { employeeId: string; employeeName: string; probationUntil: string }[];
  contractExpiring: { employeeId: string; employeeName: string; contractEndsAt: string }[];
  birthdays: { employeeId: string; employeeName: string; date: string }[];
  workAnniversaries: { employeeId: string; employeeName: string; years: number; date: string }[];
}

export class HrmApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HrmApiError';
  }
}

@Injectable()
export class HrmApiService {
  private readonly logger = new Logger(HrmApiService.name);

  constructor(private readonly settings: SettingsService) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const base = await this.settings.getDecrypted('hrm_api_base_url');
    const secret = await this.settings.getDecrypted('hrm_api_secret');
    if (!base || !secret) throw new HrmApiError(0, 'HRM API not configured — set hrm_api_base_url and hrm_api_secret in Settings');

    const url = `${base.replace(/\/$/, '')}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'X-Signature': secret,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(url, init);
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const json = (await res.json()) as { error?: string; message?: string };
        msg = json.error ?? json.message ?? msg;
      } catch {}
      throw new HrmApiError(res.status, msg);
    }
    return res.json() as Promise<T>;
  }

  // Employees
  async getEmployees(params?: { active?: 'true' | 'false' | 'all'; department?: string }) {
    const qs = new URLSearchParams();
    if (params?.active) qs.set('active', params.active);
    if (params?.department) qs.set('department', params.department);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ data: HrmEmployee[]; total: number }>('GET', `/employees${q}`);
  }

  async getEmployee(id: string) {
    return this.request<HrmEmployee>('GET', `/employees/${id}`);
  }

  async getTodayOnLeave() {
    return this.request<{ data: { employeeId: string; employeeName: string; leaveType: string; fromDate: string; toDate: string }[] }>('GET', '/employees/today/on-leave');
  }

  async getTodayWfh() {
    return this.request<{ data: { employeeId: string; employeeName: string; date: string }[] }>('GET', '/employees/today/wfh');
  }

  async getAlerts(withinDays = 7) {
    return this.request<HrmAlerts>('GET', `/employees/alerts?withinDays=${withinDays}`);
  }

  // Leave requests
  async getLeaveRequests(params?: { status?: string; employeeId?: string; month?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.employeeId) qs.set('employeeId', params.employeeId);
    if (params?.month) qs.set('month', params.month);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ data: HrmLeaveRequest[]; total: number; pendingCount: number }>('GET', `/leave-requests${q}`);
  }

  async getPendingLeaves() {
    return this.request<{ data: HrmLeaveRequest[]; total: number }>('GET', '/leave-requests/pending');
  }

  async createLeaveRequest(data: { employeeId: string; type: string; fromDate: string; toDate: string; reason?: string }) {
    return this.request<HrmLeaveRequest>('POST', '/leave-requests', data);
  }

  async approveLeave(id: string, reason?: string) {
    return this.request<HrmLeaveRequest>('POST', `/leave-requests/${id}/approve`, reason ? { reason } : {});
  }

  async rejectLeave(id: string, reason: string) {
    return this.request<HrmLeaveRequest>('POST', `/leave-requests/${id}/reject`, { reason });
  }

  // WFH requests
  async getPendingWfh() {
    return this.request<{ data: HrmWfhRequest[]; total: number }>('GET', '/wfh-requests/pending');
  }

  async createWfhRequest(data: { employeeId: string; date: string; reason?: string }) {
    return this.request<HrmWfhRequest>('POST', '/wfh-requests', data);
  }

  async approveWfh(id: string, reason?: string) {
    return this.request<HrmWfhRequest>('POST', `/wfh-requests/${id}/approve`, reason ? { reason } : {});
  }

  async rejectWfh(id: string, reason: string) {
    return this.request<HrmWfhRequest>('POST', `/wfh-requests/${id}/reject`, { reason });
  }

  // Payslips
  async getPayslips(month: string) {
    return this.request<{ data: HrmPayslip[]; total: number; summary: { month: string; totalNet: number; currency: string; approvedCount: number; draftCount: number } }>('GET', `/payslips?month=${month}`);
  }

  async getPayslip(employeeId: string, month: string) {
    return this.request<HrmPayslip>('GET', `/payslips/${employeeId}/${month}`);
  }

  async generatePayslips(month: string) {
    return this.request<{
      generated: number;
      noAttendance: number;
      alreadyGeneratedNote: string | null;
      alreadyGenerated: { employeeId: string; employeeName: string; slipId: string }[];
      data: HrmPayslip[];
    }>('POST', '/payslips/generate', { month });
  }

  async updatePayslip(id: string, data: { bonus?: number; deductions?: number }) {
    return this.request<HrmPayslip>('PATCH', `/payslips/${id}`, data);
  }

  async approvePayslip(id: string) {
    return this.request<HrmPayslip>('POST', `/payslips/${id}/approve`, {});
  }

  async markPayslipPaid(id: string, paidAt?: string) {
    return this.request<HrmPayslip>('POST', `/payslips/${id}/mark-paid`, { paidAt: paidAt ?? null });
  }

  exportPayslipsCsvUrl(month: string): Promise<string> {
    return this.settings.getDecrypted('hrm_api_base_url').then((base) => {
      if (!base) return '';
      return `${base.replace(/\/$/, '')}/payslips/export/${month}`;
    });
  }

  async testConnection(): Promise<{ ok: boolean; employeeCount?: number }> {
    const result = await this.getEmployees({ active: 'true' });
    return { ok: true, employeeCount: result.total };
  }
}
