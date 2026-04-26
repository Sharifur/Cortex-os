import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { mcpServers } from '../../db/schema';

@Injectable()
export class McpServersService {
  constructor(private db: DbService) {}

  findAll() {
    return this.db.db.select().from(mcpServers).orderBy(mcpServers.createdAt);
  }

  async findById(id: string) {
    const [row] = await this.db.db.select().from(mcpServers).where(eq(mcpServers.id, id));
    if (!row) throw new NotFoundException(`MCP server not found: ${id}`);
    return row;
  }

  async findByName(name: string) {
    const [row] = await this.db.db.select().from(mcpServers).where(eq(mcpServers.name, name));
    return row ?? null;
  }

  async create(name: string, url: string) {
    const [row] = await this.db.db
      .insert(mcpServers)
      .values({ name, url })
      .returning();
    return row;
  }

  async update(id: string, data: { url?: string; enabled?: boolean }) {
    const [row] = await this.db.db
      .update(mcpServers)
      .set(data)
      .where(eq(mcpServers.id, id))
      .returning();
    if (!row) throw new NotFoundException(`MCP server not found: ${id}`);
    return row;
  }

  async delete(id: string) {
    await this.db.db.delete(mcpServers).where(eq(mcpServers.id, id));
  }
}
