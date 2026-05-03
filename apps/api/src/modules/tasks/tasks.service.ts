import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, lte, and, sql, isNull, between } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { AgentRuntimeService } from '../agents/runtime/agent-runtime.service';
import { TelegramService } from '../telegram/telegram.service';
import { tasks } from '../../db/schema';
import { computeNextRunAt } from './task.utils';

interface CreateTaskDto {
  title: string;
  instructions: string;
  agentKey: string;
  telegramMode?: string;
  recurrence?: string;
  recurrenceTime?: string;
  recurrenceDow?: number | null;
  recurrenceDom?: number | null;
  runNow?: boolean;
  scheduledAt?: string;
}

interface UpdateTaskDto {
  title?: string;
  instructions?: string;
  agentKey?: string;
  telegramMode?: string;
  recurrence?: string | null;
  recurrenceTime?: string | null;
  recurrenceDow?: number | null;
  recurrenceDom?: number | null;
  nextRunAt?: Date | null;
}

@Injectable()
export class TasksService {
  constructor(
    private db: DbService,
    private runtime: AgentRuntimeService,
    private telegram: TelegramService,
  ) {}

  list() {
    return this.db.db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async get(id: string) {
    const [row] = await this.db.db.select().from(tasks).where(eq(tasks.id, id));
    if (!row) throw new NotFoundException(`Task not found: ${id}`);
    return row;
  }

  async create(dto: CreateTaskDto) {
    const nextRunAt =
      dto.recurrence && dto.recurrenceTime
        ? computeNextRunAt(dto.recurrence, dto.recurrenceTime, dto.recurrenceDow, dto.recurrenceDom)
        : dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null;

    const [row] = await this.db.db
      .insert(tasks)
      .values({
        title: dto.title,
        instructions: dto.instructions,
        agentKey: dto.agentKey,
        telegramMode: dto.telegramMode ?? 'agent',
        recurrence: dto.recurrence ?? null,
        recurrenceTime: dto.recurrenceTime ?? null,
        recurrenceDow: dto.recurrenceDow ?? null,
        recurrenceDom: dto.recurrenceDom ?? null,
        nextRunAt,
      })
      .returning();

    if (dto.runNow) {
      await this.runTask(row.id);
    }

    return row;
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.get(id);
    const [row] = await this.db.db
      .update(tasks)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return row;
  }

  async delete(id: string) {
    await this.get(id);
    await this.db.db.delete(tasks).where(eq(tasks.id, id));
  }

  async runTask(id: string) {
    const task = await this.get(id);

    await this.db.db
      .update(tasks)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(tasks.id, id));

    const run = await this.runtime.triggerAgent(task.agentKey, 'MANUAL', {
      _taskId: task.id,
      _taskTitle: task.title,
      instructions: task.instructions,
      source: 'task',
    });

    await this.db.db
      .update(tasks)
      .set({ runId: run.id, updatedAt: new Date() })
      .where(eq(tasks.id, id));

    return run;
  }

  async markDone(taskId: string) {
    const task = await this.get(taskId);

    if (task.recurrence && task.recurrenceTime) {
      const nextRunAt = computeNextRunAt(task.recurrence, task.recurrenceTime, task.recurrenceDow, task.recurrenceDom);
      await this.db.db
        .update(tasks)
        .set({ status: 'pending', nextRunAt, reminderSentAt: null, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    } else {
      await this.db.db
        .update(tasks)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    }
  }

  async markFailed(taskId: string) {
    const task = await this.get(taskId);

    const update: Record<string, unknown> = { status: 'failed', updatedAt: new Date() };
    if (task.recurrence && task.recurrenceTime) {
      update.nextRunAt = computeNextRunAt(task.recurrence, task.recurrenceTime, task.recurrenceDow, task.recurrenceDom);
      update.reminderSentAt = null;
    }

    await this.db.db.update(tasks).set(update).where(eq(tasks.id, taskId));
  }

  async processDueTasks() {
    const now = new Date();

    // Send Telegram reminder for tasks running in ~1 hour (55–65 min window)
    const reminderFrom = new Date(now.getTime() + 55 * 60_000);
    const reminderTo   = new Date(now.getTime() + 65 * 60_000);
    const upcoming = await this.db.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'pending'),
          isNull(tasks.reminderSentAt),
          between(tasks.nextRunAt, reminderFrom, reminderTo),
        ),
      );
    for (const task of upcoming) {
      const when = task.nextRunAt
        ? task.nextRunAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'soon';
      await this.telegram.sendMessage(
        `Reminder: task "${task.title}" (${task.agentKey}) runs in ~1 hour at ${when}.`,
      ).catch(() => {});
      await this.db.db
        .update(tasks)
        .set({ reminderSentAt: now })
        .where(eq(tasks.id, task.id));
    }

    const due = await this.db.db
      .select()
      .from(tasks)
      .where(
        and(
          lte(tasks.nextRunAt, now),
          eq(tasks.status, 'pending'),
        ),
      );

    for (const task of due) {
      await this.runTask(task.id);
    }

    // Reconcile stuck tasks: any task in "running" whose underlying run has
    // reached a terminal state (EXECUTED / FAILED / REJECTED) but the task
    // status was never updated. Cheap to run; uses a single SQL update.
    await this.db.db.execute(sql`
      UPDATE ${tasks}
      SET
        status = CASE WHEN ar.status = 'FAILED' THEN 'failed' ELSE 'done' END,
        updated_at = NOW()
      FROM agent_runs ar
      WHERE ar.id = ${tasks.runId}
        AND ${tasks.status} = 'running'
        AND ar.status IN ('EXECUTED', 'FAILED', 'REJECTED')
        AND ${tasks.recurrence} IS NULL
    `);
  }
}
