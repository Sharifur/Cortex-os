import { Body, Controller, Get, Ip, Post, Put, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Ip() ip: string) {
    const realIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || ip || 'unknown';
    return this.auth.login(dto.email, dto.password, !!dto.rememberMe, realIp);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.auth.updateProfile(user.sub, dto.email, dto.name);
    return { ok: true };
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
