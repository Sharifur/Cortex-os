import { Injectable, Inject, Logger } from '@nestjs/common';
import type IORedis from 'ioredis';

const TTL = 300; // 5 minutes

@Injectable()
export class KnowledgeBaseCacheService {
  private readonly logger = new Logger(KnowledgeBaseCacheService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: IORedis) {}

  async getOrSet<T>(key: string, loader: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
      const value = await loader();
      await this.redis.set(key, JSON.stringify(value), 'EX', TTL);
      return value;
    } catch {
      return loader();
    }
  }

  alwaysOnKey(agentKey: string) { return `kb:always_on:${agentKey}`; }
  samplesKey(agentKey: string)   { return `kb:samples:${agentKey}`; }
  templateKey(key: string)       { return `kb:template:${key}`; }
  blocklistKey(agentKey: string) { return `kb:blocklist:${agentKey}`; }

  async invalidateAgent(agentKey: string) {
    try {
      await this.redis.del(
        this.alwaysOnKey(agentKey),
        this.samplesKey(agentKey),
        this.blocklistKey(agentKey),
      );
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for ${agentKey}: ${err}`);
    }
  }

  async invalidateGlobal() {
    // Global entries (agentKeys = null) affect all agents — clear everything
    try {
      const keys = await this.redis.keys('kb:*');
      if (keys.length) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Global cache invalidation failed: ${err}`);
    }
  }

  async invalidateTemplate(key: string) {
    try {
      await this.redis.del(this.templateKey(key));
    } catch (err) {
      this.logger.warn(`Template cache invalidation failed for ${key}: ${err}`);
    }
  }
}
