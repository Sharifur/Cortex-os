import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const hrPayslipRuns = pgTable('hr_payslip_runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  month: text('month').notNull(),
  xghrmId: text('xghrm_id').notNull().unique(),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name').notNull(),
  netSalary: integer('net_salary').notNull().default(0),
  status: text('status').notNull().default('pending_tg'),
  // pending_tg | tg_sent | approved | edit_requested | skipped
  telegramMsgId: integer('telegram_msg_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
