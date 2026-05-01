import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GmailService } from './gmail.service';

@Controller('gmail/accounts')
@UseGuards(JwtAuthGuard)
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get()
  list() {
    return this.gmail.listAccounts();
  }

  @Post()
  async create(@Body() body: { label?: string; email?: string; displayName?: string | null; appPassword?: string; isDefault?: boolean }) {
    if (!body?.label?.trim()) throw new BadRequestException('label is required');
    if (!body?.email?.trim()) throw new BadRequestException('email is required');
    if (!body?.appPassword?.trim()) throw new BadRequestException('appPassword is required');
    return this.gmail.createAccount({
      label: body.label,
      email: body.email,
      displayName: body.displayName ?? null,
      appPassword: body.appPassword,
      isDefault: body.isDefault === true,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { label?: string; displayName?: string | null; appPassword?: string }) {
    return this.gmail.updateAccount(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.gmail.deleteAccount(id);
    return { ok: true };
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(@Param('id') id: string) {
    await this.gmail.setDefaultAccount(id);
    return { ok: true };
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string) {
    return this.gmail.testAccount(id);
  }
}
