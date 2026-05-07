import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginThrottleService } from './login-throttle.service';
import { AuthSessionService } from './auth-session.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET!,
        signOptions: { expiresIn: process.env.JWT_EXPIRY ?? '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginThrottleService, AuthSessionService, Reflector],
  exports: [AuthService, AuthSessionService, JwtModule],
})
export class AuthModule {}
