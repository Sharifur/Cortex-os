import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return { access_token: token };
  }

  async me(userId: string) {
    const [user] = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        telegramChatId: users.telegramChatId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return user ?? null;
  }

  async updateTelegramChatId(userId: string, chatId: string) {
    await this.db.db
      .update(users)
      .set({ telegramChatId: chatId })
      .where(eq(users.id, userId));
  }
}
