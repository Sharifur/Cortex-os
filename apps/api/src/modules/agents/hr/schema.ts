import { pgTable, text, timestamp, integer, date } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const employees = pgTable('hr_employees', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  salary: integer('salary').notNull().default(0),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  probationUntil: timestamp('probation_until'),
  contractEndsAt: timestamp('contract_ends_at'),
  leaveBalance: integer('leave_balance').notNull().default(18),
  active: text('active').notNull().default('true'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const leaveRequests = pgTable('hr_leave_requests', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  employeeId: text('employee_id').notNull(),
  type: text('type').notNull(), // annual | sick | unpaid | maternity | paternity
  fromDate: date('from_date').notNull(),
  toDate: date('to_date').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  decisionReason: text('decision_reason'),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const salarySheets = pgTable('hr_salary_sheets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  month: text('month').notNull().unique(), // YYYY-MM
  lineItems: text('line_items').notNull().default('[]'), // JSON array
  totals: text('totals').notNull().default('{}'),        // JSON object
  fileKey: text('file_key'), // MinIO key for CSV export
  status: text('status').notNull().default('draft'),     // draft | approved
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
});
