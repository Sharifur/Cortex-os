import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginThrottleService } from './login-throttle.service';
import { AuthSessionService } from './auth-session.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    PassportModule,
    forwardRef(() => TelegramModule),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET!,
        signOptions: { expiresIn: process.env.JWT_EXPIRY ?? '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginThrottleService, AuthSessionService],
  exports: [AuthService, AuthSessionService, JwtModule],
})
export class AuthModule {}
