import { Injectable, Logger } from '@nestjs/common';
import type { IAgent } from './types';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly registry = new Map<string, IAgent>();

  register(agent: IAgent) {
    this.registry.set(agent.key, agent);
    this.logger.log(`Registered agent: ${agent.key}`);
  }

  get(key: string): IAgent | undefined {
    return this.registry.get(key);
  }

  getAll(): IAgent[] {
    return Array.from(this.registry.values());
  }

  has(key: string): boolean {
    return this.registry.has(key);
  }
}
