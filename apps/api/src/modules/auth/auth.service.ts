import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { LoginThrottleService } from './login-throttle.service';
import { AuthSessionService } from './auth-session.service';

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
    private throttle: LoginThrottleService,
    private sessions: AuthSessionService,
    private events: EventEmitter2,
  ) {}

  async login(email: string, password: string, rememberMe: boolean, ip: string, userAgent?: string) {
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
    const ttlSeconds = rememberMe ? 14 * 24 * 60 * 60 : 24 * 60 * 60;
    const session = await this.sessions.create({ userId: user.id, ip, userAgent, ttlSeconds });

    if (session.isNewIp) {
      this.events.emit('auth.login.new_ip', { email: user.email, ip, userAgent });
    }

    const token = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn, jwtid: session.jti },
    );
    return { access_token: token, expires_in: expiresIn };
  }

  async logout(jti?: string): Promise<void> {
    if (jti) await this.sessions.revokeByJti(jti);
  }

  async listSessions(userId: string) {
    return this.sessions.listForUser(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revokeById(userId, sessionId);
  }

  async me(userId: string) {
    const [user] = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        telegramChatId: users.telegramChatId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return user ?? null;
  }

  async listUsers() {
    return this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
  }

  async createUser(email: string, name: string | undefined, password: string, role: string) {
    const [existing] = await this.db.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(password, 12);
    const [row] = await this.db.db
      .insert(users)
      .values({ email, name: name?.trim() || null, password: hashed, role })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt });
    return row;
  }

  async updateUser(requesterId: string, targetId: string, patch: { name?: string; email?: string; role?: string }) {
    const [target] = await this.db.db.select().from(users).where(eq(users.id, targetId));
    if (!target) throw new NotFoundException('User not found');

    if (patch.email && patch.email !== target.email) {
      const [conflict] = await this.db.db.select({ id: users.id }).from(users).where(eq(users.email, patch.email));
      if (conflict) throw new ConflictException('Email already in use');
    }

    if (patch.role && patch.role !== target.role && target.role === 'super_admin') {
      const allAdmins = await this.db.db.select({ id: users.id }).from(users).where(eq(users.role, 'super_admin'));
      if (allAdmins.length <= 1) throw new ForbiddenException('Cannot demote the last Super Admin');
    }

    const update: Partial<typeof users.$inferInsert> = {};
    if (patch.name !== undefined) update.name = patch.name.trim() || null;
    if (patch.email) update.email = patch.email;
    if (patch.role) update.role = patch.role;

    const [updated] = await this.db.db
      .update(users)
      .set(update)
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt });
    return updated;
  }

  async deleteUser(requesterId: string, targetId: string) {
    if (requesterId === targetId) throw new ForbiddenException('Cannot delete your own account');
    const [target] = await this.db.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetId));
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'super_admin') {
      const allAdmins = await this.db.db.select({ id: users.id }).from(users).where(eq(users.role, 'super_admin'));
      if (allAdmins.length <= 1) throw new ForbiddenException('Cannot delete the last Super Admin');
    }
    await this.sessions.revokeAllForUser(targetId);
    await this.db.db.delete(users).where(eq(users.id, targetId));
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
