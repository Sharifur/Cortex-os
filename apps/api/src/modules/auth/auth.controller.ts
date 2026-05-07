import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Put, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
    const ua = req.headers['user-agent'] as string | undefined;
    return this.auth.login(dto.email, dto.password, !!dto.rememberMe, realIp, ua);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.auth.logout(user.jti);
    return { ok: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  sessions(@CurrentUser() user: JwtPayload) {
    return this.auth.listSessions(user.sub);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.auth.revokeSession(user.sub, id);
    return { ok: true };
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

  // Admin — super_admin only
  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  listUsers() {
    return this.auth.listUsers();
  }

  @Post('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  createUser(@Body() body: { email: string; name?: string; password: string; role: string }) {
    return this.auth.createUser(body.email, body.name, body.password, body.role);
  }

  @Patch('admin/users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; role?: string },
  ) {
    return this.auth.updateUser(user.sub, id, body);
  }

  @Delete('admin/users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @HttpCode(200)
  async deleteUser(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.auth.deleteUser(user.sub, id);
    return { ok: true };
  }
}

