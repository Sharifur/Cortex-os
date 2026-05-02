import { Injectable, Inject, Logger, HttpException, HttpStatus } from '@nestjs/common';
import type IORedis from 'ioredis';

const WINDOW_SECONDS = 60;
const OPERATOR_ACTIVE_TTL = 90; // seconds — bot stays silent for 90s after an operator acts

@Injectable()
export class LivechatRateLimitService {
  private readonly logger = new Logger(LivechatRateLimitService.name);

  // In-memory fallback for when Redis is unreachable. Keyed by `bucket:key`.
  // Each entry holds a count and the minute-window it belongs to. Entries
  // from previous windows are evicted lazily on the next access for that key.
  private readonly memBuckets = new Map<string, { count: number; window: number }>();

  constructor(@Inject('LIVECHAT_REDIS') private readonly redis: IORedis) {}

  /**
   * Per-day counter — bumps + reads. Used to cap LLM cost per site.
   * Returns the *new* count after increment. Fails open (returns 0) on
   * Redis errors.
   */
  async incrDailyCounter(bucket: string, key: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const redisKey = `livechat:daily:${bucket}:${key}:${day}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) await this.redis.expire(redisKey, 26 * 3600);
      return count;
    } catch (err) {
      this.logger.warn(`daily-counter incr failed: ${(err as Error).message}`);
      return 0;
    }
  }

  /** Roll back one increment — used when a cap check rejects after incrementing. */
  async decrDailyCounter(bucket: string, key: string): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const redisKey = `livechat:daily:${bucket}:${key}:${day}`;
    try {
      await this.redis.decr(redisKey);
    } catch (err) {
      this.logger.warn(`daily-counter decr failed: ${(err as Error).message}`);
    }
  }

  /** Read the current day counter without incrementing. Returns 0 on miss / error. */
  async readDailyCounter(bucket: string, key: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const redisKey = `livechat:daily:${bucket}:${key}:${day}`;
    try {
      const v = await this.redis.get(redisKey);
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Per-minute fixed-window limiter. Throws 429 when the current minute's
   * counter exceeds `max`. Falls back to an in-memory counter when Redis is
   * unreachable — capped at 2× the normal limit so abuse protection degrades
   * gracefully rather than vanishing entirely on a Redis outage.
   */
  async check(bucket: string, key: string, max: number): Promise<void> {
    if (!key) return;
    const minute = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const redisKey = `livechat:rl:${bucket}:${key}:${minute}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.expire(redisKey, WINDOW_SECONDS + 5);
      }
      if (count > max) {
        throw new HttpException(
          { statusCode: 429, error: 'Too Many Requests', message: `Rate limit exceeded for ${bucket}` },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`rate-limit redis error (${bucket}): ${(err as Error).message}`);
      // In-memory fallback at 2× the normal limit
      const memKey = `${bucket}:${key}`;
      const entry = this.memBuckets.get(memKey);
      if (!entry || entry.window !== minute) {
        this.memBuckets.set(memKey, { count: 1, window: minute });
      } else {
        entry.count++;
        if (entry.count > max * 2) {
          throw new HttpException(
            { statusCode: 429, error: 'Too Many Requests', message: `Rate limit exceeded for ${bucket}` },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }
  }

  /**
   * Mark a session as operator-active. The bot will skip its reply for any
   * visitor message received within OPERATOR_ACTIVE_TTL seconds of this call.
   * Called whenever an operator sends a message (not an internal note).
   */
  async markOperatorActive(sessionId: string): Promise<void> {
    try {
      await this.redis.set(`livechat:operator_active:${sessionId}`, '1', 'EX', OPERATOR_ACTIVE_TTL);
    } catch (err) {
      this.logger.warn(`markOperatorActive failed for ${sessionId}: ${(err as Error).message}`);
    }
  }

  /** Returns true if an operator has been active in this session recently. */
  async isOperatorActive(sessionId: string): Promise<boolean> {
    try {
      const v = await this.redis.get(`livechat:operator_active:${sessionId}`);
      return v === '1';
    } catch {
      return false;
    }
  }
}
