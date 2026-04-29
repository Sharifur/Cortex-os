import { Injectable, UnauthorizedException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { LoginThrottleService } from './login-throttle.service';

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
    private throttle: LoginThrottleService,
  ) {}

  async login(email: string, password: string, rememberMe: boolean, ip: string) {
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${email.toLowerCase()}`;

    for (const k of [ipKey, emailKey]) {
      const lock = this.throttle.isLocked(k);
      if (lock.locked) {
        throw new HttpException(
          { message: `Too many failed attempts. Try again in ${Math.ceil(lock.retryAfterSec / 60)} min.`, statusCode: HttpStatus.TOO_MANY_REQUESTS },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      this.throttle.registerFail(ipKey);
      this.throttle.registerFail(emailKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      this.throttle.registerFail(ipKey);
      this.throttle.registerFail(emailKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.throttle.registerSuccess(ipKey);
    this.throttle.registerSuccess(emailKey);

    const expiresIn = rememberMe ? '14d' : (process.env.JWT_EXPIRY ?? '24h');
    const token = this.jwt.sign({ sub: user.id, email: user.email }, { expiresIn });
    return { access_token: token, expires_in: expiresIn };
  }

  async me(userId: string) {
    const [user] = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        telegramChatId: users.telegramChatId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return user ?? null;
  }

  async changePassword(userId: string, _currentPassword: string | undefined, newPassword: string) {
    const [user] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new UnauthorizedException();

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db.db.update(users).set({ password: hashed }).where(eq(users.id, userId));
  }

  async updateProfile(userId: string, email: string, name?: string) {
    const [conflict] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (conflict && conflict.id !== userId) throw new ConflictException('Email already in use');
    const patch: { email: string; name?: string | null } = { email };
    if (typeof name === 'string') patch.name = name.trim() || null;
    await this.db.db.update(users).set(patch).where(eq(users.id, userId));
  }

  async updateTelegramChatId(userId: string, chatId: string) {
    await this.db.db
      .update(users)
      .set({ telegramChatId: chatId })
      .where(eq(users.id, userId));
  }
}
