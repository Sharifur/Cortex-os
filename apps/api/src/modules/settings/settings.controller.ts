import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SETTING_DEFINITIONS } from './settings.definitions';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Put(':key')
  async upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) {
    if (!SETTING_DEFINITIONS[key]) {
      throw new NotFoundException(`Unknown setting: ${key}`);
    }
    await this.settingsService.upsert(key, dto.value);
    return { ok: true };
  }

  @Delete(':key')
  async delete(@Param('key') key: string) {
    if (!SETTING_DEFINITIONS[key]) {
      throw new NotFoundException(`Unknown setting: ${key}`);
    }
    await this.settingsService.delete(key);
    return { ok: true };
  }
}
