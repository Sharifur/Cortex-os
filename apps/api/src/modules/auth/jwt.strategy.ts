import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { AuthSessionService } from './auth-session.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private db: DbService,
    private sessions: AuthSessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload & { jti?: string }) {
    if (payload.jti) {
      const sess = await this.sessions.isValid(payload.jti);
      if (!sess.ok) throw new UnauthorizedException('Session revoked');
      void this.sessions.touch(payload.jti);
    }

    const [user] = await this.db.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, payload.sub));

    if (!user) throw new UnauthorizedException();
    return { sub: user.id, email: user.email, jti: payload.jti };
  }
}
