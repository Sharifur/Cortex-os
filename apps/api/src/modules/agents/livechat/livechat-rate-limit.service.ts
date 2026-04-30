import { Injectable, Inject, Logger, HttpException, HttpStatus } from '@nestjs/common';
import type IORedis from 'ioredis';

const WINDOW_SECONDS = 60;

@Injectable()
export class LivechatRateLimitService {
  private readonly logger = new Logger(LivechatRateLimitService.name);

  constructor(@Inject('LIVECHAT_REDIS') private readonly redis: IORedis) {}

  /**
   * Per-minute fixed-window limiter. Throws 429 when the current minute's
   * counter exceeds `max`. Fails open if Redis is unreachable so the chat
   * keeps working — abuse protection degrades to none, never to "down".
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
    }
  }
}
