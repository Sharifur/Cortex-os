import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, lte, and } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { AgentRuntimeService } from '../agents/runtime/agent-runtime.service';
import { tasks } from '../../db/schema';
import { computeNextRunAt } from './task.utils';

interface CreateTaskDto {
  title: string;
  instructions: string;
  agentKey: string;
  recurrence?: string;
  recurrenceTime?: string;
  runNow?: boolean;
  scheduledAt?: string; // ISO string for one-time scheduled tasks
}

interface UpdateTaskDto {
  title?: string;
  instructions?: string;
  agentKey?: string;
  recurrence?: string | null;
  recurrenceTime?: string | null;
  nextRunAt?: Date | null;
}

@Injectable()
export class TasksService {
  constructor(
    private db: DbService,
    private runtime: AgentRuntimeService,
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
        ? computeNextRunAt(dto.recurrence, dto.recurrenceTime)
        : dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null;

    const [row] = await this.db.db
      .insert(tasks)
      .values({
        title: dto.title,
        instructions: dto.instructions,
        agentKey: dto.agentKey,
        recurrence: dto.recurrence ?? null,
        recurrenceTime: dto.recurrenceTime ?? null,
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
      const nextRunAt = computeNextRunAt(task.recurrence, task.recurrenceTime);
      await this.db.db
        .update(tasks)
        .set({ status: 'pending', nextRunAt, updatedAt: new Date() })
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
      update.nextRunAt = computeNextRunAt(task.recurrence, task.recurrenceTime);
    }

    await this.db.db.update(tasks).set(update).where(eq(tasks.id, taskId));
  }

  async processDueTasks() {
    const now = new Date();
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
  }
}
